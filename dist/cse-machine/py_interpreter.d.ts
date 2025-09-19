/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */
import { StmtNS } from '../ast-types';
import { PyContext } from './py_context';
import { PyControl } from './py_control';
import { Stash, Value } from './stash';
import { IOptions } from '..';
import { Result } from '../types';
/**
 * Function that returns the appropriate Promise<Result> given the output of CSE machine evaluating, depending
 * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
 * @param context The context of the program.
 * @param value The value of CSE machine evaluating the program.
 * @returns The corresponding promise.
 */
export declare function PyCSEResultPromise(context: PyContext, value: Value): Promise<Result>;
/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param code For error message reference.
 * @param program The program to evaluate.
 * @param context The context to evaluate the program in.
 * @param options Evaluation options.
 * @returns The result of running the CSE machine.
 */
export declare function PyEvaluate(code: string, program: StmtNS.Stmt, context: PyContext, options: IOptions): Value;
/**
 * The primary runner/loop of the explicit control evaluator.
 *
 * @param code For error check reference.
 * @param context The context to evaluate the program in.
 * @param control Points to the current Control stack.
 * @param stash Points to the current Stash.
 * @param envSteps Number of environment steps to run.
 * @param stepLimit Maximum number of steps to execute.
 * @param isPrelude Whether the program is the prelude.
 * @returns The top value of the stash after execution.
 */
export declare function pyRunCSEMachine(code: string, context: PyContext, control: PyControl, stash: Stash, envSteps: number, stepLimit: number, isPrelude?: boolean): Value;
/**
 * Generator function that yields the state of the CSE Machine at each step.
 *
 * @param code For error check reference.
 * @param context The context of the program.
 * @param control The control stack.
 * @param stash The stash storage.
 * @param envSteps Number of environment steps to run.
 * @param stepLimit Maximum number of steps to execute.
 * @param isPrelude Whether the program is the prelude.
 * @yields The current state of the stash, control stack, and step count.
 */
export declare function pyGenerateCSEMachineStateStream(code: string, context: PyContext, control: PyControl, stash: Stash, envSteps: number, stepLimit: number, isPrelude?: boolean): Generator<{
    stash: Stash;
    control: PyControl;
    steps: number;
}, void, unknown>;
