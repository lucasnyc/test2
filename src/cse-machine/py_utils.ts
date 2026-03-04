import { PyContext } from './py_context'
import { Value } from './stash'
import { PyNode } from './py_types'
import { RuntimeSourceError } from '../errors/py_runtimeSourceError'
import { currentEnvironment, PyEnvironment } from './py_environment'
import { builtIns } from '../py_stdlib'
import { StmtNS, ExprNS } from '../ast-types'
import { UnboundLocalError, NameError } from '../errors/py_errors'
import { isJSValue } from './py_closure'

export function pyHandleRuntimeError(context: PyContext, error: RuntimeSourceError) {
  context.errors.push(error)
  throw error
}

export function marshalToJs(value: Value, context: PyContext): any {
  if (isJSValue(value)) {
    const rawValue = value.value;
    // Specific hack for Rune to fix instanceof checks across worker boundaries
    if (typeof rawValue === 'object' && rawValue !== null && rawValue.constructor.name === 'Rune') {
      const runeModuleExports = context.nativeStorage.loadedModules.rune;
      if (runeModuleExports && typeof runeModuleExports === 'object' && 'Rune' in runeModuleExports) {
        const RuneClass = (runeModuleExports as any).Rune;
        if (typeof RuneClass === 'function' && rawValue.constructor !== RuneClass) {
          Object.setPrototypeOf(rawValue, RuneClass.prototype);
        }
      }
    }
    return rawValue; // Unwrap JSValue
  }
  if (value.type === 'number' || value.type === 'string' || value.type === 'bool') {
    return value.value // Return raw primitive
  }
  if (value.type === 'undefined') {
    return undefined // Python None -> JS undefined
  }
  // For other types like PyClosure, just pass them through for now.
  return value
}

export function pythonMod(a: number | bigint, b: number | bigint): number | bigint {
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    const big_a = BigInt(a)
    const big_b = BigInt(b)
    const mod = big_a % big_b

    if ((mod < 0n && big_b > 0n) || (mod > 0n && big_b < 0n)) {
      return mod + big_b
    } else {
      return mod
    }
  }
  // both are numbers
  const mod = a % b
  if ((mod < 0 && b > 0) || (mod > 0 && b < 0)) {
    return mod + b
  } else {
    return mod
  }
}

export function pyDefineVariable(
  context: PyContext,
  name: string,
  value: Value,
  env: PyEnvironment = currentEnvironment(context)
) {
  Object.defineProperty(env.head, name, {
    value: value,
    writable: true,
    enumerable: true
  })
}

export function pyGetVariable(code: string, context: PyContext, name: string, node: PyNode): Value {
  const env = currentEnvironment(context)
  if (env.closure && env.closure.localVariables.has(name)) {
    if (!env.head.hasOwnProperty(name)) {
      throw new UnboundLocalError(code, name, node as ExprNS.Variable)
    }
  }

  let currentEnv: PyEnvironment | null = env
  while (currentEnv) {
    if (Object.prototype.hasOwnProperty.call(currentEnv.head, name)) {
      const retrievedValue = currentEnv.head[name];
      if (name === 'heart') {
        console.log('--- pyGetVariable ---');
        console.log('Retrieving name:', name);
        console.log('Value being returned:', retrievedValue);
        console.log('Type of value:', typeof retrievedValue);
        console.log('Constructor of value:', retrievedValue?.constructor?.name);
      }
      return retrievedValue;
    } else {
      currentEnv = currentEnv.tail
    }
  }
  if (builtIns.has(name)) {
    return builtIns.get(name)!
  }
  throw new NameError(code, name, node as ExprNS.Variable)
}

export function scanForAssignments(node: PyNode | PyNode[]): Set<string> {
  const assignments = new Set<string>()
  const visitor = (curNode: PyNode) => {
    if (!curNode || typeof curNode !== 'object') {
      return
    }

    const nodeType = curNode.constructor.name

    if (nodeType === 'Assign') {
      assignments.add((curNode as StmtNS.Assign).name.lexeme)
    } else if (nodeType === 'FunctionDef' || nodeType === 'Lambda') {
      // detach here, nested functions have their own scope
      return
    }

    // Recurse through all other properties of the node
    for (const key in curNode) {
      if (Object.prototype.hasOwnProperty.call(curNode, key)) {
        const child = (curNode as any)[key]
        if (Array.isArray(child)) {
          child.forEach(visitor)
        } else if (child && typeof child === 'object' && child.hasOwnProperty('type')) {
          visitor(child)
        }
      }
    }
  }

  if (Array.isArray(node)) {
    node.forEach(visitor)
  } else {
    visitor(node)
  }

  return assignments
}
