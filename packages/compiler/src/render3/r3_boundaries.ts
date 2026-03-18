import {AST} from '../expression_parser/ast';
import * as html from '../ml_parser/ast';
import {ParseError, ParseSourceSpan} from '../parse_util';
import {BindingParser} from '../template_parser/binding_parser';

import * as t from './r3_ast';

/** Pattern used to identify a boundary `let` parameter. */
const LET_PATTERN = /^(let\s+)(.*)/;

/** Pattern used to identify a boundary `when` expression. */
const WHEN_PATTERN = /^(when\s+)(.*)/;

/** Pattern used to validate a JavaScript identifier. */
const IDENTIFIER_PATTERN = /^[$A-Z_][0-9A-Z_$]*$/i;

export function isConnectedBoundaryErrorBlock(name: string): boolean {
  return name === 'error';
}

export function createBoundaryBlock(
  ast: html.Block,
  connectedBlocks: html.Block[],
  visitor: html.Visitor,
  bindingParser: BindingParser,
): {node: t.BoundaryBlock | null; errors: ParseError[]} {
  const errors: ParseError[] = [];
  const errorBlocks: t.BoundaryErrorBlock[] = [];

  for (const block of connectedBlocks) {
    if (block.name === 'error') {
      let errorAlias: t.Variable | null = null;
      let expression: AST | null = null;

      for (const param of block.parameters) {
        const letMatch = param.expression.match(LET_PATTERN);
        if (letMatch) {
          if (errorAlias !== null) {
            errors.push(
              new ParseError(param.sourceSpan, '@error block can only have one "let" parameter'),
            );
          } else {
            const name = letMatch[2].trim();
            if (IDENTIFIER_PATTERN.test(name)) {
              const variableStart = param.sourceSpan.start.moveBy(letMatch[1].length);
              const variableSpan = new ParseSourceSpan(
                variableStart,
                variableStart.moveBy(name.length),
              );
              errorAlias = new t.Variable(name, name, variableSpan, variableSpan);
            } else {
              errors.push(
                new ParseError(
                  param.sourceSpan,
                  '"let" parameter must be a valid JavaScript identifier',
                ),
              );
            }
          }
          continue;
        }

        const whenMatch = param.expression.match(WHEN_PATTERN);
        if (whenMatch) {
          if (expression !== null) {
            errors.push(
              new ParseError(param.sourceSpan, '@error block can only have one "when" expression'),
            );
          } else {
            const start = param.expression.indexOf(whenMatch[2]);
            const end = start + whenMatch[2].length;
            const expressionAST = bindingParser.parseBinding(
              param.expression.slice(start, end),
              false,
              param.sourceSpan,
              param.sourceSpan.start.offset + start,
            );
            expression = expressionAST.ast;
          }
          continue;
        }

        errors.push(
          new ParseError(
            param.sourceSpan,
            `Unrecognized @error block parameter "${param.expression}"`,
          ),
        );
      }

      errorBlocks.push(
        new t.BoundaryErrorBlock(
          html.visitAll(visitor, block.children, block.children),
          errorAlias,
          expression,
          block.nameSpan,
          block.sourceSpan,
          block.startSourceSpan,
          block.endSourceSpan,
          block.i18n,
        ),
      );
    } else {
      errors.push(
        new ParseError(block.sourceSpan, `Unrecognized @boundary connected block @${block.name}`),
      );
    }
  }

  const node = new t.BoundaryBlock(
    html.visitAll(visitor, ast.children, ast.children),
    errorBlocks,
    ast.nameSpan,
    ast.sourceSpan,
    ast.startSourceSpan,
    ast.endSourceSpan,
    ast.i18n,
  );

  return {node, errors};
}
