import { PyContext } from '../cse-machine/py_context';
export declare let MODULES_STATIC_URL: string;
export declare function setModulesStaticURL(url: string): void;
export declare function loadModuleBundle(moduleName: string, context: PyContext): Promise<any>;
