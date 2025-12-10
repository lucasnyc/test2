import { Value } from './stash';

/**
 * A wrapper for any "foreign" JavaScript value imported into py-slang.
 * This "tags" the value, allowing the interpreter to identify its origin
 * and handle it correctly.
 */
export class ForeignValue {
  public readonly isFunction: boolean;

  constructor(public readonly value: Value) {
    this.isFunction = typeof this.value === 'function';
  }

  toString(): string {
    return `<foreign ${this.isFunction ? 'function' : 'value'}>`;
  }
}

/**
 * Type guard to check if a value is a ForeignValue.
 */
export const isForeignValue = (v: any): v is ForeignValue => {
  return v instanceof ForeignValue;
};
