import { Value } from './stash';
import { Heap } from './heap';
import { PyClosure } from './py_closure';
import { PyContext } from './py_context';
import { ExprNS } from '../ast-types';
export interface Frame {
    [name: string]: any;
}
export interface PyEnvironment {
    readonly id: string;
    name: string;
    tail: PyEnvironment | null;
    callExpression?: ExprNS.Call;
    head: Frame;
    heap: Heap;
    thisContext?: Value;
    closure?: PyClosure;
}
export declare const uniqueId: (context: PyContext) => string;
export declare const createEnvironment: (context: PyContext, closure: PyClosure, args: Value[], callExpression: ExprNS.Call) => PyEnvironment;
export declare const createSimpleEnvironment: (context: PyContext, name: string, tail?: PyEnvironment | null) => PyEnvironment;
export declare const createProgramEnvironment: (context: PyContext, isPrelude: boolean) => PyEnvironment;
export declare const createBlockEnvironment: (context: PyContext, name?: string) => PyEnvironment;
export declare const currentEnvironment: (context: PyContext) => PyEnvironment;
export declare const popEnvironment: (context: PyContext) => PyEnvironment | undefined;
export declare const pushEnvironment: (context: PyContext, environment: PyEnvironment) => void;
