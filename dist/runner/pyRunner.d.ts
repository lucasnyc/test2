import { IOptions } from "..";
import { RecursivePartial, Result } from "../types";
import { StmtNS } from "../ast-types";
import { PyContext } from "../cse-machine/py_context";
type Stmt = StmtNS.Stmt;
export declare function PyRunCSEMachine(code: string, program: Stmt, context: PyContext, options?: RecursivePartial<IOptions>): Promise<Result>;
export {};
