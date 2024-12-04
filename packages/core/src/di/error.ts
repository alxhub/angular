/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Type} from '../interface/type';
import {RuntimeError, RuntimeErrorCode} from '../errors';
import {stringify} from '../util/stringify';
import {isEnvironmentProviders} from './provider';
import {ProviderToken} from './provider_token';
import {stringifyForError} from '../render3/util/stringify_utils';

/** Called when directives inject each other (creating a circular dependency) */
export function throwCyclicDependencyError(token: string, path?: string[]): never {
  const depPath = path ? `. Dependency path: ${path.join(' > ')} > ${token}` : '';
  throw new RuntimeError(
    RuntimeErrorCode.CYCLIC_DI_DEPENDENCY,
    ngDevMode ? `Circular dependency in DI detected for ${token}${depPath}` : token,
  );
}

export function throwMixedMultiProviderError() {
  throw new Error(`Cannot mix multi providers and regular providers`);
}

export function throwInvalidProviderError(
  ngModuleType?: Type<unknown>,
  providers?: any[],
  provider?: any,
): never {
  if (ngModuleType && providers) {
    const providerDetail = providers.map((v) => (v == provider ? '?' + provider + '?' : '...'));
    throw new Error(
      `Invalid provider for the NgModule '${stringify(
        ngModuleType,
      )}' - only instances of Provider and Type are allowed, got: [${providerDetail.join(', ')}]`,
    );
  } else if (isEnvironmentProviders(provider)) {
    if (provider.ɵfromNgModule) {
      throw new RuntimeError(
        RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
        `Invalid providers from 'importProvidersFrom' present in a non-environment injector. 'importProvidersFrom' can't be used for component providers.`,
      );
    } else {
      throw new RuntimeError(
        RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
        `Invalid providers present in a non-environment injector. 'EnvironmentProviders' can't be used for component providers.`,
      );
    }
  } else {
    throw new Error('Invalid provider');
  }
}

/** Throws an error when a token is not found in DI. */
export function throwProviderNotFoundError(
  token: ProviderToken<unknown>,
  injectorName?: string,
): never {
  const errorMessage =
    ngDevMode &&
    `No provider for ${stringifyForError(token)} found${injectorName ? ` in ${injectorName}` : ''}`;
  throw new RuntimeError(RuntimeErrorCode.PROVIDER_NOT_FOUND, errorMessage);
}

export function catchInjectorError(
  e: any,
  token: any,
  injectorErrorName: string,
  source: string | null,
): never {
  const tokenPath: any[] = e[NG_TEMP_TOKEN_PATH];
  if (token[SOURCE]) {
    tokenPath.unshift(token[SOURCE]);
  }
  e.message = formatError('\n' + e.message, tokenPath, injectorErrorName, source);
  e[NG_TOKEN_PATH] = tokenPath;
  e[NG_TEMP_TOKEN_PATH] = null;
  throw e;
}

export function formatError(
  text: string,
  obj: any,
  injectorErrorName: string,
  source: string | null = null,
): string {
  text = text && text.charAt(0) === '\n' && text.charAt(1) == NO_NEW_LINE ? text.slice(2) : text;
  let context = stringify(obj);
  if (Array.isArray(obj)) {
    context = obj.map(stringify).join(' -> ');
  } else if (typeof obj === 'object') {
    let parts = <string[]>[];
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        let value = obj[key];
        parts.push(
          key + ':' + (typeof value === 'string' ? JSON.stringify(value) : stringify(value)),
        );
      }
    }
    context = `{${parts.join(', ')}}`;
  }
  return `${injectorErrorName}${source ? '(' + source + ')' : ''}[${context}]: ${text.replace(
    NEW_LINE,
    '\n  ',
  )}`;
}

export const NG_TEMP_TOKEN_PATH = 'ngTempTokenPath';

const NG_TOKEN_PATH = 'ngTokenPath';
const NEW_LINE = /\n/gm;
const NO_NEW_LINE = 'ɵ';
const SOURCE = '__source';
