import { PyContext } from "./py_context";
import { Value } from "./stash";

/**
 *  Marshal JS value into a py-slang Value representation
 *  @param value The JS value to marshal
 *  @param context PyContext
 *  @returns py-slang Value 
 */
export function marshalToPy(value: any, context: PyContext): Value {
    if (typeof value === 'bigint') {
        return { type: 'bigint', value};
    } else if (typeof value === 'number') {
        return { type: 'number', value};
    } else if (typeof value === 'string') {
        return { type: 'string', value};
    } else if (typeof value === 'boolean') {
        return { type: 'bool', value};
    } else if (value === null || value === undefined) {
        return { type: 'undefined' };
    }
    // TODO: implementation for more types such as list or dicts
    // We do not include complex numbers of other objects from JS for now
    throw new Error(`Marshalling of Javascript type '${typeof value} is not implemented.`);
}

/**
 * Unmarshal py-slang Value into its JS representation
 * @param value py-slang Value to unmarshal
 * @returns JS value
 */
export function unmarshalFromPy(value: Value): any {
    if (!value || typeof value.type !== 'string') {
        return value;
    }
    
    switch (value.type) {
        case 'bigint':
        case 'number':
        case 'string':
        case 'bool':
            return value.value;
        case 'complex':
            throw new Error('Passing complex number to external functions is not supported.');
        default:
            throw new Error(`Unmarshalling of py-slang type '${value.type}' is not supported for external functions.`);
        
    }
}