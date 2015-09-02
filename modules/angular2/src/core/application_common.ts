import {DEFAULT_PIPES} from 'angular2/src/core/pipes';
import {FORM_BINDINGS} from 'angular2/src/core/forms';
import {bind, Binding, Injector, OpaqueToken} from 'angular2/src/core/di';
import {
  NumberWrapper,
  Type,
  isBlank,
  isPresent,
  assertionsEnabled,
  print,
  stringify
} from 'angular2/src/core/facade/lang';
import {
  BaseException,
  WrappedException,
  ExceptionHandler
} from 'angular2/src/core/facade/exceptions';
import {ListWrapper} from 'angular2/src/core/facade/collection';
import {BrowserDomAdapter} from 'angular2/src/core/dom/browser_adapter';
import {DOM} from 'angular2/src/core/dom/dom_adapter';
import {Compiler, CompilerCache} from './compiler/compiler';
import {Reflector, reflector} from 'angular2/src/core/reflection/reflection';
import {
  Parser,
  Lexer,
  ChangeDetection,
  DynamicChangeDetection,
  JitChangeDetection,
  PreGeneratedChangeDetection,
  IterableDiffers,
  defaultIterableDiffers,
  KeyValueDiffers,
  defaultKeyValueDiffers
} from 'angular2/src/core/change_detection/change_detection';
import {ViewLoader} from 'angular2/src/core/render/dom/compiler/view_loader';
import {StyleUrlResolver} from 'angular2/src/core/render/dom/compiler/style_url_resolver';
import {StyleInliner} from 'angular2/src/core/render/dom/compiler/style_inliner';
import {ViewResolver} from './compiler/view_resolver';
import {DirectiveResolver} from './compiler/directive_resolver';
import {PipeResolver} from './compiler/pipe_resolver';
import {Promise, PromiseWrapper, PromiseCompleter} from 'angular2/src/core/facade/async';
import {NgZone} from 'angular2/src/core/zone/ng_zone';
import {LifeCycle} from 'angular2/src/core/life_cycle/life_cycle';
import {XHR} from 'angular2/src/core/render/xhr';
import {XHRImpl} from 'angular2/src/core/render/xhr_impl';
import {
  EventManager,
  DomEventsPlugin,
  EVENT_MANAGER_PLUGINS
} from 'angular2/src/core/render/dom/events/event_manager';
import {KeyEventsPlugin} from 'angular2/src/core/render/dom/events/key_events';
import {HammerGesturesPlugin} from 'angular2/src/core/render/dom/events/hammer_gestures';
import {ComponentUrlMapper} from 'angular2/src/core/compiler/component_url_mapper';
import {UrlResolver} from 'angular2/src/core/services/url_resolver';
import {AppRootUrl} from 'angular2/src/core/services/app_root_url';
import {AnchorBasedAppRootUrl} from 'angular2/src/core/services/anchor_based_app_root_url';
import {
  ComponentRef,
  DynamicComponentLoader
} from 'angular2/src/core/compiler/dynamic_component_loader';
import {TestabilityRegistry, Testability} from 'angular2/src/core/testability/testability';
import {AppViewPool, APP_VIEW_POOL_CAPACITY} from 'angular2/src/core/compiler/view_pool';
import {AppViewManager} from 'angular2/src/core/compiler/view_manager';
import {AppViewManagerUtils} from 'angular2/src/core/compiler/view_manager_utils';
import {AppViewListener} from 'angular2/src/core/compiler/view_listener';
import {ProtoViewFactory} from 'angular2/src/core/compiler/proto_view_factory';
import {Renderer, RenderCompiler} from 'angular2/src/core/render/api';
import {
  DomRenderer,
  DOCUMENT,
  DefaultDomCompiler,
  APP_ID_RANDOM_BINDING,
  MAX_IN_MEMORY_ELEMENTS_PER_TEMPLATE,
  TemplateCloner
} from 'angular2/src/core/render/render';
import {ElementSchemaRegistry} from 'angular2/src/core/render/dom/schema/element_schema_registry';
import {
  DomElementSchemaRegistry
} from 'angular2/src/core/render/dom/schema/dom_element_schema_registry';
import {
  SharedStylesHost,
  DomSharedStylesHost
} from 'angular2/src/core/render/dom/view/shared_styles_host';
import {internalView} from 'angular2/src/core/compiler/view_ref';
import {APP_COMPONENT_REF_PROMISE, APP_COMPONENT} from './application_tokens';
import {wtfInit} from './profile/wtf_init';
import {EXCEPTION_BINDING} from './platform_bindings';

var _platform: PlatformRef;

/**
 * Construct bindings specific to an individual root component.
 */
