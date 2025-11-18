import { JSRegistry, JSObjectWrapper, JSFunctionWrapper } from './types';
import { PyContext, StmtNS, ExprNS } from '../py-slang/types'; // Assuming py-slang AST types are here

/**
 * Recursively creates JS wrappers for a raw JavaScript value.
 * If the value is a function, it returns a JSFunctionWrapper.
 * If the value is an object (but not null), it returns a JSObjectWrapper.
 * Otherwise, it returns the value as is (primitives don't need wrapping).
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
 * @param ast The Python AST (StmtNS.Program or similar root node).
 * @param jsRegistry The JSRegistry containing pre-loaded raw JavaScript module exports.
 * @returns A Map where keys are Python names (identifiers) and values are
 *          the corresponding JS wrappers or raw primitives. This map forms
 *          the initial global environment for the CSE machine.
 */
export function linkJsImports(ast: StmtNS.Program, jsRegistry: JSRegistry): Map<string, any> {
  const initialGlobalEnvironment: Map<string, any> = new Map();

  // Simple AST traversal to find ImportFrom nodes
  function traverse(node: StmtNS.Node | ExprNS.Node) {
    if (!node) return;

    if (node.type === 'ImportFrom') {
      const moduleName = node.module.value; // Assuming module name is directly accessible
      const rawJsExports = jsRegistry.get(moduleName);

      if (!rawJsExports) {
        // Handle error: Module not found in registry.
        // For now, we'll just log and skip, but a proper error mechanism is needed.
        console.warn(`Module '${moduleName}' imported but not found in JSRegistry.`);
        return;
      }

      for (const alias of node.names) {
        const originalName = alias.name.value;
        const importedAs = alias.asname ? alias.asname.value : originalName;

        const rawSymbol = rawJsExports[originalName];
        if (rawSymbol === undefined) {
          // Handle error: Symbol not found in module.
          console.warn(`Symbol '${originalName}' not found in module '${moduleName}'.`);
          continue;
        }

        initialGlobalEnvironment.set(importedAs, createJSWrapper(rawSymbol));
      }
    }

    // Recursively traverse children
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const value = (node as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(traverse);
          } else {
            traverse(value);
          }
        }
      }
    }
  }

  traverse(ast);
  return initialGlobalEnvironment;
}
