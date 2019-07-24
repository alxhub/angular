/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {DepGraph} from 'dependency-graph';

import {AbsoluteFsPath, FileSystem, absoluteFrom, dirname, getFileSystem, resolve} from '../../src/ngtsc/file_system';

import {CommonJsDependencyHost} from './dependencies/commonjs_dependency_host';
import {DependencyResolver, InvalidEntryPoint, SortedEntryPointsInfo} from './dependencies/dependency_resolver';
import {EsmDependencyHost} from './dependencies/esm_dependency_host';
import {ModuleResolver} from './dependencies/module_resolver';
import {UmdDependencyHost} from './dependencies/umd_dependency_host';
import {DirectoryWalkerEntryPointFinder} from './entry_point_finder/directory_walker_entry_point_finder';
import {TargetedEntryPointFinder} from './entry_point_finder/targeted_entry_point_finder';
import {Task} from './execution/api';
import {ClusterExecutor} from './execution/cluster_executor';
import {NgccTaskCompiler} from './execution/compiler';
import {ArrayTaskQueue} from './execution/queue';
import {SingleProcessExecutor} from './execution/single_threaded_executor';
import {ConsoleLogger, LogLevel} from './logging/console_logger';
import {Logger} from './logging/logger';
import {hasBeenProcessed, markAsProcessed} from './packages/build_marker';
import {NgccConfiguration} from './packages/configuration';
import {EntryPoint, EntryPointFormat, EntryPointJsonProperty, EntryPointPackageJson, PackageJsonFormatKey, PackageJsonFormatProperties, SUPPORTED_FORMAT_PROPERTIES, getEntryPointFormat} from './packages/entry_point';
import {makeEntryPointBundle} from './packages/entry_point_bundle';
import {Transformer} from './packages/transformer';
import {PathMappings} from './utils';
import {FileWriter} from './writing/file_writer';
import {InPlaceFileWriter} from './writing/in_place_file_writer';
import {NewEntryPointFileWriter} from './writing/new_entry_point_file_writer';
import {DirectPackageJsonWriter} from './writing/package_json_writer';



/**
 * The options to configure the ngcc compiler.
 */
export interface NgccOptions {
  /** The absolute path to the `node_modules` folder that contains the packages to process. */
  basePath: string;
  /**
   * The path to the primary package to be processed. If not absolute then it must be relative to
   * `basePath`.
   *
   * All its dependencies will need to be processed too.
   */
  targetEntryPointPath?: string;
  /**
   * Which entry-point properties in the package.json to consider when processing an entry-point.
   * Each property should hold a path to the particular bundle format for the entry-point.
   * Defaults to all the properties in the package.json.
   */
  propertiesToConsider?: string[];
  /**
   * Whether to process all formats specified by (`propertiesToConsider`)  or to stop processing
   * this entry-point at the first matching format. Defaults to `true`.
   */
  compileAllFormats?: boolean;
  /**
   * Whether to create new entry-points bundles rather than overwriting the original files.
   */
  createNewEntryPointFormats?: boolean;
  /**
   * Provide a logger that will be called with log messages.
   */
  logger?: Logger;
  /**
   * Paths mapping configuration (`paths` and `baseUrl`), as found in `ts.CompilerOptions`.
   * These are used to resolve paths to locally built Angular libraries.
   */
  pathMappings?: PathMappings;
  /**
   * Provide a file-system service that will be used by ngcc for all file interactions.
   */
  fileSystem?: FileSystem;
}

const SUPPORTED_FORMATS: EntryPointFormat[] = ['esm5', 'esm2015', 'umd', 'commonjs'];

/**
 * This is the main entry-point into ngcc (aNGular Compatibility Compiler).
 *
 * You can call this function to process one or more npm packages, to ensure
 * that they are compatible with the ivy compiler (ngtsc).
 *
 * @param options The options telling ngcc what to compile and how.
 */
