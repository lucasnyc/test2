import { Stash } from './stash';
import { PyControl } from './py_control';
import { PyEnvironment } from './py_environment';
import { CseError } from './error';
import { PyNode } from './py_types';
import { NativeStorage } from '../types';
import { StmtNS } from '../ast-types';
export declare class PyContext {
    control: PyControl;
    stash: Stash;
    output: string;
    errors: CseError[];
    runtime: {
        break: boolean;
        debuggerOn: boolean;
        isRunning: boolean;
        environmentTree: EnvTree;
        environments: PyEnvironment[];
        nodes: PyNode[];
        control: PyControl | null;
        stash: Stash | null;
        objectCount: number;
        envStepsTotal: number;
        breakpointSteps: number[];
        changepointSteps: number[];
    };
    /**
     * Used for storing the native context and other values
     */
    nativeStorage: NativeStorage;
    constructor(program?: StmtNS.Stmt, context?: PyContext);
    createGlobalEnvironment: () => PyEnvironment;
    createEmptyRuntime: () => {
        break: boolean;
        debuggerOn: boolean;
        isRunning: boolean;
        environmentTree: EnvTree;
        environments: never[];
        value: undefined;
        nodes: never[];
        control: null;
        stash: null;
        objectCount: number;
        envSteps: number;
        envStepsTotal: number;
        breakpointSteps: never[];
        changepointSteps: never[];
    };
    reset(program?: StmtNS.Stmt): void;
    copy(): PyContext;
    private copyEnvironment;
}
export declare class EnvTree {
    private _root;
    private map;
    get root(): EnvTreeNode | null;
    insert(environment: PyEnvironment): void;
    getTreeNode(environment: PyEnvironment): EnvTreeNode | undefined;
}
export declare class EnvTreeNode {
    readonly environment: PyEnvironment;
    parent: EnvTreeNode | null;
    private _children;
    constructor(environment: PyEnvironment, parent: EnvTreeNode | null);
    get children(): EnvTreeNode[];
    resetChildren(newChildren: EnvTreeNode[]): void;
    private clearChildren;
    private addChildren;
    addChild(newChild: EnvTreeNode): EnvTreeNode;
}
