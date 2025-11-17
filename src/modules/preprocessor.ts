import { PyContext } from '../cse-machine/py_context';
import { StmtNS, ImportAlias } from '../ast-types';
import { IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { pyDefineVariable } from '../cse-machine/py_utils';
import { loadModuleBundle } from './loader';
import { JsClosure } from '../cse-machine/py_closure';

type Stmt = StmtNS.Stmt;

function findImportedNodes(program: Stmt): StmtNS.FromImport[] {
  const importNodes: StmtNS.FromImport[] = [];

  function traverse(node: any) {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node instanceof StmtNS.FromImport) {
      importNodes.push(node);
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
  return importNodes;
}
export async function preloadModules(context: PyContext, ast: Stmt) {
    const conductor = context.nativeStorage.conductor as IRunnerPlugin | undefined;

    if (!conductor) {
        return;
    }

    const importNodes = findImportedNodes(ast);
    if (importNodes.length === 0) {
        return;
    }
    const moduleNamesToLoad = new Set(importNodes.map(node => node.module.lexeme));

    const rawModules = await Promise.all(
        Array.from(moduleNamesToLoad).map(name => loadModuleBundle(name, context))
    );

    const loadedModules: Map<string, Record<string, any>> = new Map();
    let i = 0
    for (const moduleName of moduleNamesToLoad) {
      const rawModule = rawModules[i++];
      const processedModule: Record<string, any> = {};

      for (const funcName in rawModule) {
        const signature = { args: [], returnType: 0};
        processedModule[funcName] = new JsClosure(signature, rawModule[funcName], context);
      }
      loadedModules.set(moduleName, processedModule);
    }
    
    const globalEnv = context.runtime.environments[0];
    for (const importNode of importNodes) {
      const moduleName = importNode.module.lexeme;
      const moduleContents = loadedModules.get(moduleName);

      if (!moduleContents) {
        continue
      }
      for (const alias of importNode.names) {
        const originalName = alias.name.lexeme;

        if (originalName in moduleContents) {
          const valueToImport = moduleContents[originalName];
          const nameInScope = alias.alias ? alias.alias.lexeme : originalName;

          pyDefineVariable(context, nameInScope, valueToImport, globalEnv);
        } else {
            throw new Error(`cant import name '${originalName}' from '${moduleName}'`);
        }
      }
    }
}