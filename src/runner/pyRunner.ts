import { PyContext } from "../cse-machine/py_context";
import { PyCSEResultPromise, PyEvaluate } from "../cse-machine/py_interpreter";
import { RecursivePartial, Result } from "../types";
import { Tokenizer } from "../tokenizer";
import { Parser } from "../parser";
import { Resolver } from "../resolver";
import { StmtNS } from "../ast-types";
import { preloadModules } from "../modules/preprocessor";

type Stmt = StmtNS.Stmt;

export interface IOptions {
  isPrelude: boolean;
  envSteps: number;
  stepLimit: number;
}

function findImportedModules(program: Stmt): string[] {
  const moduleNames = new Set<string>();

  function traverse(node: any) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (node.constructor.name === 'FromImport') {
      const importNode = node as StmtNS.FromImport;
      moduleNames.add(importNode.module.lexeme);
    }

    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else {
          traverse(child);
        }
      }
    }
  }
  traverse(program);
  return Array.from(moduleNames);
}

export async function runPyAST(
    code: string,
    variant: number = 1,
    doValidate: boolean = false
): Promise<Stmt> {
    const script = code + "\n";
    const tokenizer = new Tokenizer(script);
    const tokens = tokenizer.scanEverything();
    const pyParser = new Parser(script, tokens);
    const ast = pyParser.parse();
    if (doValidate) {
      new Resolver(code, ast).resolve(ast);
    }
    return ast;
};

export async function PyRunInContext(
  code: string,
  context: PyContext,
  options: RecursivePartial<IOptions> = {},
): Promise<Result> {
  const ast = await runPyAST(code, 1, true);
  await preloadModules(context, ast);
  const result = PyRunCSEMachine(code, ast, context, options);
  return result;
}

export function PyRunCSEMachine(
  code: string,
  program: Stmt,
  context: PyContext,
  options: RecursivePartial<IOptions> = {}
): Promise<Result> {
    const result = PyEvaluate(code, program, context, options as IOptions); 
    return PyCSEResultPromise(context, result);
}
