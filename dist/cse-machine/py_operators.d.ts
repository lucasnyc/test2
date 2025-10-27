import { Value } from "./stash";
import { PyContext } from "./py_context";
import { ExprNS } from "../ast-types";
import { TokenType } from "../tokens";
export type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%" | "**" | "|" | "^" | "&" | "in" | "instanceof";
export declare function isFalsy(value: Value): boolean;
export declare function evaluateBoolExpression(code: string, command: ExprNS.Expr, context: PyContext, operator: TokenType, left: Value, right: Value): Value;
export declare function evaluateUnaryExpression(code: string, command: ExprNS.Expr, context: PyContext, operator: TokenType, value: Value): Value;
export declare function evaluateBinaryExpression(code: string, command: ExprNS.Expr, context: PyContext, operator: TokenType, left: Value, right: Value): Value;
