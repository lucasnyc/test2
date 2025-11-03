// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { PyRunInContext, IOptions } from "../runner/pyRunner";
import { PyContext } from "../cse-machine/py_context";
import { 
  IInterfacableEvaluator,
  IRunnerPlugin, 
} from "@sourceacademy/conductor/runner";
import { IDataHandler } from '@sourceacademy/conductor/types';
import { Finished } from "../types";
import { PyDataHandler } from "./PyDataHandler";

const defaultContext = new PyContext();
const defaultOptions: IOptions = {
  isPrelude: false,
  envSteps: 100000,
  stepLimit: 100000,
};

export default class PyEvaluator implements IInterfacableEvaluator {
  private context: PyContext;
  private options: IOptions;
  private dataHandler: PyDataHandler;

  public readonly hasDataInterface = true;
  
  constructor(private conductor: IRunnerPlugin) {
    this.context = defaultContext;
    this.options = defaultOptions;
    this.dataHandler = new PyDataHandler(this.context);
    this.context.nativeStorage.conductor = this.conductor;

    this.closure_make = this.dataHandler.closure_make.bind(this.dataHandler);
    this.pair_make = this.dataHandler.pair_make.bind(this.dataHandler);
    this.pair_head = this.dataHandler.pair_head.bind(this.dataHandler);
    this.pair_sethead = this.dataHandler.pair_sethead.bind(this.dataHandler);
    this.pair_tail = this.dataHandler.pair_tail.bind(this.dataHandler);
    this.pair_settail = this.dataHandler.pair_settail.bind(this.dataHandler);
    this.pair_assert = this.dataHandler.pair_assert.bind(this.dataHandler);
    this.array_make = this.dataHandler.array_make.bind(this.dataHandler);
    this.array_length = this.dataHandler.array_length.bind(this.dataHandler);
    this.array_get = this.dataHandler.array_get.bind(this.dataHandler);
    this.array_type = this.dataHandler.array_type.bind(this.dataHandler);
    this.array_set = this.dataHandler.array_set.bind(this.dataHandler);
    this.array_assert = this.dataHandler.array_assert.bind(this.dataHandler);
    this.closure_is_vararg = this.dataHandler.closure_is_vararg.bind(this.dataHandler);
    this.closure_arity = this.dataHandler.closure_arity.bind(this.dataHandler);
    this.closure_call = this.dataHandler.closure_call.bind(this.dataHandler);
    this.closure_call_unchecked = this.dataHandler.closure_call_unchecked.bind(this.dataHandler);
    this.closure_arity_assert = this.dataHandler.closure_arity_assert.bind(this.dataHandler);
    this.opaque_make = this.dataHandler.opaque_make.bind(this.dataHandler);
    this.opaque_get = this.dataHandler.opaque_get.bind(this.dataHandler);
    this.opaque_update = this.dataHandler.opaque_update.bind(this.dataHandler);
    this.tie = this.dataHandler.tie.bind(this.dataHandler);
    this.untie = this.dataHandler.untie.bind(this.dataHandler);
    this.list = this.dataHandler.list.bind(this.dataHandler);
    this.is_list = this.dataHandler.is_list.bind(this.dataHandler);
    this.list_to_vec = this.dataHandler.list_to_vec.bind(this.dataHandler);
    this.accumulate = this.dataHandler.accumulate.bind(this.dataHandler);
    this.length = this.dataHandler.length.bind(this.dataHandler);
  }
  public closure_make: IDataHandler['closure_make'];
  public pair_make: IDataHandler['pair_make'];
  public pair_head: IDataHandler['pair_head'];
  public pair_sethead: IDataHandler['pair_sethead'];
  public pair_tail: IDataHandler['pair_tail'];
  public pair_settail: IDataHandler['pair_settail'];
  public pair_assert: IDataHandler['pair_assert'];
  public array_make: IDataHandler['array_make'];
  public array_length: IDataHandler['array_length'];
  public array_get: IDataHandler['array_get'];
  public array_type: IDataHandler['array_type'];
  public array_set: IDataHandler['array_set'];
  public array_assert: IDataHandler['array_assert'];
  public closure_is_vararg: IDataHandler['closure_is_vararg'];
  public closure_arity: IDataHandler['closure_arity'];
  public closure_call: IDataHandler['closure_call'];
  public closure_call_unchecked: IDataHandler['closure_call_unchecked'];
  public closure_arity_assert: IDataHandler['closure_arity_assert'];
  public opaque_make: IDataHandler['opaque_make'];
  public opaque_get: IDataHandler['opaque_get'];
  public opaque_update: IDataHandler['opaque_update'];
  public tie: IDataHandler['tie'];
  public untie: IDataHandler['untie'];
  public list: IDataHandler['list'];
  public is_list: IDataHandler['is_list'];
  public list_to_vec: IDataHandler['list_to_vec'];
  public accumulate: IDataHandler['accumulate'];
  public length: IDataHandler['length'];

  async startEvaluator(entrypoint: string): Promise<void> {
    return this.evaluateChunk(entrypoint);
}


  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const result = await PyRunInContext(
        chunk,
        this.context,
        this.options
      );
      this.conductor.sendOutput(
        `${(result as Finished).representation.toString()}`
      );
    } catch (error) {
      this.conductor.sendOutput(
        `Error: ${error instanceof Error ? error.message : error}`
      );
    }
  }
}