function _componentBindings(appComponentType: Type): Array<Type | Binding | any[]> {
  return [
    bind(APP_COMPONENT)
        .toValue(appComponentType),
    bind(APP_COMPONENT_REF_PROMISE)
        .toFactory(
            (dynamicComponentLoader, injector: Injector) => {
              // TODO(rado): investigate whether to support bindings on root component.
              return dynamicComponentLoader.loadAsRoot(appComponentType, null, injector)
                  .then((componentRef) => {
                    if (isPresent(componentRef.location.nativeElement)) {
                      injector.get(TestabilityRegistry)
                          .registerApplication(componentRef.location.nativeElement,
                                               injector.get(Testability));
                    }
                    return componentRef;
                  });
            },
            [DynamicComponentLoader, Injector]),

    bind(appComponentType)
        .toFactory((p: Promise<any>) => p.then(ref => ref.instance), [APP_COMPONENT_REF_PROMISE]),
  ];
}

/**
 * Contains everything that is safe to share between applications.
 */
export function rootBindings(): Array<Type | Binding | any[]> {
  return [bind(Reflector).toValue(reflector), TestabilityRegistry];
}

/**
 * Construct a default set of bindings which should be included in any Angular
 * application, regardless of whether it runs on the UI thread or in a web worker.
 */
export function applicationCommonBindings(): Array<Type | Binding | any[]> {
  var bestChangeDetection = new DynamicChangeDetection();
  if (PreGeneratedChangeDetection.isSupported()) {
    bestChangeDetection = new PreGeneratedChangeDetection();
  } else if (JitChangeDetection.isSupported()) {
    bestChangeDetection = new JitChangeDetection();
  }
  return [
    ProtoViewFactory,
    AppViewPool,
    bind(APP_VIEW_POOL_CAPACITY).toValue(10000),
    AppViewManager,
    AppViewManagerUtils,
    AppViewListener,
    Compiler,
    CompilerCache,
    ViewResolver,
    DEFAULT_PIPES,
    bind(IterableDiffers).toValue(defaultIterableDiffers),
    bind(KeyValueDiffers).toValue(defaultKeyValueDiffers),
    bind(ChangeDetection).toValue(bestChangeDetection),
    DirectiveResolver,
    UrlResolver,
    StyleUrlResolver,
    PipeResolver,
    ComponentUrlMapper,
    Parser,
    Lexer,
    DynamicComponentLoader,
  ];
}

/**
 * A default set of bindings which apply only to an Angular application running on
 * the UI thread.
 */
export function applicationDomBindings(): Array<Type | Binding | any[]> {
  if (isBlank(DOM)) {
    throw "Must set a root DOM adapter first.";
  }
  return [
    bind(DOCUMENT)
        .toValue(DOM.defaultDoc()),
    bind(LifeCycle).toFactory((exceptionHandler) => new LifeCycle(null, assertionsEnabled()),
                              [ExceptionHandler]),
    EventManager,
    new Binding(EVENT_MANAGER_PLUGINS, {toClass: DomEventsPlugin, multi: true}),
    new Binding(EVENT_MANAGER_PLUGINS, {toClass: KeyEventsPlugin, multi: true}),
    new Binding(EVENT_MANAGER_PLUGINS, {toClass: HammerGesturesPlugin, multi: true}),
    DomRenderer,
    bind(Renderer).toAlias(DomRenderer),
    APP_ID_RANDOM_BINDING,
    TemplateCloner,
    bind(MAX_IN_MEMORY_ELEMENTS_PER_TEMPLATE).toValue(20),
    DefaultDomCompiler,
    bind(ElementSchemaRegistry).toValue(new DomElementSchemaRegistry()),
    bind(RenderCompiler).toAlias(DefaultDomCompiler),
    DomSharedStylesHost,
    bind(SharedStylesHost).toAlias(DomSharedStylesHost),
    ViewLoader,
    EXCEPTION_BINDING,
    bind(XHR).toValue(new XHRImpl()),
    StyleInliner,
    Testability,
    AnchorBasedAppRootUrl,
    bind(AppRootUrl).toAlias(AnchorBasedAppRootUrl),
    FORM_BINDINGS
  ];
}

/**
 * Create an Angular zone.
 */
export function createNgZone(): NgZone {
  return new NgZone({enableLongStackTrace: assertionsEnabled()});
}

/**
 * Represent the Angular context on a page, and is a true singleton.
 *
 * The platform {@link Injector} injects dependencies which are also
 * truly singletons in the context of a page (such as the browser's
 * cookie jar).
 */
export class PlatformRef {
  /**
   * @private
   */
  _applications: ApplicationRef[] = [];

  /**
   * @private
   */
  constructor(private _injector: Injector) {}

  /**
   * Get the platform {@link Injector}.
   */
  get injector(): Injector { return this._injector; }

