import { StmtNS, ExprNS } from '../ast-types';
import { JSRegistry, JSObjectWrapper, JSFunctionWrapper } from './types';

/**
 * Creates a JS wrapper for a raw JavaScript value.
 * If the value is a function, it returns a JSFunctionWrapper.
 * Primitives and other objects are handled as needed.
 */
function createJSWrapper(value: any): any {
  if (typeof value === 'function') {
    return { type: 'JSFunction', raw: value } as JSFunctionWrapper;
  } else if (typeof value === 'object' && value !== null) {
    return { type: 'JSObject', raw: value } as JSObjectWrapper;
  }
  return value; // Primitives are passed through directly
}

/**
 * Processes the Python AST to identify 'from ... import ...' statements
 * and pre-binds the imported JavaScript symbols into an initial environment map.
 * This function acts as the "Linker Phase".
 *
 * @param ast The Python AST (the root FileInput node).
 * @param jsRegistry The JSRegistry containing pre-loaded raw JavaScript module exports.
 * @returns A Map where keys are Python names and values are the corresponding JS wrappers.
 */
export function linkJsImports(ast: StmtNS.FileInput, jsRegistry: JSRegistry): Map<string, any> {
  const initialGlobalEnvironment: Map<string, any> = new Map();

  // Manual traversal since ast-walker is not a dependency.
  function traverse(node: any) {
    if (!node) return;

    if (node instanceof StmtNS.FromImport) {
      const moduleName = node.module.lexeme;
      const rawJsExports = jsRegistry.get(moduleName);

      if (!rawJsExports) {
        console.warn(`Module '${moduleName}' imported but not found in JSRegistry.`);
        return;
      }

      for (const alias of node.names) {
        const originalName = alias.name.lexeme;
        const importedAs = alias.alias ? alias.alias.lexeme : originalName;

        const rawSymbol = (rawJsExports as any)[originalName];
        if (rawSymbol === undefined) {
          console.warn(`Symbol '${originalName}' not found in module '${moduleName}'.`);
          continue;
        }

        const wrapper = createJSWrapper(rawSymbol);

        // Bind the direct name, e.g., `heart` or `h` in `import heart as h`
        initialGlobalEnvironment.set(importedAs, wrapper);

        // Also bind the dotted name for cases like `runes.heart`
        const dottedName = `${moduleName}.${originalName}`;
        initialGlobalEnvironment.set(dottedName, wrapper);
      }
    }

    // Recursively traverse children
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const value = (node as any)[key];
        if (Array.isArray(value)) {
          value.forEach(traverse);
        } else if (value && typeof value === 'object' && value.constructor.name !== 'Token') {
          // Avoid traversing into tokens, which have circular references.
          traverse(value);
        }
      }
    }
  }

  traverse(ast);
  return initialGlobalEnvironment;
}
