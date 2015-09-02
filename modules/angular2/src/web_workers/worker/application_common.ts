import {Injector, bind, OpaqueToken, Binding} from 'angular2/src/core/di';
import {FORM_BINDINGS} from 'angular2/src/core/forms';
import {
  NumberWrapper,
  Type,
  isBlank,
  isPresent,
  assertionsEnabled,
  print,
  stringify
} from 'angular2/src/core/facade/lang';
import {Reflector, reflector} from 'angular2/src/core/reflection/reflection';
import {ExceptionHandler} from 'angular2/src/core/facade/exceptions';
import {Promise, PromiseWrapper, PromiseCompleter} from 'angular2/src/core/facade/async';
import {XHR} from 'angular2/src/core/render/xhr';
import {WebWorkerXHRImpl} from 'angular2/src/web_workers/worker/xhr_impl';
import {AppRootUrl} from 'angular2/src/core/services/app_root_url';
import {WebWorkerRenderer, WebWorkerCompiler} from './renderer';
import {Renderer, RenderCompiler} from 'angular2/src/core/render/api';
import {ClientMessageBrokerFactory} from 'angular2/src/web_workers/shared/client_message_broker';
import {MessageBus} from 'angular2/src/web_workers/shared/message_bus';
import {
  applicationCommonBindings,
  platform,
  ApplicationRef
} from 'angular2/src/core/application_common';
import {Serializer} from "angular2/src/web_workers/shared/serializer";
import {ON_WEB_WORKER} from "angular2/src/web_workers/shared/api";
import {RenderProtoViewRefStore} from 'angular2/src/web_workers/shared/render_proto_view_ref_store';
import {
  RenderViewWithFragmentsStore
} from 'angular2/src/web_workers/shared/render_view_with_fragments_store';
import {ObservableWrapper} from 'angular2/src/core/facade/async';
import {SETUP_CHANNEL} from 'angular2/src/web_workers/shared/messaging_api';
import {WebWorkerEventDispatcher} from 'angular2/src/web_workers/worker/event_dispatcher';
import {ComponentRef} from 'angular2/src/core/compiler/dynamic_component_loader';
import {NgZone} from 'angular2/src/core/zone/ng_zone';

var _rootInjector: Injector;

// Contains everything that is safe to share between applications.
var _rootBindings = [bind(Reflector).toValue(reflector)];

class PrintLogger {
  log = print;
  logError = print;
  logGroup = print;
  logGroupEnd() {}
}

function webWorkerBindings(appComponentType, bus: MessageBus, initData: StringMap<string, any>):
    Array<Type | Binding | any[]> {
  return [
    Serializer,
    bind(MessageBus).toValue(bus),
    ClientMessageBrokerFactory,
    WebWorkerRenderer,
    bind(Renderer).toAlias(WebWorkerRenderer),
    WebWorkerCompiler,
    bind(RenderCompiler).toAlias(WebWorkerCompiler),
    bind(ON_WEB_WORKER).toValue(true),
    RenderViewWithFragmentsStore,
    RenderProtoViewRefStore,
    bind(ExceptionHandler).toFactory(() => new ExceptionHandler(new PrintLogger()), []),
    WebWorkerXHRImpl,
    bind(XHR).toAlias(WebWorkerXHRImpl),
    bind(AppRootUrl).toValue(new AppRootUrl(initData['rootUrl'])),
    WebWorkerEventDispatcher,
    FORM_BINDINGS
  ];
}

export function bootstrapWebWorkerCommon(appComponentType: Type, bus: MessageBus,
                                         appBindings: Array<Type | Binding | any[]> = null):
    Promise<ComponentRef> {
  var bootstrapProcess: PromiseCompleter<any> = PromiseWrapper.completer();
  var appPromise = platform().asyncApplication((zone: NgZone) => {
    // TODO(rado): prepopulate template cache, so applications with only
    // index.html and main.js are possible.
    //
    bus.attachToZone(zone);
    bus.initChannel(SETUP_CHANNEL, false);

    var subscription: any;
    var emitter = bus.from(SETUP_CHANNEL);
    subscription = ObservableWrapper.subscribe(emitter, (message: StringMap<string, any>) => {
      var bindings =
          [applicationCommonBindings(), webWorkerBindings(appComponentType, bus, message)];
      if (isPresent(appBindings)) {
        bindings.push(appBindings);
      }
      bootstrapProcess.resolve(bindings);
      ObservableWrapper.dispose(subscription);
    });

    ObservableWrapper.callNext(bus.to(SETUP_CHANNEL), "ready");
    return bootstrapProcess.promise;
  });
  return PromiseWrapper.then(appPromise, (app) => app.bootstrap(appComponentType));
}
