import { PyContext } from './cse-machine/py_context';
import { Value } from "./cse-machine/stash";
export declare function toPythonFloat(num: number): string;
export declare function toPythonString(obj: Value): string;
export declare class BuiltInFunctions {
    static print(context: PyContext, ...args: Value[]): Value;
    static _int(context: PyContext, ...args: Value[]): Value;
}
export declare const builtIns: Map<string, (...args: any[]) => any>;
