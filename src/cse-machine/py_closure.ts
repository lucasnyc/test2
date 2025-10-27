import { StmtNS, ExprNS } from '../ast-types'
import { PyEnvironment, uniqueId } from './py_environment'
import { PyContext } from './py_context'
import { StatementSequence } from './py_types'
import { PyControlItem } from './py_control'
import { IFunctionSignature } from '@sourceacademy/conductor/types'
import { Value } from './stash'
import { marshalToPy, unmarshalFromPy } from './marshal'

/**
 * Represents a python closure, the class is a runtime representation of a function.
 * Bundles the function's code (AST node) with environment in which its defined.
 * When Closure is called, a new environment will be created whose parent is the 'Environment' captured
 */
export class PyClosure {
  public readonly type = 'PyClosure';
  public readonly id: string
  /** AST node for function, either a 'def' or 'lambda' */
  public node: StmtNS.FunctionDef | ExprNS.Lambda;
  /** Environment captures at time of function's definition, key for lexical scoping */
  public environment: PyEnvironment;
  public context: PyContext;
  public readonly predefined: boolean;
  public originalNode?: StmtNS.FunctionDef | ExprNS.Lambda;
  /** Stores local variables for scope check */
  public localVariables: Set<string>;

  constructor(
    node: StmtNS.FunctionDef | ExprNS.Lambda,
    environment: PyEnvironment,
    context: PyContext,
    predefined: boolean = false,
    localVariables: Set<string> = new Set()
) {
      this.id = uniqueId(context);
      this.node = node;
      this.environment = environment;
      this.context = context;
      this.predefined = predefined;
      this.originalNode = node;
      this.localVariables = localVariables;
  }

  /** 
   * Creates closure for FunctionDef
   */
  static makeFromFunctionDef (
    node: StmtNS.FunctionDef,
    environment: PyEnvironment,
    context: PyContext,
    localVariables: Set<string>
  ): PyClosure {
    const closure = new PyClosure(node, environment, context, false, localVariables);
    return closure;
  }

  /**
   * Creates closure for Lambda
   */
  static makeFromLambda(
       node: ExprNS.Lambda,
       environment: PyEnvironment,
       context: PyContext,
       localVariables: Set<string>
     ): PyClosure {
       const closure = new PyClosure(node, environment, context, false, localVariables);
       return closure;
     }
   }

/**
* Type guard to check if a control item is a StatementSequence.
*/
export const isStatementSequence = (node: PyControlItem): node is StatementSequence => {
  return (node as StatementSequence).type === 'StatementSequence';
};

/**
 * Represents a Javascript function that has been imported into js-slang from modules/
 * Wraps the JS function and marshal data between two languages
 * 1. Arguments from py-slang is marshalled to JS values
 * 2. Function call
 * 3. Return value from JS is marshalled back into py-slang value
 */
export class JsClosure {
  public readonly type = 'JsClosure';
  public readonly id: string;

  constructor(
    public signature: IFunctionSignature<any, any>,
    public func: (...args: any[]) => any,
    private context: PyContext,
  ) {
    this.id = uniqueId(context);
  }

  public call(args: Value[]): Value {
    const jsArgument = args.map(unmarshalFromPy);
    const result = this.func(...jsArgument);
    return marshalToPy(result, this.context);
  }
}