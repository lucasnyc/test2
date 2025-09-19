import { ErrorSeverity, ErrorType, SourceError, SourceLocation } from '../types';
import { Token } from '../tokenizer';
export declare const UNKNOWN_LOCATION: SourceLocation;
interface Locatable {
    startToken: Token;
    endToken: Token;
}
export declare abstract class PyRuntimeSourceError implements SourceError {
    type: ErrorType;
    severity: ErrorSeverity;
    location: SourceLocation;
    message: string;
    constructor(node?: Locatable);
    explain(): string;
    elaborate(): string;
}
export {};