  /**
   * Build a new Angular application with the given bindings. The `ApplicationRef`
   * returned can be used to bootstrap one or more root components within the
   * application.
   */
  application(bindings: Array<Type | Binding | any[]>): ApplicationRef {
    var app = new ApplicationRef();
    app._init(bindings);
    this._applications.push(app);
    return app;
  }

  /**
   * Build a new Angular application from asynchronously provided bindings.
   *
   * Runs the `AsyncLoader` callback in the application `Zone` and constructs
   * a new Application from the bindings provided by the `Promise` it returns.
   */
  asyncApplication(bindingFn:
                       (zone: NgZone) => Promise<Array<Type | Binding | any[]>>): Promise<ApplicationRef> {
    var app = new ApplicationRef();
    var completer = PromiseWrapper.completer();
    app.zone.run(() => {
      PromiseWrapper.then(bindingFn(app.zone), (bindings: Array<Type | Binding | any[]>) => {
        app._init(bindings);
        this._applications.push(app);
        completer.resolve(app);
      });
    });
    return completer.promise;
  }

  /**
   * Destroy the Angular platform and all Angular applications on the page.
   */
  dispose(): void {
    this._applications.forEach((app) => app.dispose());
    _platform = null;
  }

  /**
   * @private
   */
  _applicationDisposed(app: ApplicationRef): void { ListWrapper.remove(this._applications, app); }
}

/**
 * Initialize the Angular context on the page.
 *
 * If no bindings are provided, calling {@link platform}() is idempotent,
 * and will use the default platform bindings (which can be obtained from
 * {@link rootBindings}).
 */
export function platform(bindings?: Array<Type | Binding | any[]>): PlatformRef {
  if (isPresent(_platform)) {
    if (isBlank(bindings)) {
      return _platform;
    }
    throw "platform() can only be called once per page";
  }
  if (isBlank(bindings)) {
    bindings = rootBindings();
  }
  wtfInit();
  _platform = new PlatformRef(Injector.resolveAndCreate(bindings));
  return _platform;
}

/**
 * Represents an Angular application.
 *
 * Use to retrieve the application {@link Injector} or to bootstrap new
 * components at the root of the application. Can also be used to dispose
 * of the entire application and all its loaded components.
 */
export class ApplicationRef {
  private _injector: Injector;
  private _zone: NgZone;
  private _bootstrapListeners: Function[] = [];
  private _rootComponents: ComponentRef[] = [];

  /**
   * @private
   */
  constructor() { this._zone = createNgZone(); }

  /**
   * @private
   */
  _init(bindings: Array<Type | Binding | any[]>): void {
    this._zone.run(() => {

      bindings.push(bind(NgZone).toValue(this._zone));
      bindings.push(bind(ApplicationRef).toValue(this));

      var exceptionHandler;
      try {
        this._injector = _platform.injector.resolveAndCreateChild(bindings);
        exceptionHandler = this._injector.get(ExceptionHandler);
        this._zone.overrideOnErrorHandler((e, s) => exceptionHandler.call(e, s));
      } catch (e) {
        if (isPresent(exceptionHandler)) {
          exceptionHandler.call(e, e.stack);
        } else {
          DOM.logError(e);
        }
      }
    });
  }

  /**
   * Register a listener to be called each time a new root component type is bootstrapped.
   */
  registerBootstrapListener(listener: (ref: ComponentRef) => void): void {
    this._bootstrapListeners.push(listener);
  }

  /**
   * Bootstrap a new component at the root level of the application, optionally with
   * component specific bindings.
   */
  bootstrap(componentType: Type, bindings?: Array<Type | Binding | any[]>): Promise<ComponentRef> {
    var completer = PromiseWrapper.completer();
    this._zone.run(() => {
      var componentBindings = _componentBindings(componentType);
      if (isPresent(bindings)) {
        componentBindings.push(bindings);
      }
      var exceptionHandler = this._injector.get(ExceptionHandler);
      try {
        var injector: Injector = this._injector.resolveAndCreateChild(componentBindings);
        var compRefToken: Promise<ComponentRef> = injector.get(APP_COMPONENT_REF_PROMISE);
        var tick = (componentRef) => {
          var appChangeDetector = internalView(componentRef.hostView).changeDetector;
          var lc = injector.get(LifeCycle);
          lc.registerWith(this._zone, appChangeDetector);
          lc.tick();
          completer.resolve(componentRef);
          this._rootComponents.push(componentRef);
          this._bootstrapListeners.forEach((listener) => listener(componentRef));
        };

        var tickResult = PromiseWrapper.then(compRefToken, tick);

        PromiseWrapper.then(tickResult, (_) => {});
        PromiseWrapper.then(tickResult, null,
                            (err, stackTrace) => completer.reject(err, stackTrace));
      } catch (e) {
        exceptionHandler.call(e, e.stack);
        completer.reject(e, e.stack);
      }
    });
    return completer.promise;
  }

