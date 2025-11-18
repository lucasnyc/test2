import loadSourceModules from 'js-slang/dist/modules/loader';
import { JSRegistry } from './types';

/**
   * Scans Python code to find all `from 'module_name' import ...` statements.
   * This is a simple pre-pass and does not need a full AST parse.
   */
export class JSModuleLoader {
  private findJsModules(pythonCode: string): Set<string> {
    const importRegex = /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const modules = new Set<string>();
    let match;
    while ((match = importRegex.exec(pythonCode)) !== null) {
      modules.add(match[1]);
    }
    return modules;
  }

  /**
   * Pre-loads all JS modules found in the Python code using js-slang's built-in loader.
   * This is the primary public method of this class.
   * @param pythonCode The Python source code to be scanned for imports.
   * @returns A promise that resolves to a JSRegistry containing the raw module exports.
   */
  public async preloadModules(pythonCode: string): Promise<JSRegistry> {
    const moduleNames = this.findJsModules(pythonCode);
    if (moduleNames.size === 0) {
      return new Map(); // No imports found, return an empty registry.
    }

    const registry: JSRegistry = new Map();

    // Create a minimal 'fake' context object that satisfies the needs of loadSourceModules.
    // This avoids importing the real createContext and its heavy, non-browser-safe dependencies.
    const fakeContext: any = {
      runtime: {
        environments: [{ head: {} }]
      }
    };

    try {
      // 1. Tell js-slang to fetch and load the modules into our fake context.
      await loadSourceModules(moduleNames, fakeContext, false);
    } catch (error) {
        console.error("An error occurred during the loading of source modules.", error);
        return registry; // Return empty or partial registry on failure.
    }

    // 2. Extract the loaded modules from the fake context's environment.
    for (const moduleName of moduleNames) {
      try {
        const moduleExports = fakeContext.runtime.environments[0].head[moduleName];
        if (moduleExports === undefined) {
          throw new Error(`Module '${moduleName}' was not found in the context after loading.`);
        }
        registry.set(moduleName, moduleExports);
      } catch (error) {
        console.error(`Could not find loaded module '${moduleName}' in context after loading.`, error);
      }
    }

    return registry;
  }
}
