import { Value } from "./cse-machine/stash";
import { ControlItem } from "./cse-machine/control";
import { Context } from "./cse-machine/context";
export declare function Validate(minArgs: number | null, maxArgs: number | null, functionName: string, strict: boolean): (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(args: Value[], source: string, command: ControlItem, context: Context) => Value>) => void;
export declare class BuiltInFunctions {
    static _int(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static _int_from_string(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static abs(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static toStr(val: Value): string;
    static error(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static isinstance(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_acos(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_acosh(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_asin(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_asinh(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_atan(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_atan2(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_atanh(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_cos(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_cosh(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_degrees(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_erf(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_erfc(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static char_at(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_comb(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_factorial(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_gcd(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static gcdOfTwo(a: bigint, b: bigint): bigint;
    static math_isqrt(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_lcm(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static lcmOfTwo(a: bigint, b: bigint): bigint;
    static absBigInt(x: bigint): bigint;
    static math_perm(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_ceil(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_fabs(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_floor(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static twoProd(a: number, b: number): {
        prod: number;
        err: number;
    };
    static twoSum(a: number, b: number): {
        sum: number;
        err: number;
    };
    static fusedMultiplyAdd(x: number, y: number, z: number): number;
    static toNumber(val: Value, source: string, command: ControlItem, context: Context): number;
    static math_fma(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_fmod(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static roundToEven(num: number): number;
    static math_remainder(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_trunc(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_copysign(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_isfinite(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_isinf(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_isnan(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_ldexp(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_nextafter(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_ulp(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_cbrt(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_exp(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_exp2(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_expm1(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_gamma(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_lgamma(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_log(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_log10(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_log1p(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_log2(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_pow(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_radians(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_sin(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_sinh(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_tan(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_tanh(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static math_sqrt(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static max(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static min(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static random_random(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static round(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static time_time(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static input(args: Value[], source: string, command: ControlItem, context: Context): Value;
    static print(args: Value[], source: string, command: ControlItem, context: Context): void;
    static str(args: Value[], source: string, command: ControlItem, context: Context): Value;
}
export declare const builtInConstants: Map<string, any>;
export declare const builtIns: Map<string, (...args: any[]) => any>;
/**
 * Converts a number to a string that mimics Python's float formatting behavior.
 *
 * In Python, float values are printed in scientific notation when their absolute value
 * is ≥ 1e16 or < 1e-4. This differs from JavaScript/TypeScript's default behavior,
 * so we explicitly enforce these formatting thresholds.
 *
 * The logic here is based on Python's internal `format_float_short` implementation
 * in CPython's `pystrtod.c`:
 * https://github.com/python/cpython/blob/main/Python/pystrtod.c
 *
 * Special cases such as -0, Infinity, and NaN are also handled to ensure that
 * output matches Python’s display conventions.
 */
export declare function toPythonFloat(num: number): string;
export declare function toPythonString(obj: Value): string;
export declare function str(args: Value[], source: string, command: ControlItem, context: Context): Value;
