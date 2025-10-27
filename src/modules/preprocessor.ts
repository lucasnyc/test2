import { PyContext } from '../cse-machine/py_context';
import { StmtNS } from '../ast-types';
import { IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { pyDefineVariable } from '../cse-machine/py_utils';
import { loadModuleBundle } from './loader';
import { PyDataHandler } from '../conductor/PyDataHandler';

type Stmt = StmtNS.Stmt;

function findImportedModules(program: Stmt): string[] {
  const moduleNames = new Set<string>();

  function traverse(node: any) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (node.constructor.name === 'FromImport') {
      const importNode = node as StmtNS.FromImport;
      moduleNames.add(importNode.module.lexeme);
    }

    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else {
          traverse(child);
        }
      }
    }
  }
  traverse(program);
  return Array.from(moduleNames);
}
export async function preloadModules(context: PyContext, ast: Stmt) {
    const conductor = context.nativeStorage.conductor as IRunnerPlugin | undefined;

    if (!conductor) {
        return;
    }

    const moduleNames = findImportedModules(ast);
    if (moduleNames.length === 0) {
        return;
    }

    const rawModules = await Promise.all(
        moduleNames.map(name => loadModuleBundle(name, context))
    );

    const dataHandler = new PyDataHandler(context);
    const loadedModules: Record<string, any> = {};

    for (let i = 0; i < moduleNames.length; i++) {
        const moduleName = moduleNames[i];
        const rawModule = rawModules[i];
        const processedModule: Record<string, any> = {};

        for (const funcName in rawModule) {
        const signature = { args: [], returnType: 0 };
        const typedValue = await dataHandler.closure_make(signature, rawModule[funcName]);
        processedModule[funcName] = typedValue.value;
        }
        loadedModules[moduleName] = processedModule;
    }

    const globalEnv = context.runtime.environments[context.runtime.environments.length - 1];
    for (const moduleName in loadedModules) {
        pyDefineVariable(context, moduleName, loadedModules[moduleName], globalEnv);
    }
}