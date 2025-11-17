// Simplified error implementation
// TODO: make it more correct in the future after the import is working

export abstract class ModuleError extends Error {
    public abstract type: string;
    constructor(message: string) {
    super(message);
    }
}

// Error for when a module cannot be fetched from the network
export class ModuleConnectionError extends ModuleError {
    public type = 'ModuleConnectionError';
    constructor() {
    super('Unable to connect to module servers');
    }
}

// Error for when something goes wrong inside a module's code
export class ModuleInternalError extends ModuleError {
    public type = 'ModuleInternalError';
    constructor(public moduleName: string, public error: any) {
    super(`Error in module ${moduleName}:\n${error.message}`);
    }
}