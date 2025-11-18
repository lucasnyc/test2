import loadSourceModules from 'js-slang/dist/modules/loader';
import createContext from 'js-slang/dist/createContext';
import { Chapter, Context, Variant } from 'js-slang/dist/types';
import { JSRegistry } from './types';

/**
 * A lightweight function to quickly check if a Python script contains any
 * 'from ... import ...' statements.
 * @param pythonCode The Python source code.
 * @returns True if import statements are found, otherwise false.
 */
export function scanForImports(pythonCode: string): boolean {
  return /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g.test(pythonCode);
}

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

    // Create a temporary, lightweight js-slang context for the loading operation.
    // `createContext` is confirmed as the correct function for this.
    const context: Context = createContext(Chapter.SOURCE_4, Variant.DEFAULT);

    try {
      // 1. Tell js-slang to fetch and load the modules into the context.
      // This function will automatically use the URL that the frontend
      // has already configured via `setModulesStaticURL`.
      await loadSourceModules(moduleNames, context, false); // `false` for not loading tabs
    } catch (error) {
        console.error("An error occurred during the loading of source modules.", error);
        return registry; // Return empty or partial registry on failure.
    }

    // 2. Extract the loaded modules from the context's environment.
    for (const moduleName of moduleNames) {
      try {
        // Correctly access the module from the head of the global environment.
        const moduleExports = context.runtime.environments[0].head[moduleName];
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
