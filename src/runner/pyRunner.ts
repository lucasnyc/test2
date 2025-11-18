import { PyContext } from "../cse-machine/py_context";
import { PyCSEResultPromise, PyEvaluate } from "../cse-machine/py_interpreter";
import { RecursivePartial, Result } from "../types";
import { Tokenizer } from "../tokenizer";
import { Parser } from "../parser";
import { Resolver } from "../resolver";
import { StmtNS } from "../ast-types";
import { pyDefineVariable } from "../cse-machine/py_utils";

type Stmt = StmtNS.Stmt;

export interface IOptions {
  isPrelude: boolean;
  envSteps: number;
  stepLimit: number;
}

/**
 * A lightweight function to quickly check if a Python script contains any
 * 'from ... import ...' statements.
 * @param pythonCode The Python source code.
 * @returns True if import statements are found, otherwise false.
 */
function scanForImports(pythonCode: string): boolean {
  return /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g.test(pythonCode);
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

  // Conditionally run the module loader only if import statements are present.
  if (scanForImports(code)) {
    // If imports exist, dynamically load the heavy modules and run the full pipeline.
    const { JSModuleLoader } = await import('../modules/loader');
    const { linkJsImports } = await import('../modules/linker');

    const loader = new JSModuleLoader();
    const jsRegistry = await loader.preloadModules(code);
    const linkedImports = linkJsImports(ast as StmtNS.FileInput, jsRegistry);

    for (const [name, value] of linkedImports.entries()) {
      pyDefineVariable(context, name, value);
    }
  }

  // Proceed with CSE machine evaluation.
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
