import { Stack } from "./stack";
import { PyNode, Instr } from "./py_types";
import { StmtNS } from "../ast-types";
export type PyControlItem = (PyNode | Instr) & {
    isEnvDependent?: boolean;
    skipEnv?: boolean;
};
export declare class PyControl extends Stack<PyControlItem> {
    private numEnvDependentItems;
    constructor(program?: StmtNS.Stmt);
    canAvoidEnvInstr(): boolean;
    getNumEnvDependentItems(): number;
    copy(): PyControl;
}