export async function mainNgcc(
    {basePath, targetEntryPointPath, propertiesToConsider = SUPPORTED_FORMAT_PROPERTIES,
     compileAllFormats = true, createNewEntryPointFormats = false,
     logger = new ConsoleLogger(LogLevel.info), pathMappings}: NgccOptions): Promise<void> {
  const fileSystem = getFileSystem();
  const moduleResolver = new ModuleResolver(fileSystem, pathMappings);
  const esmDependencyHost = new EsmDependencyHost(fileSystem, moduleResolver);
  const umdDependencyHost = new UmdDependencyHost(fileSystem, moduleResolver);
  const commonJsDependencyHost = new CommonJsDependencyHost(fileSystem, moduleResolver);
  const resolver = new DependencyResolver(fileSystem, logger, {
    esm5: esmDependencyHost,
    esm2015: esmDependencyHost,
    umd: umdDependencyHost,
    commonjs: commonJsDependencyHost
  });
  const absBasePath = absoluteFrom(basePath);
  const fileWriter = getFileWriter(fileSystem, createNewEntryPointFormats);

  const compiler = new NgccTaskCompiler(
      fileSystem, fileWriter, new DirectPackageJsonWriter(fileSystem), pathMappings || null,
      logger);

  const analyzeFn = () => {

    const config = new NgccConfiguration(fileSystem, dirname(absBasePath));
    const {entryPoints, graph} = getEntryPoints(
        fileSystem, config, logger, resolver, absBasePath, targetEntryPointPath, pathMappings,
        propertiesToConsider, compileAllFormats);

    const tasks: Task[] = [];

    for (const entryPoint of entryPoints) {
      // Are we compiling the Angular core?
      const isCore = entryPoint.name === '@angular/core';

      const compiledFormats = new Map<string, Task>();
      const entryPointPackageJson = entryPoint.packageJson;
      const entryPointPackageJsonPath = fileSystem.resolve(entryPoint.path, 'package.json');

      const hasProcessedDts = hasBeenProcessed(entryPointPackageJson, 'typings');
      for (let i = 0; i < propertiesToConsider.length; i++) {
        const property = propertiesToConsider[i] as EntryPointJsonProperty;
        const formatPath = entryPointPackageJson[property];
        const format = getEntryPointFormat(fileSystem, entryPoint, property);

        // No format then this property is not supposed to be compiled.
        if (!formatPath || !format || SUPPORTED_FORMATS.indexOf(format) === -1) continue;

        if (hasBeenProcessed(entryPointPackageJson, property)) {
          // compiledFormats.set(formatPath, property);
          logger.debug(`Skipping ${entryPoint.name} : ${property} (already compiled).`);
          // TODO: record this fact in the package.json here?
          continue;
        }

        const isFirstFormat = compiledFormats.size === 0;
        const processDts = !hasProcessedDts && isFirstFormat;

        console.error(
            'considering format', `${formatPath}(${format})`, 'from', property, 'first?',
            isFirstFormat);

        // We don't break if this if statement fails because we still want to mark
        // the property as processed even if its underlying format has been built already.
        if (!compiledFormats.has(formatPath) && (compileAllFormats || isFirstFormat)) {
          const task: Task = {
            entryPoint,
            processDts,
            formatProperties: [property],
          };
          tasks.push(task);
          console.error(
              'decided to compile format', `${formatPath}(${format})`, 'with property', property);
          compiledFormats.set(formatPath, task);
        } else if (compiledFormats.has(formatPath)) {
          const task = compiledFormats.get(formatPath) !;
          console.error('adding', property, 'to format', `${formatPath}(${format})`);
          task.formatProperties.push(property);
        }
      }

      if (compiledFormats.size === 0) {
        throw new Error(
            `Failed to compile any formats for entry-point at (${entryPoint.path}). Tried ${propertiesToConsider}.`);
      }
    }
    return {queue: new ArrayTaskQueue(tasks), graph};
  };

  const cpus = require('os').cpus().length;
  // Use between 1 and 8 CPUs.
  const useCores = cpus > 8 ? 8 : (cpus - 1 || 0);
  const executor = new ClusterExecutor(useCores);
  return executor.execute(analyzeFn, compiler);
}

function getFileWriter(fs: FileSystem, createNewEntryPointFormats: boolean): FileWriter {
  return createNewEntryPointFormats ?
      new NewEntryPointFileWriter(fs, new DirectPackageJsonWriter(fs)) :
      new InPlaceFileWriter(fs);
}

function getEntryPoints(
    fs: FileSystem, config: NgccConfiguration, logger: Logger, resolver: DependencyResolver,
    basePath: AbsoluteFsPath, targetEntryPointPath: string | undefined,
    pathMappings: PathMappings | undefined, propertiesToConsider: string[],
    compileAllFormats: boolean): {entryPoints: EntryPoint[], graph: DepGraph<EntryPoint>} {
  const {entryPoints, invalidEntryPoints, graph} = (targetEntryPointPath !== undefined) ?
      getTargetedEntryPoints(
          fs, config, logger, resolver, basePath, targetEntryPointPath, propertiesToConsider,
          compileAllFormats, pathMappings) :
      getAllEntryPoints(fs, config, logger, resolver, basePath, pathMappings);
  logInvalidEntryPoints(logger, invalidEntryPoints);
  return {entryPoints, graph};
}

