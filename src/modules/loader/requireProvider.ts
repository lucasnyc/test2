import type { PyContext } from "../../cse-machine/py_context";
import type { ModuleFunctions } from '../moduleTypes';

export type RequireProvider = (id: string) => ModuleFunctions | undefined;

export const getRequireProvider = (context: PyContext): RequireProvider => {
    return (id: string) => {
    return undefined;
    };
};
