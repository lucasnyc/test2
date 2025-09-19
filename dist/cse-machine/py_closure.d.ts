import { StmtNS, ExprNS } from '../ast-types';
import { PyEnvironment } from './py_environment';
import { PyContext } from './py_context';
import { StatementSequence } from './py_types';
import { PyControlItem } from './py_control';
/**
 * Represents a python closure, the class is a runtime representation of a function.
 * Bundles the function's code (AST node) with environment in which its defined.
 * When Closure is called, a new environment will be created whose parent is the 'Environment' captured
 */
export declare class PyClosure {
    readonly id: string;
    /** AST node for function, either a 'def' or 'lambda' */
    node: StmtNS.FunctionDef | ExprNS.Lambda;
    /** Environment captures at time of function's definition, key for lexical scoping */
    environment: PyEnvironment;
    context: PyContext;
    readonly predefined: boolean;
    originalNode?: StmtNS.FunctionDef | ExprNS.Lambda;
    constructor(node: StmtNS.FunctionDef | ExprNS.Lambda, environment: PyEnvironment, context: PyContext, predefined?: boolean);
    /**
     * Creates closure for FunctionDef
     */
    static makeFromFunctionDef(node: StmtNS.FunctionDef, environment: PyEnvironment, context: PyContext): PyClosure;
    /**
     * Creates closure for Lambda
     */
    static makeFromLambda(node: ExprNS.Lambda, environment: PyEnvironment, context: PyContext): PyClosure;
}
/**
* Type guard to check if a control item is a StatementSequence.
*/
export declare const isStatementSequence: (node: PyControlItem) => node is StatementSequence;
