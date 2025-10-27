import * as es from 'estree';
import { Context } from '../cse-machine/context';
export declare enum ErrorType {
    IMPORT = "Import",
    RUNTIME = "Runtime",
    SYNTAX = "Syntax",
    TYPE = "Type"
}
export declare enum ErrorSeverity {
    WARNING = "Warning",
    ERROR = "Error"
}
export interface SourceError {
    type: ErrorType;
    severity: ErrorSeverity;
    location: es.SourceLocation;
    explain(): string;
    elaborate(): string;
}
export declare const UNKNOWN_LOCATION: es.SourceLocation;
export declare class RuntimeSourceError implements SourceError {
    type: ErrorType;
    severity: ErrorSeverity;
    location: es.SourceLocation;
    message: string;
    constructor(node?: es.Node);
    explain(): string;
    elaborate(): string;
}
export declare function createErrorIndicator(snippet: string, errorOp?: string): string;
export declare class TypeConcatenateError extends RuntimeSourceError {
    constructor(source: string, node: es.Node, wrongType: string);
}
export declare class UnsupportedOperandTypeError extends RuntimeSourceError {
    constructor(source: string, node: es.Node, wrongType1: string, wrongType2: string, operand: string);
}
export declare class MissingRequiredPositionalError extends RuntimeSourceError {
    private functionName;
    private missingParamCnt;
    private missingParamName;
    constructor(source: string, node: es.Node, functionName: string, params: any, args: any, variadic: boolean);
    private joinWithCommasAndAnd;
}
export declare class TooManyPositionalArgumentsError extends RuntimeSourceError {
    private functionName;
    private expectedCount;
    private givenCount;
    constructor(source: string, node: es.Node, functionName: string, params: any, args: any, variadic: boolean);
}
export declare class ZeroDivisionError extends RuntimeSourceError {
    constructor(source: string, node: es.Node, context: Context);
}
export declare class StepLimitExceededError extends RuntimeSourceError {
    constructor(source: string, node: es.Node, context: Context);
}
export declare class ValueError extends RuntimeSourceError {
    constructor(source: string, node: es.Node, context: Context, functionName: string);
}
export declare class TypeError extends RuntimeSourceError {
    constructor(source: string, node: es.Node, context: Context, originalType: string, targetType: string);
}
export declare class SublanguageError extends RuntimeSourceError {
    constructor(source: string, node: es.Node, context: Context, functionName: string, chapter: string, details?: string);
}
