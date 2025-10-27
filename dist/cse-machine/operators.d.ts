import * as es from "estree";
import { Context } from "./context";
import { ControlItem } from "./control";
export type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%" | "**" | "|" | "^" | "&" | "in" | "instanceof";
export declare function evaluateUnaryExpression(operator: es.UnaryOperator, value: any): any;
export declare function evaluateBinaryExpression(code: string, command: ControlItem, context: Context, identifier: any, left: any, right: any): {
    type: any;
    value: any;
};
