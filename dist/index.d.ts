export * from './errors';
import { RecursivePartial, Result } from "./types";
export * from './errors';
import { StmtNS } from "./ast-types";
import { PyContext } from "./cse-machine/py_context";
type Stmt = StmtNS.Stmt;
export interface IOptions {
    isPrelude: boolean;
    envSteps: number;
    stepLimit: number;
}
export declare function runPyAST(code: string, context: PyContext, options?: RecursivePartial<IOptions>): Promise<Stmt>;
export declare function PyRunInContext(code: string, context: PyContext, options?: RecursivePartial<IOptions>): Promise<Result>;
export * from "./errors";
