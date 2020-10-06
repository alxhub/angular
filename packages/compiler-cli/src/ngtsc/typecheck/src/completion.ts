// import {TmplAstElement, TmplAstReference, TmplAstTemplate, TmplAstVariable} from
// '@angular/compiler/src/compiler';

// import {DirectiveSymbol, InputBindingSymbol, ShimLocation} from '../api';

// export interface GlobalCompletion {
//   componentContext: ShimLocation;
//   templateContext: Map<string, Completion>;
// }

// enum CompletionKind {
//   Input,
//   Output,
// }

// interface ReferenceCompletion {
//   kind: CompletionKind.Reference;
//   node: TmplAstReference;
// }

// interface VariableCompletion {
//   kind: CompletionKind.Variable;
//   node: TmplAstVariable;
// }

// interface BindingCompletion {
//   kind: CompletionKind.Input|CompletionKind.Output;
//   name: string;
//   directive: DirectiveSymbol;
//   bananaInABox: boolean;
// }

// export abstract class CompletionEngine {
//   abstract getGlobalCompletions(context: TmplAstTemplate|null): GlobalCompletion;
//   abstract getBindingCompletions(el: TmplAstElement|TmplAstTemplate): InputCompletion
//       |OutputCompletion;
// }

export const module = true;