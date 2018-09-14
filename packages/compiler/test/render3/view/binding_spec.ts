import * as a from '../../../src/render3/r3_ast';
import * as e from '../../../src/expression_parser/ast';

import {Target, Directive} from '../../../src/render3/view/t2_api';
import {R3TargetBinder} from '../../../src/render3/view/t2_binder';
import {parseTemplate} from '../../../src/render3/view/template';
import {SelectorMatcher, CssSelector} from '../../../src/selector';
import {findExpression} from './util';

function makeSelectorMatcher(): SelectorMatcher<Directive<string>> {
  const matcher = new SelectorMatcher<Directive<string>>();
  matcher.addSelectables(
    CssSelector.parse("[ngFor][ngForOf]"),
    {
      directive: 'NgFor',
      name: 'NgFor',
      exportAs: null,
      inputs: ['ngForOf'],
      outputs: [],
      isPrimary: false,
    }
  );
  return matcher;
}

fdescribe('t2 binding', () => {
  it('should bind a simple template', () => {
    const template = parseTemplate('<div *ngFor="let item of items">{{item.name}}</div>', '', {}, '');
    const binder = new R3TargetBinder(new SelectorMatcher<Directive<null>>());
    const res = binder.bind({template: template.nodes});

    const itemBinding = (findExpression(template.nodes, '{{item.name}}')! as e.Interpolation).expressions[0] as e.PropertyRead;
    const item = itemBinding.receiver;
    const itemTarget = res.getExpressionTarget(item);
    if (!(itemTarget instanceof a.Variable)) {
      return fail("Expected item to point to a Variable");
    }
    expect(itemTarget.value).toBe('$implicit');
    const itemTemplate = res.getTemplateOfSymbol(itemTarget);
    expect(itemTemplate).not.toBeNull();
    expect(res.getNestingLevel(itemTemplate!)).toBe(1);
  });

  it('should match directives when binding a simple template', () => {
    const template = parseTemplate('<div *ngFor="let item of items">{{item.name}}</div>', '', {}, '');
    const binder = new R3TargetBinder(makeSelectorMatcher());
    const res = binder.bind({template: template.nodes});
    const tmpl = template.nodes[0] as a.Template;
    const directives = res.getDirectivesOfNode(tmpl)!;
    expect(directives).not.toBeNull();
    expect(directives.length).toBe(1);
    expect(directives[0].name).toBe('NgFor');
  });
});