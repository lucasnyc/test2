import { PyContext } from "./py_context";
import { Value } from "./stash";
/**
 *  Marshal JS value into a py-slang Value representation
 *  @param value The JS value to marshal
 *  @param context PyContext
 *  @returns py-slang Value
 */
export declare function marshalToPy(value: any, context: PyContext): Value;
/**
 * Unmarshal py-slang Value into its JS representation
 * @param value py-slang Value to unmarshal
 * @returns JS value
 */
export declare function unmarshalFromPy(value: Value): any;
