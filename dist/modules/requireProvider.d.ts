import { PyContext } from "../cse-machine/py_context";
/**
 * Returns a function that simulates the job of Node's `require`. The require
 * provider is then used by Source modules to access the context and py-slang standard
 * library
 */
export declare const getRequireProvider: (context: PyContext) => (x: string) => any;
export type RequireProvider = ReturnType<typeof getRequireProvider>;
