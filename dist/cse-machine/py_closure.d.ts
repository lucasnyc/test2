import { StmtNS, ExprNS } from '../ast-types';
import { PyEnvironment } from './py_environment';
import { PyContext } from './py_context';
import { StatementSequence } from './py_types';
import { PyControlItem } from './py_control';
import { IFunctionSignature } from '@sourceacademy/conductor/types';
import { Value } from './stash';
/**
 * Represents a python closure, the class is a runtime representation of a function.
 * Bundles the function's code (AST node) with environment in which its defined.
 * When Closure is called, a new environment will be created whose parent is the 'Environment' captured
 */
export declare class PyClosure {
    readonly type = "PyClosure";
    readonly id: string;
    /** AST node for function, either a 'def' or 'lambda' */
    node: StmtNS.FunctionDef | ExprNS.Lambda;
    /** Environment captures at time of function's definition, key for lexical scoping */
    environment: PyEnvironment;
    context: PyContext;
    readonly predefined: boolean;
    originalNode?: StmtNS.FunctionDef | ExprNS.Lambda;
    /** Stores local variables for scope check */
    localVariables: Set<string>;
    constructor(node: StmtNS.FunctionDef | ExprNS.Lambda, environment: PyEnvironment, context: PyContext, predefined?: boolean, localVariables?: Set<string>);
    /**
     * Creates closure for FunctionDef
     */
    static makeFromFunctionDef(node: StmtNS.FunctionDef, environment: PyEnvironment, context: PyContext, localVariables: Set<string>): PyClosure;
    /**
     * Creates closure for Lambda
     */
    static makeFromLambda(node: ExprNS.Lambda, environment: PyEnvironment, context: PyContext, localVariables: Set<string>): PyClosure;
}
/**
* Type guard to check if a control item is a StatementSequence.
*/
export declare const isStatementSequence: (node: PyControlItem) => node is StatementSequence;
/**
 * Represents a Javascript function that has been imported into js-slang from modules/
 * Wraps the JS function and marshal data between two languages
 * 1. Arguments from py-slang is marshalled to JS values
 * 2. Function call
 * 3. Return value from JS is marshalled back into py-slang value
 */
export declare class JsClosure {
    signature: IFunctionSignature<any, any>;
    func: (...args: any[]) => any;
    private context;
    readonly type = "JsClosure";
    readonly id: string;
    constructor(signature: IFunctionSignature<any, any>, func: (...args: any[]) => any, context: PyContext);
    call(args: Value[]): Value;
}
