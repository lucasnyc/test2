/**
 * A registry that maps a JS module's name (e.g., 'sound') to its
 * raw, un-proxied exports, which can be any JavaScript value.
 */
export type JSRegistry = Map<string, any>;

/**
 * A lightweight wrapper that acts as a handle to a raw JavaScript object.
 * The CSE machine will be responsible for interpreting operations on this handle.
 */
export interface JSObjectWrapper {
  type: 'JSObject';
  raw: object; // The actual, raw JavaScript object
}

/**
 * A lightweight wrapper that acts as a handle to a raw JavaScript function.
 * The CSE machine will be responsible for interpreting calls to this handle.
 */
export interface JSFunctionWrapper {
  type: 'JSFunction';
  raw: Function; // The actual, raw JavaScript function
}

/**
 * A type guard to check if a value is a JSObjectWrapper.
 */
export const isJSObjectWrapper = (obj: any): obj is JSObjectWrapper => {
  return obj && obj.type === 'JSObject' && typeof obj.raw === 'object';
};

/**
 * A type guard to check if a value is a JSFunctionWrapper.
 */
export const isJSFunctionWrapper = (obj: any): obj is JSFunctionWrapper => {
  return obj && obj.type === 'JSFunction' && typeof obj.raw === 'function';
};