  /**
   * Retrieve the application {@link Injector}.
   */
  get injector(): Injector { return this._injector; }

  /**
   * Retrieve the application {@link Zone}.
   */
  get zone(): NgZone { return this._zone; }

  dispose(): void {
    // TODO(alxhub): Dispose of the NgZone.
    this._rootComponents.forEach((ref) => ref.dispose());
    _platform._applicationDisposed(this);
  }
}

/**
 * Bootstrapping for Angular applications.
 *
 * You instantiate an Angular application by explicitly specifying a component to use
 * as the root component for your application via the `bootstrap()` method.
 *
 * ## Simple Example
 *
 * Assuming this `index.html`:
 *
 * ```html
 * <html>
 *   <!-- load Angular script tags here. -->
 *   <body>
 *     <my-app>loading...</my-app>
 *   </body>
 * </html>
 * ```
 *
 * An application is bootstrapped inside an existing browser DOM, typically `index.html`.
 * Unlike Angular 1, Angular 2 does not compile/process bindings in `index.html`. This is
 * mainly for security reasons, as well as architectural changes in Angular 2. This means
 * that `index.html` can safely be processed using server-side technologies such as
 * bindings. Bindings can thus use double-curly `{{ syntax }}` without collision from
 * Angular 2 component double-curly `{{ syntax }}`.
 *
 * We can use this script code:
 *
 * ```
 * @Component({
 *    selector: 'my-app'
 * })
 * @View({
 *    template: 'Hello {{ name }}!'
 * })
 * class MyApp {
 *   name:string;
 *
 *   constructor() {
 *     this.name = 'World';
 *   }
 * }
 *
 * main() {
 *   return bootstrap(MyApp);
 * }
 * ```
 *
 * When the app developer invokes `bootstrap()` with the root component `MyApp` as its
 * argument, Angular performs the following tasks:
 *
 *  1. It uses the component's `selector` property to locate the DOM element which needs
 *     to be upgraded into the angular component.
 *  2. It creates a new child injector (from the platform injector). Optionally, you can
 *     also override the injector configuration for an app by invoking `bootstrap` with the
 *     `componentInjectableBindings` argument.
 *  3. It creates a new `Zone` and connects it to the angular application's change detection
 *     domain instance.
 *  4. It creates a shadow DOM on the selected component's host element and loads the
 *     template into it.
 *  5. It instantiates the specified component.
 *  6. Finally, Angular performs change detection to apply the initial data bindings for the
 *     application.
 *
 *
 * ## Instantiating Multiple Applications on a Single Page
 *
 * There are two ways to do this.
 *
 * ### Isolated Applications
 *
 * Angular creates a new application each time that the `bootstrap()` method is invoked.
 * When multiple applications are created for a page, Angular treats each application as
 * independent within an isolated change detection and `Zone` domain. If you need to share
 * data between applications, use the strategy described in the next section, "Applications
 * That Share Change Detection."
 *
 *
 * ### Applications That Share Change Detection
 *
 * If you need to bootstrap multiple applications that share common data, the applications
 * must share a common change detection and zone. To do that, create a meta-component that
 * lists the application components in its template.
 *
 * By only invoking the `bootstrap()` method once, with the meta-component as its argument,
 * you ensure that only a single change detection zone is created and therefore data can be
 * shared across the applications.
 *
 *
 * ## Platform Injector
 *
 * When working within a browser window, there are many singleton resources: cookies, title,
 * location, and others. Angular services that represent these resources must likewise be
 * shared across all Angular applications that occupy the same browser window. For this
 * reason, Angular creates exactly one global platform injector which stores all shared
 * services, and each angular application injector has the platform injector as its parent.
 *
 * Each application has its own private injector as well. When there are multipl
 * applications on a page, Angular treats each application injector's services as private
 * to that application.
 *
 *
 * # API
 * - `appComponentType`: The root component which should act as the application. This is
 *   a reference to a `Type` which is annotated with `@Component(...)`.
 * - `componentInjectableBindings`: An additional set of bindings that can be added to the
 *   app injector to override default injection behavior.
 * - `errorReporter`: `function(exception:any, stackTrace:string)` a default error reporter
 *   for unhandled exceptions.
 *
 * Returns a `Promise` of {@link ApplicationRef}.
 */
export function commonBootstrap(appComponentType: /*Type*/ any,
                                appBindings: Array<Type | Binding | any[]> = null):
    Promise<ComponentRef> {
  BrowserDomAdapter.makeCurrent();
  var bindings = [applicationCommonBindings(), applicationDomBindings()];
  if (isPresent(appBindings)) {
    bindings.push(appBindings);
  }
  return platform().application(bindings).bootstrap(appComponentType);
}
