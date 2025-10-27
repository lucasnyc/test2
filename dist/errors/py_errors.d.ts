import { ExprNS } from '../ast-types';
import { PyRuntimeSourceError } from './py_runtimeSourceError';
import { PyContext } from '../cse-machine/py_context';
export declare function createErrorIndicator(snippet: string, errorPos: number): string;
export declare class UnsupportedOperandTypeError extends PyRuntimeSourceError {
    constructor(source: string, node: ExprNS.Expr, wrongType1: string, wrongType2: string, operand: string);
}
export declare class MissingRequiredPositionalError extends PyRuntimeSourceError {
    private functionName;
    private missingParamCnt;
    private missingParamName;
    constructor(source: string, node: ExprNS.Expr, functionName: string, params: any, args: any, variadic: boolean);
    private joinWithCommasAndAnd;
}
export declare class TooManyPositionalArgumentsError extends PyRuntimeSourceError {
    private functionName;
    private expectedCount;
    private givenCount;
    constructor(source: string, node: ExprNS.Expr, functionName: string, params: any, args: any, variadic: boolean);
}
export declare class ZeroDivisionError extends PyRuntimeSourceError {
    constructor(source: string, node: ExprNS.Expr, context: PyContext);
}
export declare class UnboundLocalError extends PyRuntimeSourceError {
    constructor(source: string, name: string, node: ExprNS.Expr);
}
export declare class NameError extends PyRuntimeSourceError {
    constructor(source: string, name: string, node: ExprNS.Variable);
}
