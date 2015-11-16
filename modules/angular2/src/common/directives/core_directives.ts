import {CONST_EXPR, Type} from 'angular2/src/facade/lang';
import {NgClass} from './ng_class';
import {NgFor} from './ng_for';
import {NgIf} from './ng_if';
import {NgStyle} from './ng_style';
import {NgSwitch, NgSwitchWhen, NgSwitchDefault} from './ng_switch';

/**
 * A collection of Angular core directives that are likely to be used in each and every Angular
 * application.
 *
 * This collection can be used to quickly enumerate all the built-in directives in the `directives`
 * property of the `@Component` or `@View` annotations.
 *
 * ### Example
 *
 * Instead of writing:
 *
 * {@example core/ts/core_directives/without.ts region='without'}
 * 
 * one could import all the core directives at once:
 *
 * {@example core/ts/core_directives/with.ts region='with'}
 */
export const CORE_DIRECTIVES: Type[] =
    CONST_EXPR([NgClass, NgFor, NgIf, NgStyle, NgSwitch, NgSwitchWhen, NgSwitchDefault]);
