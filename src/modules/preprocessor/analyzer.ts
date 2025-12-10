// py-slang/src/modules/preprocessor/analyzer.ts
// This file implements the analyzer for py-slang, validating imported names.

import type { PyContext } from '../../cse-machine/py_context';
import { UndefinedImportError } from '../errors';
import type { ModuleFunctions } from '../moduleTypes';

/**
 * Analyzes the imported names against the currently loaded modules.
 * If an imported name does not exist in the module, it adds an error to the context.
 *
 * @param imports A map from module names to the specific names imported from them.
 * @param context The current PyContext, containing loadedModules.
 */
export function analyzeImports(imports: Map<string, Array<{ name: string; alias: string | null }>>, context: PyContext): void {
  for (const [moduleName, importedItems] of imports.entries()) {
    const loadedModule: ModuleFunctions | undefined = context.nativeStorage.loadedModules[moduleName];

    // This should ideally not happen if the linker and loader worked correctly,
    // but as a safeguard.
    if (!loadedModule) {
      // The linker should have already caught this, but we can have a fallback.
      continue;
    }

    for (const item of importedItems) {
      const name = item.name;
      if (name === '*') {
        // 'import *' means all exports are implicitly requested.
        // The analyzer cannot validate individual names here, so we skip.
        continue;
      }
      if (!(name in loadedModule)) {
        // If a specific imported name is not found in the loaded module, it's an error.
        context.errors.push(new UndefinedImportError(name, moduleName));
      }
    }
  }
}

// We also need to keep the ImportAnalysisOptions interface here, as it's imported by moduleTypes.ts
export interface ImportAnalysisOptions {}
