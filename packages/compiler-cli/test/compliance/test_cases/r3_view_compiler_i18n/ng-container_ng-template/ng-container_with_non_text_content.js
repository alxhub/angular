decls: 4,
  vars: 0,
    consts: function() {
      let i18n_0; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
        /**
         * @suppress {msgDescriptions}
         */
        const MSG_EXTERNAL_5421724224363734696$$NG_CONTAINER_WITH_NON_TEXT_CONTENT_TS_1 = goog.getMsg(" Hello {$startTagNgContainer}there {$startTagStrong}!{$closeTagStrong}{$closeTagNgContainer}", { "startTagNgContainer": "\uFFFD#2\uFFFD", "startTagStrong": "\uFFFD#3\uFFFD", "closeTagStrong": "\uFFFD/#3\uFFFD", "closeTagNgContainer": "\uFFFD/#2\uFFFD" }, { original_code: { "startTagNgContainer": "<ng-container>", "startTagStrong": "<strong>", "closeTagStrong": "</strong>", "closeTagNgContainer": "</ng-container>" } });
        i18n_0 = MSG_EXTERNAL_5421724224363734696$$NG_CONTAINER_WITH_NON_TEXT_CONTENT_TS_1;
      }
      else {
        i18n_0 = $localize` Hello ${"\uFFFD#2\uFFFD"}:START_TAG_NG_CONTAINER:there ${"\uFFFD#3\uFFFD"}:START_TAG_STRONG:!${"\uFFFD/#3\uFFFD"}:CLOSE_TAG_STRONG:${"\uFFFD/#2\uFFFD"}:CLOSE_TAG_NG_CONTAINER:`;
      }
      return [i18n_0];
    },
template: function MyComponent_Template(rf, ctx) {
  if (rf & 1) {
    $r3$.ɵɵelementStart(0, "div");
    $r3$.ɵɵi18nStart(1, 0);
    $r3$.ɵɵelementContainerStart(2);
    $r3$.ɵɵelement(3, "strong");
    $r3$.ɵɵelementContainerEnd();
    $r3$.ɵɵi18nEnd();
    $r3$.ɵɵelementEnd();
  }
}
