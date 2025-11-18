import { isJSObjectWrapper, isJSFunctionWrapper, JSObjectWrapper, JSFunctionWrapper } from '../modules/types';
import { Value } from '../cse-machine/stash';

// A placeholder for py-slang's PyList and PyDict types.
// These will need to be replaced with the actual types from py-slang.
type PyList = { type: 'list', values: Value[] };
type PyDict = { type: 'dict', values: Map<any, Value> };

/**
 * Converts a py-slang runtime value to a native JavaScript value.
 * This is the "outbound" marshalling function.
 * @param pyValue The value from the py-slang CSE machine.
 * @returns A corresponding native JavaScript value.
 */
export function pyValueToJs(pyValue: Value): any {
  if (pyValue === null || pyValue.type === 'NoneType') {
    return null;
  }
  if (pyValue.type === 'JSObject' || pyValue.type === 'JSFunction') {
    // If it's already a JS wrapper, return the raw underlying value.
    return pyValue.raw;
  }
  if (pyValue.type === 'list') {
    // Recursively convert list elements.
    return (pyValue as PyList).values.map(pyValueToJs);
  }
  if (pyValue.type === 'dict') {
    // Recursively convert dictionary values.
    const jsObj: { [key: string]: any } = {};
    for (const [key, value] of (pyValue as PyDict).values.entries()) {
      jsObj[String(key)] = pyValueToJs(value);
    }
    return jsObj;
  }
  // For primitives like number, string, bool, bigint, the `value` property holds the JS equivalent.
  if ('value' in pyValue) {
    return pyValue.value;
  }
  // Fallback for other types
  return pyValue;
}

/**
 * Converts a native JavaScript value to a py-slang runtime value.
 * This is the "inbound" marshalling function.
 * @param jsValue The native JavaScript value.
 * @returns A corresponding py-slang value (primitive, or a wrapper for objects/functions).
 */
export function jsValueToPy(jsValue: any): Value {
  if (jsValue === null || jsValue === undefined) {
    return { type: 'NoneType' };
  }
  if (typeof jsValue === 'function') {
    return { type: 'JSFunction', raw: jsValue } as JSFunctionWrapper;
  }
  if (typeof jsValue === 'object') {
    // Note: This doesn't handle conversion of JS arrays or objects back to PyList/PyDict yet.
    // It simply wraps them for access from Python. A more sophisticated implementation
    // could recursively convert them.
    return { type: 'JSObject', raw: jsValue } as JSObjectWrapper;
  }
  if (typeof jsValue === 'number') {
    return { type: 'number', value: jsValue };
  }
  if (typeof jsValue === 'string') {
    return { type: 'string', value: jsValue };
  }
  if (typeof jsValue === 'boolean') {
    return { type: 'bool', value: jsValue };
  }
  if (typeof jsValue === 'bigint') {
    return { type: 'bigint', value: jsValue };
  }
  // Fallback for any other types
  return jsValue;
}