const EMPTY_GRAPH = new DepGraph<EntryPoint>();

function getTargetedEntryPoints(
    fs: FileSystem, config: NgccConfiguration, logger: Logger, resolver: DependencyResolver,
    basePath: AbsoluteFsPath, targetEntryPointPath: string, propertiesToConsider: string[],
    compileAllFormats: boolean, pathMappings: PathMappings | undefined): SortedEntryPointsInfo {
  const absoluteTargetEntryPointPath = resolve(basePath, targetEntryPointPath);
  if (hasProcessedTargetEntryPoint(
          fs, absoluteTargetEntryPointPath, propertiesToConsider, compileAllFormats)) {
    logger.debug('The target entry-point has already been processed');
    return {
      entryPoints: [],
      invalidEntryPoints: [],
      ignoredDependencies: [],
      graph: EMPTY_GRAPH,
    };
  }
  const finder = new TargetedEntryPointFinder(
      fs, config, logger, resolver, basePath, absoluteTargetEntryPointPath, pathMappings);
  const entryPointInfo = finder.findEntryPoints();
  if (entryPointInfo.entryPoints.length === 0) {
    markNonAngularPackageAsProcessed(fs, absoluteTargetEntryPointPath, propertiesToConsider);
  }
  return entryPointInfo;
}

function getAllEntryPoints(
    fs: FileSystem, config: NgccConfiguration, logger: Logger, resolver: DependencyResolver,
    basePath: AbsoluteFsPath, pathMappings: PathMappings | undefined): SortedEntryPointsInfo {
  const finder =
      new DirectoryWalkerEntryPointFinder(fs, config, logger, resolver, basePath, pathMappings);
  return finder.findEntryPoints();
}

function hasProcessedTargetEntryPoint(
    fs: FileSystem, targetPath: AbsoluteFsPath, propertiesToConsider: string[],
    compileAllFormats: boolean) {
  const packageJsonPath = resolve(targetPath, 'package.json');
  // It might be that this target is configured in which case its package.json might not exist.
  if (!fs.exists(packageJsonPath)) {
    return false;
  }
  const packageJson = JSON.parse(fs.readFile(packageJsonPath));

  for (const property of propertiesToConsider) {
    if (packageJson[property]) {
      // Here is a property that should be processed
      if (hasBeenProcessed(packageJson, property as EntryPointJsonProperty)) {
        if (!compileAllFormats) {
          // It has been processed and we only need one, so we are done.
          return true;
        }
      } else {
        // It has not been processed but we need all of them, so we are done.
        return false;
      }
    }
  }
  // Either all formats need to be compiled and there were none that were unprocessed,
  // Or only the one matching format needs to be compiled but there was at least one matching
  // property before the first processed format that was unprocessed.
  return true;
}

/**
 * If we get here, then the requested entry-point did not contain anything compiled by
 * the old Angular compiler. Therefore there is nothing for ngcc to do.
 * So mark all formats in this entry-point as processed so that clients of ngcc can avoid
 * triggering ngcc for this entry-point in the future.
 */
function markNonAngularPackageAsProcessed(
    fs: FileSystem, path: AbsoluteFsPath, propertiesToConsider: string[]) {
  const packageJsonPath = resolve(path, 'package.json');
  const packageJson = JSON.parse(fs.readFile(packageJsonPath));
  propertiesToConsider.forEach(formatProperty => {
    if (packageJson[formatProperty])
      markAsProcessed(fs, packageJson, packageJsonPath, formatProperty as EntryPointJsonProperty);
  });
}

function logInvalidEntryPoints(logger: Logger, invalidEntryPoints: InvalidEntryPoint[]): void {
  invalidEntryPoints.forEach(invalidEntryPoint => {
    logger.debug(
        `Invalid entry-point ${invalidEntryPoint.entryPoint.path}.`,
        `It is missing required dependencies:\n` +
            invalidEntryPoint.missingDependencies.map(dep => ` - ${dep}`).join('\n'));
  });
}
