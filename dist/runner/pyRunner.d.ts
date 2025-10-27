import { PyContext } from "../cse-machine/py_context";
import { RecursivePartial, Result } from "../types";
import { StmtNS } from "../ast-types";
type Stmt = StmtNS.Stmt;
export interface IOptions {
    isPrelude: boolean;
    envSteps: number;
    stepLimit: number;
}
export declare function runPyAST(code: string, variant?: number, doValidate?: boolean): Promise<Stmt>;
export declare function PyRunInContext(code: string, context: PyContext, options?: RecursivePartial<IOptions>): Promise<Result>;
export declare function PyRunCSEMachine(code: string, program: Stmt, context: PyContext, options?: RecursivePartial<IOptions>): Promise<Result>;
export {};
