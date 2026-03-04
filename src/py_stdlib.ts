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
  // Handle null/undefined early
  if (!obj) {
    return 'None'
  }
  
  if (typeof obj === 'object' && typeof (obj as any).toReplString === 'function') {
    return (obj as any).toReplString();
  }
  
  if (isJSValue(obj)) {
    const innerValue = obj.value;
    
    if (innerValue && typeof innerValue.toReplString === 'function') {
      return innerValue.toReplString();
    }
    
    if (obj.isFunction) {
      return `<function ${obj.name}>`;
    }
    
    if (typeof innerValue === 'object' && innerValue !== null) {
      const constructorName = innerValue.constructor?.name;
      if (constructorName && constructorName !== 'Object') {
        return `<${constructorName}>`;
      }
    }
    
    return obj.toString();
  }

  let ret: any
  
  if ((obj as Value).type === 'bigint' || (obj as Value).type === 'complex') {
    ret = (obj as Value).value.toString()
  } else if ((obj as Value).type === 'number') {
    ret = toPythonFloat((obj as Value).value)
  } else if ((obj as Value).type === 'bool') {
    return (obj as Value).value === true ? 'True' : 'False'
  } else if ((obj as Value).type === 'error') {
    return (obj as Value).message
  } else if (obj instanceof PyClosure) {
    if (obj.node) {
      const funcName = (obj.node as any).name?.lexeme || '(anonymous)'
      return `<function ${funcName}>`;
    }
    return '<function (anonymous)>'
  } else if ((obj as Value).type === 'result') {
    const resultValue = (obj as any).value;
    if (resultValue && typeof resultValue.toReplString === 'function') {
      return resultValue.toReplString();
    }
    if (typeof resultValue === 'object' && resultValue !== null) {
      const constructorName = resultValue.constructor?.name;
      if (constructorName && constructorName !== 'Object') {
        return `<${constructorName}>`;
      }
    }
    return String(resultValue);
  } else if ((obj as Value).value === undefined || (obj as Value).type === 'undefined') {
    ret = 'None'
  } else if ((obj as Value).type === 'string') {
    ret = (obj as Value).value.toString()
  } else {
    ret = String(obj)
  }
  
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
