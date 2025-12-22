import { PyContext } from './cse-machine/py_context'
import { isJSValue, JSValue, PyClosure } from './cse-machine/py_closure'
import { Value } from './cse-machine/stash'
import { pyHandleRuntimeError } from './cse-machine/py_utils'
import { UnsupportedOperandTypeError } from './errors/py_errors'

export function toPythonFloat(num: number): string {
  if (Object.is(num, -0)) {
    return '-0.0'
  }
  if (num === 0) {
    return '0.0'
  }

  if (num === Infinity) {
    return 'inf'
  }
  if (num === -Infinity) {
    return '-inf'
  }

  if (Number.isNaN(num)) {
    return 'nan'
  }

  if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
    return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2')
  }
  if (Number.isInteger(num)) {
    return num.toFixed(1).toString()
  }
  return num.toString()
}

export function toPythonString(obj: Value): string {
  console.log('--- toPythonString START ---');
  console.log('Received obj:', obj);
  try {
    console.log('obj constructor name:', obj?.constructor?.name);
    console.log('Is obj a JSValue?', isJSValue(obj));
    if (obj && typeof obj === 'object') {
      console.log('obj keys:', Object.keys(obj));
      if (isJSValue(obj)) {
        console.log('JSValue.value:', obj.value);
        console.log('JSValue.value.constructor.name:', obj?.value?.constructor?.name);
      }
    }
  } catch (e) {
    console.log('Error during initial logging:', e);
  }


  if (isJSValue(obj)) {
    console.log('Branch: isJSValue');
    if (obj.value && typeof obj.value.toReplString === 'function') {
      console.log('Branch: isJSValue -> has toReplString');
      const result = obj.value.toReplString();
      console.log('Result:', result);
      console.log('--- toPythonString END ---');
      return result;
    } else if (obj.isFunction) {
      console.log('Branch: isJSValue -> isFunction');
      const result = `<function ${obj.name}>`;
      console.log('Result:', result);
      console.log('--- toPythonString END ---');
      return result;
    } else {
      console.log('Branch: isJSValue -> fallback else');
      const result = obj.toString();
      console.log('Result:', result);
      console.log('--- toPythonString END ---');
      return result;
    }
  }

  let ret: any
  if (!obj) {
    console.log('Branch: !obj');
    console.log('--- toPythonString END ---');
    return 'None'
  }
  if ((obj as Value).type === 'bigint' || (obj as Value).type === 'complex') {
    console.log('Branch: bigint or complex');
    ret = (obj as Value).value.toString()
  } else if ((obj as Value).type === 'number') {
    console.log('Branch: number');
    ret = toPythonFloat((obj as Value).value)
  } else if ((obj as Value).type === 'bool') {
    console.log('Branch: bool');
    if ((obj as Value).value === true) {
      console.log('--- toPythonString END ---');
      return 'True'
    } else {
      console.log('--- toPythonString END ---');
      return 'False'
    }
  } else if ((obj as Value).type === 'error') {
    console.log('Branch: error');
    return (obj as Value).message
  } else if (obj instanceof PyClosure) {
    console.log('Branch: PyClosure');
    if (obj.node) {
      const funcName = (obj.node as any).name?.lexeme || '(anonymous)'
      const result = `<function ${funcName}>`;
      console.log('Result:', result);
      console.log('--- toPythonString END ---');
      return result;
    }
  } else if ((obj as Value).value === undefined) {
    console.log('Branch: value is undefined');
    ret = 'None'
  } else if ((obj as Value).type === 'string') {
    console.log('Branch: string');
    ret = (obj as Value).value.toString()
  }
   else {
    console.log('Branch: final else');
    ret = obj.toString()
  }
  console.log('Final return:', ret);
  console.log('--- toPythonString END ---');
  return ret
}

export class BuiltInFunctions {
  static print(context: PyContext, ...args: Value[]): Value {
    const output = args.map(arg => toPythonString(arg)).join(' ')
    context.output += output + '\n'
    if (args.length === 1) {
        return args[0];
    }
    return { type: 'undefined' }
  }

  static _int(context: PyContext, ...args: Value[]): Value {
    if (args.length === 0) {
      return { type: 'bigint', value: BigInt(0) }
    }

    const arg = args[0]
    if (arg.type === 'number') {
      const truncated = Math.trunc(arg.value)
      return { type: 'bigint', value: BigInt(truncated) }
    }
    if (arg.type === 'bigint') {
      return { type: 'bigint', value: arg.value }
    }

    // TODO: Use proper TypeError class once node is passed to built-ins
    return {
      type: 'error',
      message: `TypeError: int() argument must be a string, a bytes-like object or a real number, not '${arg.type}'`
    }
  }
}

// Load only the functions we have implemented
export const builtIns = new Map<string, (...args: any[]) => any>()
builtIns.set('print', BuiltInFunctions.print)
builtIns.set('_int', BuiltInFunctions._int)
