export declare abstract class ModuleError extends Error {
    abstract type: string;
    constructor(message: string);
}
export declare class ModuleConnectionError extends ModuleError {
    type: string;
    constructor();
}
export declare class ModuleInternalError extends ModuleError {
    moduleName: string;
    error: any;
    type: string;
    constructor(moduleName: string, error: any);
}
