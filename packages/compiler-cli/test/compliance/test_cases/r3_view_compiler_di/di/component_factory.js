
MyComponent.ɵfac = function MyComponent_Factory(__ngFactoryType__) {
  return new (__ngFactoryType__ || MyComponent)(
    $r3$.ɵɵinjectAttribute('name'),
    $r3$.ɵɵinjectAttribute(dynamicAttrName()),
    $r3$.ɵɵinject(MyService),
    $r3$.ɵɵinject(MyService, 1),
    $r3$.ɵɵinject(MyService, 2),
    $r3$.ɵɵinject(MyService, 4),
    $r3$.ɵɵinject(MyService, 8),
    $r3$.ɵɵinject(MyService, 10)
  );
}
