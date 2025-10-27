import { PyContext } from '../cse-machine/py_context';
import { StmtNS } from '../ast-types';
type Stmt = StmtNS.Stmt;
export declare function preloadModules(context: PyContext, ast: Stmt): Promise<void>;
export {};
