import {TmplAstBoundaryBlock, TmplAstBoundaryErrorBlock} from '@angular/compiler';
import ts from 'typescript';
import {TcbOp} from './base';
import type {Scope} from './scope';
import type {Context} from './context';
import {tcbExpression} from './expression';
import {TcbBlockVariableOp} from './variables';

/**
 * A `TcbOp` which renders a `boundary` template block.
 */
export class TcbBoundaryOp extends TcbOp {
  constructor(
    private tcb: Context,
    private scope: Scope,
    private block: TmplAstBoundaryBlock,
  ) {
    super();
  }

  override get optional() {
    return false;
  }

  override execute(): null {
    const checkBody = this.tcb.env.config.checkControlFlowBodies;
    
    // 1. Render try body
    const tryBodyScope = this.scope.createChildScope(this.scope, null, checkBody ? this.block.children : [], null);
    const tryBlock = ts.factory.createBlock(tryBodyScope.render());

    // 2. Render catch clause if there are error blocks
    if (this.block.errorBlocks.length > 0) {
      // Create statement lists to place inside catch
      // catch (err) { ... }
      const errParam = ts.factory.createIdentifier('err');
      const catchParam = ts.factory.createVariableDeclaration(
        errParam,
        undefined,
        undefined, // unknown
      );

      // Create an inner block where we execute the chain of error branches
      const innerCatchStatements: ts.Statement[] = [];
      const branchStmt = this.generateCatchBranch(0, errParam);
      if (branchStmt) {
        innerCatchStatements.push(...branchStmt);
      }

      const catchBlock = ts.factory.createBlock(innerCatchStatements);
      const catchClause = ts.factory.createCatchClause(catchParam, catchBlock);
      const tryStatement = ts.factory.createTryStatement(
         tryBlock,
         catchClause,
         undefined,
      );
      this.scope.addStatement(tryStatement);
    } else {
       this.scope.addStatement(tryBlock);
    }
    return null;
  }

  private generateCatchBranch(index: number, errParam: ts.Identifier): ts.Statement[] {
    const errorBlock = this.block.errorBlocks[index];
    if (!errorBlock) {
      return [];
    }

    const checkBody = this.tcb.env.config.checkControlFlowBodies;

    // Create a outerScope for the condition evaluation that declares the alias
    const outerScope = this.scope.createChildScope(this.scope, errorBlock, [], null);

    // Render alias declarations for the condition context
    const resultStatements: ts.Statement[] = [];
    outerScope.render().forEach((stmt) => resultStatements.push(stmt));

    // Evaluate the condition
    let expression: ts.Expression | null = null;
    if (errorBlock.expression) {
       expression = tcbExpression(errorBlock.expression, this.tcb, outerScope);
    }

    // Body block scope inherits from outerScope (so it has the alias) but passes null as node context
    // to prevent re-declaring the alias inside the block body.
    const bodyScope = this.scope.createChildScope(outerScope, null, checkBody ? errorBlock.children : [], null);
    const bodyBlock = ts.factory.createBlock(bodyScope.render());

    const nextBranchStatements = this.generateCatchBranch(index + 1, errParam);

    if (expression) {
       const ifStmt = ts.factory.createIfStatement(
          expression,
          bodyBlock,
          nextBranchStatements.length > 0 ? ts.factory.createBlock(nextBranchStatements) : undefined
       );
       resultStatements.push(ifStmt);
    } else {
       // If no expression, it's a general fallback block.
       resultStatements.push(bodyBlock);
    }
    return resultStatements;
  }
}
