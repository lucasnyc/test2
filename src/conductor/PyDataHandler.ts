import {
    IDataHandler,
    IFunctionSignature,
    TypedValue,
    DataType,
    ExternCallable
} from '@sourceacademy/conductor/types';
import { PyContext } from '../cse-machine/py_context';
import { JsClosure } from '../cse-machine/py_closure';

export class PyDataHandler implements IDataHandler {
    public readonly hasDataInterface= true;

    constructor(private context: PyContext) {}

    async closure_make<const Arg extends readonly DataType[], const Ret extends DataType>(
        sig: IFunctionSignature<Arg, Ret>,
        func: ExternCallable<Arg, Ret>,
    ): Promise<TypedValue<DataType.CLOSURE, Ret>> {
        const jsClosure = new JsClosure(sig, func, this.context);

        return {
            type: DataType.CLOSURE,
            value: jsClosure as any,
        };
    }

    async pair_make(head: TypedValue<DataType>, tail: TypedValue<DataType>): Promise<TypedValue<DataType.PAIR>> {
        return Promise.reject(new Error('Method not implemented'));
    }
    async pair_head(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_sethead(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_tail(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_settail(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_assert(p: TypedValue<DataType.PAIR>, headType?: DataType, tailType?: DataType): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_make<T extends DataType>(t: T, len: number, init?: TypedValue<any>): Promise<TypedValue<DataType.ARRAY, T>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_length(a: TypedValue<DataType.ARRAY, DataType>): Promise<number> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_get(a: TypedValue<DataType.ARRAY, DataType.VOID>, idx: number): Promise<TypedValue<DataType>>;
    async array_get<T extends DataType>(a: TypedValue<DataType.ARRAY, T>, idx: number): Promise<TypedValue<T>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_type<T extends DataType>(a: TypedValue<DataType.ARRAY, T>): Promise<T> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_set(a: TypedValue<DataType.ARRAY, DataType.VOID>, idx: number, tv: TypedValue<DataType>): Promise<void>;
    async array_set<T extends DataType>(a: TypedValue<DataType.ARRAY, T>, idx: number, tv: TypedValue<T>): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_assert<T extends DataType>(a: TypedValue<DataType.ARRAY, DataType>, type?: T, length?: number): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_is_vararg(c: TypedValue<DataType.CLOSURE, DataType>): Promise<boolean> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_arity(c: TypedValue<DataType.CLOSURE, DataType>): Promise<number> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_call<T extends DataType>(c: TypedValue<DataType.CLOSURE, T>, args: TypedValue<DataType>[], returnType: T): Promise<TypedValue<T>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_call_unchecked<T extends DataType>(c: TypedValue<DataType.CLOSURE, T>, args: TypedValue<DataType>[]): Promise<TypedValue<T>>{
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_arity_assert(c: TypedValue<DataType.CLOSURE, DataType>, arity: number): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async opaque_make(v: any, immutable?: boolean): Promise<TypedValue<DataType.OPAQUE>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async opaque_get(o: TypedValue<DataType.OPAQUE>): Promise<any> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async opaque_update(o: TypedValue<DataType.OPAQUE>, v: any): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async tie(dependent: TypedValue<DataType>, dependee: TypedValue<DataType> | null): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async untie(dependent: TypedValue<DataType>, dependee: TypedValue<DataType> | null): Promise<void> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async list(...elements: TypedValue<DataType>[]): Promise<TypedValue<DataType.LIST>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async is_list(xs: TypedValue<DataType.LIST>): Promise<boolean> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async list_to_vec(xs: TypedValue<DataType.LIST>): Promise<TypedValue<DataType>[]> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async accumulate<T extends Exclude<DataType, void>>(op: TypedValue<DataType.CLOSURE, T>, initial: TypedValue<T>, sequence: TypedValue<DataType.LIST>, resultType: T): Promise<TypedValue<T>> {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async length(xs: TypedValue<DataType.LIST>): Promise<number> {
        return Promise.reject(new Error('Method not implemented.'));
    }
}