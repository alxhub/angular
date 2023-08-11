function MyComponent_ng_template_2_ng_template_2_ng_template_1_Template(rf, ctx) {
  if (rf & 1) {
    $r3$.ɵɵi18n(0, 0, 3);
  }
  if (rf & 2) {
    const $ctx_r2$ = $r3$.ɵɵnextContext(3);
    $r3$.ɵɵi18nExp($ctx_r2$.valueC);
    $r3$.ɵɵi18nApply(0);
  }
}
function MyComponent_ng_template_2_ng_template_2_Template(rf, ctx) {
  if (rf & 1) {
    $r3$.ɵɵi18nStart(0, 0, 2);
    $r3$.ɵɵtemplate(1, MyComponent_ng_template_2_ng_template_2_ng_template_1_Template, 1, 1, "ng-template");
    $r3$.ɵɵi18nEnd();
  }
  if (rf & 2) {
    const $ctx_r1$ = $r3$.ɵɵnextContext(2);
    $r3$.ɵɵadvance(1);
    $r3$.ɵɵi18nExp($ctx_r1$.valueB);
    $r3$.ɵɵi18nApply(0);
  }
}
…
function MyComponent_ng_template_2_Template(rf, ctx) {
  if (rf & 1) {
    $r3$.ɵɵi18nStart(0, 0, 1);
    $r3$.ɵɵpipe(1, "uppercase");
    $r3$.ɵɵtemplate(2, MyComponent_ng_template_2_ng_template_2_Template, 2, 1, "ng-template");
    $r3$.ɵɵi18nEnd();
  }
  if (rf & 2) {
    const $ctx_r0$ = $r3$.ɵɵnextContext();
    $r3$.ɵɵadvance(2);
    $r3$.ɵɵi18nExp($r3$.ɵɵpipeBind1(1, 1, $ctx_r0$.valueA));
    $r3$.ɵɵi18nApply(0);
  }
}
…
decls: 3,
  vars: 0,
    consts: function() {
      let i18n_0; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
        /**
         * @suppress {msgDescriptions}
         */
        const MSG_EXTERNAL_4054819503343192023$$NESTED_TEMPLATES_TS__1 = goog.getMsg("{$startTagNgTemplate} Template A: {$interpolation} {$startTagNgTemplate} Template B: {$interpolation_1} {$startTagNgTemplate} Template C: {$interpolation_2} {$closeTagNgTemplate}{$closeTagNgTemplate}{$closeTagNgTemplate}", { "startTagNgTemplate": "[\uFFFD*2:1\uFFFD|\uFFFD*2:2\uFFFD|\uFFFD*1:3\uFFFD]", "closeTagNgTemplate": "[\uFFFD/*1:3\uFFFD|\uFFFD/*2:2\uFFFD|\uFFFD/*2:1\uFFFD]", "interpolation": "\uFFFD0:1\uFFFD", "interpolation_1": "\uFFFD0:2\uFFFD", "interpolation_2": "\uFFFD0:3\uFFFD" }, { original_code: { "startTagNgTemplate": "<ng-template>", "closeTagNgTemplate": "</ng-template>", "interpolation": "{{ valueA | uppercase }}", "interpolation_1": "{{ valueB }}", "interpolation_2": "{{ valueC }}" } });
        i18n_0 = MSG_EXTERNAL_4054819503343192023$$NESTED_TEMPLATES_TS__1;
      }
      else {
        i18n_0 = $localize`${"[\uFFFD*2:1\uFFFD|\uFFFD*2:2\uFFFD|\uFFFD*1:3\uFFFD]"}:START_TAG_NG_TEMPLATE: Template A: ${"\uFFFD0:1\uFFFD"}:INTERPOLATION: ${"[\uFFFD*2:1\uFFFD|\uFFFD*2:2\uFFFD|\uFFFD*1:3\uFFFD]"}:START_TAG_NG_TEMPLATE: Template B: ${"\uFFFD0:2\uFFFD"}:INTERPOLATION_1: ${"[\uFFFD*2:1\uFFFD|\uFFFD*2:2\uFFFD|\uFFFD*1:3\uFFFD]"}:START_TAG_NG_TEMPLATE: Template C: ${"\uFFFD0:3\uFFFD"}:INTERPOLATION_2: ${"[\uFFFD/*1:3\uFFFD|\uFFFD/*2:2\uFFFD|\uFFFD/*2:1\uFFFD]"}:CLOSE_TAG_NG_TEMPLATE:${"[\uFFFD/*1:3\uFFFD|\uFFFD/*2:2\uFFFD|\uFFFD/*2:1\uFFFD]"}:CLOSE_TAG_NG_TEMPLATE:${"[\uFFFD/*1:3\uFFFD|\uFFFD/*2:2\uFFFD|\uFFFD/*2:1\uFFFD]"}:CLOSE_TAG_NG_TEMPLATE:`;
      } i18n_0 = i0.ɵɵi18nPostprocess(i18n_0);
      return [i18n_0];
    },
template: function MyComponent_Template(rf, ctx) {
  if (rf & 1) {
    $r3$.ɵɵelementStart(0, "div");
    $r3$.ɵɵi18nStart(1, 0);
    $r3$.ɵɵtemplate(2, MyComponent_ng_template_2_Template, 3, 3, "ng-template");
    $r3$.ɵɵi18nEnd();
    $r3$.ɵɵelementEnd();
  }
}
