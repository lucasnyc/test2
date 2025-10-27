'use strict';

/**
 * The heap stores all objects in each environment.
 */
class Heap {
    constructor() {
        this.storage = null;
    }
    add(...items) {
        this.storage ?? (this.storage = new Set());
        for (const item of items) {
            this.storage.add(item);
        }
    }
    /** Checks the existence of `item` in the heap. */
    contains(item) {
        return this.storage?.has(item) ?? false;
    }
    /** Gets the number of items in the heap. */
    size() {
        return this.storage?.size ?? 0;
    }
    /**
     * Removes `item` from current heap and adds it to `otherHeap`.
     * If the current heap does not contain `item`, nothing happens.
     * @returns whether the item transfer is successful
     */
    move(item, otherHeap) {
        if (!this.contains(item))
            return false;
        this.storage.delete(item);
        otherHeap.add(item);
        return true;
    }
    /** Returns a copy of the heap's contents. */
    getHeap() {
        return new Set(this.storage);
    }
}

const uniqueId = (context) => {
    return `${context.runtime.objectCount++}`;
};
const createEnvironment = (context, closure, args, callExpression) => {
    const environment = {
        name: closure.node.constructor.name === 'FunctionDef' ? closure.node.name.lexeme : 'lambda',
        tail: closure.environment,
        head: {},
        heap: new Heap(),
        id: uniqueId(context),
        callExpression: callExpression,
        closure: closure
    };
    closure.node.parameters.forEach((paramToken, index) => {
        const paramName = paramToken.lexeme;
        environment.head[paramName] = args[index];
    });
    return environment;
};
// export const isRestElement = (node: Node): node is es.RestElement => {
//   return (node as es.RestElement).type === 'RestElement';
// };
// export const handleArrayCreation = (
//   context: PyContext,
//   array: any[],
//   envOverride?: PyEnvironment
// ): void => {
//   const environment = envOverride ?? currentEnvironment(context);
//   Object.defineProperties(array, {
//     id: { value: uniqueId(context) },
//     environment: { value: environment, writable: true }
//   });
//   environment.heap.add(array as any);
// };
const currentEnvironment = (context) => {
    return context.runtime.environments[0];
};
const popEnvironment = (context) => context.runtime.environments.shift();
const pushEnvironment = (context, environment) => {
    context.runtime.environments.unshift(environment);
    context.runtime.environmentTree.insert(environment);
};

/**
 *  Marshal JS value into a py-slang Value representation
 *  @param value The JS value to marshal
 *  @param context PyContext
 *  @returns py-slang Value
 */
function marshalToPy(value, context) {
    if (typeof value === 'bigint') {
        return { type: 'bigint', value };
    }
    else if (typeof value === 'number') {
        return { type: 'number', value };
    }
    else if (typeof value === 'string') {
        return { type: 'string', value };
    }
    else if (typeof value === 'boolean') {
        return { type: 'bool', value };
    }
    else if (value === null || value === undefined) {
        return { type: 'undefined' };
    }
    // TODO: implementation for more types such as list or dicts
    // We do not include complex numbers of other objects from JS for now
    throw new Error(`Marshalling of Javascript type '${typeof value} is not implemented.`);
}
/**
 * Unmarshal py-slang Value into its JS representation
 * @param value py-slang Value to unmarshal
 * @returns JS value
 */
function unmarshalFromPy(value) {
    if (!value || typeof value.type !== 'string') {
        return value;
    }
    switch (value.type) {
        case 'bigint':
        case 'number':
        case 'string':
        case 'bool':
            return value.value;
        case 'complex':
            throw new Error('Passing complex number to external functions is not supported.');
        default:
            throw new Error(`Unmarshalling of py-slang type '${value.type}' is not supported for external functions.`);
    }
}

/**
 * Represents a python closure, the class is a runtime representation of a function.
 * Bundles the function's code (AST node) with environment in which its defined.
 * When Closure is called, a new environment will be created whose parent is the 'Environment' captured
 */
class PyClosure {
    constructor(node, environment, context, predefined = false, localVariables = new Set()) {
        this.type = 'PyClosure';
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
    static makeFromFunctionDef(node, environment, context, localVariables) {
        const closure = new PyClosure(node, environment, context, false, localVariables);
        return closure;
    }
    /**
     * Creates closure for Lambda
     */
    static makeFromLambda(node, environment, context, localVariables) {
        const closure = new PyClosure(node, environment, context, false, localVariables);
        return closure;
    }
}
/**
 * Represents a Javascript function that has been imported into js-slang from modules/
 * Wraps the JS function and marshal data between two languages
 * 1. Arguments from py-slang is marshalled to JS values
 * 2. Function call
 * 3. Return value from JS is marshalled back into py-slang value
 */
class JsClosure {
    constructor(signature, func, context) {
        this.signature = signature;
        this.func = func;
        this.context = context;
        this.type = 'JsClosure';
        this.id = uniqueId(context);
    }
    call(args) {
        const jsArgument = args.map(unmarshalFromPy);
        const result = this.func(...jsArgument);
        return marshalToPy(result, this.context);
    }
}

class Stack {
    constructor() {
        // Bottom of the array is at index 0
        this.storage = [];
    }
    push(...items) {
        for (const item of items) {
            this.storage.push(item);
        }
    }
    pop() {
        return this.storage.pop();
    }
    peek() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.storage[this.size() - 1];
    }
    size() {
        return this.storage.length;
    }
    isEmpty() {
        return this.size() == 0;
    }
    getStack() {
        // return a copy of the stack's contents
        return [...this.storage];
    }
    some(predicate) {
        return this.storage.some(predicate);
    }
}

class PyControl extends Stack {
    constructor(program) {
        super();
        this.numEnvDependentItems = 0;
        // Load program into control stack
        program ? this.push(program) : null;
    }
    canAvoidEnvInstr() {
        return this.numEnvDependentItems === 0;
    }
    // For testing purposes
    getNumEnvDependentItems() {
        return this.numEnvDependentItems;
    }
    // TODO in the future
    //   public pop(): PyControlItem | undefined {
    //       const item = super.pop();
    //       if (item !== undefined && isEnvDependent(item)) {
    //         this.numEnvDependentItems--;
    //       }
    //       return item;
    //     }
    //   public push(...items: PyControlItem[]): void {
    //     items.forEach((item: PyControlItem) => {
    //     // We keep this logic for future use with the stepper.
    //     if (isEnvDependent(item)) {
    //         this.numEnvDependentItems++;
    //     }
    //     });
    //   super.push(...items);
    //   }
    copy() {
        const newControl = new PyControl();
        const stackCopy = super.getStack();
        newControl.push(...stackCopy);
        return newControl;
    }
}

var InstrType;
(function (InstrType) {
    InstrType["END_OF_FUNCTION_BODY"] = "EndOfFunctionBody";
    InstrType["RESET"] = "Reset";
    InstrType["WHILE"] = "While";
    InstrType["FOR"] = "For";
    InstrType["ASSIGNMENT"] = "Assignment";
    InstrType["ANN_ASSIGNMENT"] = "AnnAssignment";
    InstrType["APPLICATION"] = "Application";
    InstrType["UNARY_OP"] = "UnaryOperation";
    InstrType["BINARY_OP"] = "BinaryOperation";
    InstrType["BOOL_OP"] = "BoolOperation";
    InstrType["COMPARE"] = "Compare";
    InstrType["CALL"] = "Call";
    InstrType["RETURN"] = "Return";
    InstrType["BREAK"] = "Break";
    InstrType["CONTINUE"] = "Continue";
    InstrType["IF"] = "If";
    InstrType["FUNCTION_DEF"] = "FunctionDef";
    InstrType["LAMBDA"] = "Lambda";
    InstrType["MULTI_LAMBDA"] = "MultiLambda";
    InstrType["GROUPING"] = "Grouping";
    InstrType["LITERAL"] = "Literal";
    InstrType["VARIABLE"] = "Variable";
    InstrType["TERNARY"] = "Ternary";
    InstrType["PASS"] = "Pass";
    InstrType["ASSERT"] = "Assert";
    InstrType["IMPORT"] = "Import";
    InstrType["GLOBAL"] = "Global";
    InstrType["NONLOCAL"] = "NonLocal";
    InstrType["Program"] = "Program";
    InstrType["BRANCH"] = "Branch";
    InstrType["POP"] = "Pop";
    InstrType["ENVIRONMENT"] = "environment";
    InstrType["MARKER"] = "marker";
})(InstrType || (InstrType = {}));

const assmtInstr = (symbol, constant, declaration, srcNode) => ({
    instrType: InstrType.ASSIGNMENT,
    symbol,
    constant,
    declaration,
    srcNode
});
const appInstr = (numOfArgs, srcNode) => ({
    instrType: InstrType.APPLICATION,
    numOfArgs,
    srcNode
});
const binOpInstr = (symbol, srcNode) => ({
    instrType: InstrType.BINARY_OP,
    symbol,
    srcNode
});
const resetInstr = (srcNode) => ({
    instrType: InstrType.RESET,
    srcNode
});
const branchInstr = (consequent, alternate, srcNode) => ({
    instrType: InstrType.BRANCH,
    consequent,
    alternate,
    srcNode
});
const unOpInstr = (symbol, srcNode) => ({
    instrType: InstrType.UNARY_OP,
    symbol,
    srcNode
});
const boolOpInstr = (symbol, srcNode) => ({
    instrType: InstrType.BOOL_OP,
    symbol,
    srcNode
});
const endOfFunctionBodyInstr = (srcNode) => ({
    instrType: InstrType.END_OF_FUNCTION_BODY,
    srcNode
});

class CSEBreak {
}
var ErrorType$1;
(function (ErrorType) {
    ErrorType["IMPORT"] = "Import";
    ErrorType["RUNTIME"] = "Runtime";
    ErrorType["SYNTAX"] = "Syntax";
    ErrorType["TYPE"] = "Type";
})(ErrorType$1 || (ErrorType$1 = {}));
var ErrorSeverity$1;
(function (ErrorSeverity) {
    ErrorSeverity["WARNING"] = "Warning";
    ErrorSeverity["ERROR"] = "Error";
})(ErrorSeverity$1 || (ErrorSeverity$1 = {}));
class PyComplexNumber {
    constructor(real, imag) {
        this.real = real;
        this.imag = imag;
    }
    static fromNumber(value) {
        return new PyComplexNumber(value, 0);
    }
    static fromBigInt(value) {
        return new PyComplexNumber(Number(value), 0);
    }
    static fromString(str) {
        if (!/[jJ]/.test(str)) {
            const realVal = Number(str);
            if (isNaN(realVal)) {
                throw new Error(`Invalid complex string: ${str}`);
            }
            return new PyComplexNumber(realVal, 0);
        }
        const lower = str.toLowerCase();
        if (lower.endsWith('j')) {
            const numericPart = str.substring(0, str.length - 1);
            if (numericPart === '' || numericPart === '+' || numericPart === '-') {
                const sign = (numericPart === '-') ? -1 : 1;
                return new PyComplexNumber(0, sign * 1);
            }
            const imagVal = Number(numericPart);
            if (isNaN(imagVal)) {
                throw new Error(`Invalid complex string: ${str}`);
            }
            return new PyComplexNumber(0, imagVal);
        }
        const match = str.match(/^([\+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?)([\+\-]\d+(\.\d+)?([eE][+\-]?\d+)?)?[jJ]?$/);
        if (!match) {
            throw new Error(`Invalid complex string: ${str}`);
        }
        const realPart = Number(match[1]);
        let imagPart = 0;
        if (match[4]) {
            imagPart = Number(match[4]);
        }
        return new PyComplexNumber(realPart, imagPart);
    }
    static fromValue(value) {
        if (value instanceof PyComplexNumber) {
            return new PyComplexNumber(value.real, value.imag);
        }
        if (typeof value === "number") {
            return PyComplexNumber.fromNumber(value);
        }
        if (typeof value === "bigint") {
            return PyComplexNumber.fromBigInt(value);
        }
        return PyComplexNumber.fromString(value);
    }
    /**
     * operations
     */
    add(other) {
        return new PyComplexNumber(this.real + other.real, this.imag + other.imag);
    }
    sub(other) {
        return new PyComplexNumber(this.real - other.real, this.imag - other.imag);
    }
    mul(other) {
        // (a+bi)*(c+di) = (ac - bd) + (bc + ad)i
        const realPart = this.real * other.real - this.imag * other.imag;
        const imagPart = this.real * other.imag + this.imag * other.real;
        return new PyComplexNumber(realPart, imagPart);
    }
    // https://github.com/python/cpython/blob/main/Objects/complexobject.c#L986
    // In the CPython source code, a branch algorithm is used for complex division.
    // It first compares the magnitudes of the dividend and divisor, and if some components are too large or too small, 
    // appropriate scaling is applied before performing the operation. 
    // This approach can significantly reduce overflow or underflow, thereby ensuring that the results remain more consistent with Python.
    div(other) {
        // (a+bi)/(c+di) = ((a+bi)*(c-di)) / (c^2 + d^2)
        const denominator = other.real * other.real + other.imag * other.imag;
        if (denominator === 0) {
            throw new Error(`Division by zero in complex number.`);
        }
        const a = this.real;
        const b = this.imag;
        const c = other.real;
        const d = other.imag;
        const absC = Math.abs(c);
        const absD = Math.abs(d);
        let real;
        let imag;
        if (absD < absC) {
            const ratio = d / c;
            const denom = c + d * ratio; // c + d*(d/c) = c + d^2/c
            real = (a + b * ratio) / denom;
            imag = (b - a * ratio) / denom;
        }
        else {
            const ratio = c / d;
            const denom = d + c * ratio; // d + c*(c/d) = d + c^2/d
            real = (a * ratio + b) / denom;
            imag = (b * ratio - a) / denom;
        }
        return new PyComplexNumber(real, imag);
        //const numerator = this.mul(new PyComplexNumber(other.real, -other.imag));
        //return new PyComplexNumber(numerator.real / denominator, numerator.imag / denominator);
    }
    pow(other) {
        // z = this (a+bi), w = other (A+Bi)
        const a = this.real;
        const b = this.imag;
        const A = other.real;
        const B = other.imag;
        const r = Math.sqrt(a * a + b * b);
        const theta = Math.atan2(b, a);
        if (r === 0) {
            // In Python, raising 0 to a negative or complex power raises an error.
            // For example, 0**(1j) in CPython directly raises ValueError: complex power.
            if (A < 0 || B !== 0) {
                throw new Error('0 cannot be raised to a negative or complex power');
            }
            // Otherwise, 0**(positive number) = 0.
            return new PyComplexNumber(0, 0);
        }
        const logR = Math.log(r);
        // realExpPart = A*ln(r) - B*theta
        // imagExpPart = B*ln(r) + A*theta
        const realExpPart = A * logR - B * theta;
        const imagExpPart = B * logR + A * theta;
        // e^(x + i y) = e^x [cos(y) + i sin(y)]
        const expOfReal = Math.exp(realExpPart);
        const c = expOfReal * Math.cos(imagExpPart);
        const d = expOfReal * Math.sin(imagExpPart);
        return new PyComplexNumber(c, d);
    }
    toString() {
        if (this.real === 0) {
            return `${this.imag}j`;
        }
        // if (this.imag === 0) {
        //     return `${this.real}`;
        // }
        const sign = (this.imag >= 0) ? "+" : "";
        // return `(${this.real}${sign}${this.imag}j)`;
        return `(${this.toPythonComplexFloat(this.real)}${sign}${this.toPythonComplexFloat(this.imag)}j)`;
    }
    /*
    * This function converts the real and imaginary parts of a complex number into strings.
    * In Python, float values (used for the real and imaginary parts) are formatted using scientific
    * notation when their absolute value is less than 1e-4 or at least 1e16. TypeScript's default
    * formatting thresholds differ, so here we explicitly enforce Python's behavior.
    *
    * The chosen bounds (1e-4 and 1e16) are derived from Python's internal formatting logic
    * (refer to the `format_float_short` function in CPython's pystrtod.c
    * (https://github.com/python/cpython/blob/main/Python/pystrtod.c)). This ensures that the
    * output of py-slang more closely matches that of native Python.
    */
    toPythonComplexFloat(num) {
        if (num === Infinity) {
            return "inf";
        }
        if (num === -Infinity) {
            return "-inf";
        }
        // Force scientific notation for values < 1e-4 or ≥ 1e16 to mimic Python's float formatting behavior.
        if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
            return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
        }
        return num.toString();
    }
    equals(other) {
        return (Number(this.real) === Number(other.real) && Number(this.imag) === Number(other.imag));
    }
}
// export class Representation {
//     constructor(public representation: string) {}
//     toString() {
//         return this.representation
//     }
// }
class Representation {
    constructor(representation) {
        this.representation = representation;
    }
    toString() {
        // call str(value) in stdlib
        // TODO: mapping
        return this.representation;
    }
}

// todo
// just put on here temporarily
const UNKNOWN_LOCATION = {
    start: {
        line: -1,
        column: -1
    },
    end: {
        line: -1,
        column: -1
    }
};
class PyRuntimeSourceError {
    constructor(node) {
        this.type = ErrorType$1.RUNTIME;
        this.severity = ErrorSeverity$1.ERROR;
        this.message = 'Unknown runtime error has occured';
        if (node) {
            this.location = {
                start: {
                    line: node.startToken.line,
                    column: node.startToken.col,
                },
                end: {
                    line: node.startToken.line,
                    column: node.startToken.col,
                }
            };
        }
        else {
            this.location = UNKNOWN_LOCATION;
        }
    }
    explain() {
        return '';
    }
    elaborate() {
        return this.explain();
    }
}

// Token names mostly identical to CPython https://github.com/python/cpython/blob/main/Lib/token.py.
// Main difference is that keywords are also a token type while in CPython they are generic name.
// We could also resolve special names at AST parse time.
// Also renamed some token names to make more sense.
var TokenType;
(function (TokenType) {
    //// Source S1
    TokenType[TokenType["ENDMARKER"] = 0] = "ENDMARKER";
    TokenType[TokenType["NAME"] = 1] = "NAME";
    TokenType[TokenType["NUMBER"] = 2] = "NUMBER";
    TokenType[TokenType["BIGINT"] = 3] = "BIGINT";
    TokenType[TokenType["STRING"] = 4] = "STRING";
    TokenType[TokenType["NEWLINE"] = 5] = "NEWLINE";
    TokenType[TokenType["INDENT"] = 6] = "INDENT";
    TokenType[TokenType["DEDENT"] = 7] = "DEDENT";
    TokenType[TokenType["LPAR"] = 8] = "LPAR";
    TokenType[TokenType["RPAR"] = 9] = "RPAR";
    TokenType[TokenType["COLON"] = 10] = "COLON";
    TokenType[TokenType["DOUBLECOLON"] = 11] = "DOUBLECOLON";
    TokenType[TokenType["COMMA"] = 12] = "COMMA";
    TokenType[TokenType["PLUS"] = 13] = "PLUS";
    TokenType[TokenType["MINUS"] = 14] = "MINUS";
    TokenType[TokenType["BANG"] = 15] = "BANG";
    TokenType[TokenType["STAR"] = 16] = "STAR";
    TokenType[TokenType["SLASH"] = 17] = "SLASH";
    TokenType[TokenType["VBAR"] = 18] = "VBAR";
    TokenType[TokenType["AMPER"] = 19] = "AMPER";
    TokenType[TokenType["LESS"] = 20] = "LESS";
    TokenType[TokenType["GREATER"] = 21] = "GREATER";
    TokenType[TokenType["EQUAL"] = 22] = "EQUAL";
    TokenType[TokenType["PERCENT"] = 23] = "PERCENT";
    TokenType[TokenType["DOUBLEEQUAL"] = 24] = "DOUBLEEQUAL";
    TokenType[TokenType["NOTEQUAL"] = 25] = "NOTEQUAL";
    TokenType[TokenType["LESSEQUAL"] = 26] = "LESSEQUAL";
    TokenType[TokenType["GREATEREQUAL"] = 27] = "GREATEREQUAL";
    TokenType[TokenType["DOUBLESTAR"] = 28] = "DOUBLESTAR";
    TokenType[TokenType["COMPLEX"] = 29] = "COMPLEX";
    // Special identifiers
    TokenType[TokenType["AND"] = 30] = "AND";
    TokenType[TokenType["OR"] = 31] = "OR";
    TokenType[TokenType["FOR"] = 32] = "FOR";
    TokenType[TokenType["WHILE"] = 33] = "WHILE";
    TokenType[TokenType["NONE"] = 34] = "NONE";
    TokenType[TokenType["TRUE"] = 35] = "TRUE";
    TokenType[TokenType["FALSE"] = 36] = "FALSE";
    TokenType[TokenType["IS"] = 37] = "IS";
    TokenType[TokenType["NOT"] = 38] = "NOT";
    TokenType[TokenType["ISNOT"] = 39] = "ISNOT";
    TokenType[TokenType["PASS"] = 40] = "PASS";
    TokenType[TokenType["DEF"] = 41] = "DEF";
    TokenType[TokenType["LAMBDA"] = 42] = "LAMBDA";
    TokenType[TokenType["FROM"] = 43] = "FROM";
    TokenType[TokenType["DOUBLESLASH"] = 44] = "DOUBLESLASH";
    TokenType[TokenType["BREAK"] = 45] = "BREAK";
    TokenType[TokenType["CONTINUE"] = 46] = "CONTINUE";
    TokenType[TokenType["RETURN"] = 47] = "RETURN";
    TokenType[TokenType["ASSERT"] = 48] = "ASSERT";
    TokenType[TokenType["IMPORT"] = 49] = "IMPORT";
    TokenType[TokenType["GLOBAL"] = 50] = "GLOBAL";
    TokenType[TokenType["NONLOCAL"] = 51] = "NONLOCAL";
    TokenType[TokenType["IF"] = 52] = "IF";
    TokenType[TokenType["ELSE"] = 53] = "ELSE";
    TokenType[TokenType["ELIF"] = 54] = "ELIF";
    TokenType[TokenType["IN"] = 55] = "IN";
    TokenType[TokenType["NOTIN"] = 56] = "NOTIN";
    //// Source s3
    TokenType[TokenType["RSQB"] = 57] = "RSQB";
    TokenType[TokenType["LSQB"] = 58] = "LSQB";
    TokenType[TokenType["ELLIPSIS"] = 59] = "ELLIPSIS";
    //// Unusued - Found in normal Python
    TokenType[TokenType["SEMI"] = 60] = "SEMI";
    TokenType[TokenType["DOT"] = 61] = "DOT";
    TokenType[TokenType["LBRACE"] = 62] = "LBRACE";
    TokenType[TokenType["RBRACE"] = 63] = "RBRACE";
    TokenType[TokenType["TILDE"] = 64] = "TILDE";
    TokenType[TokenType["CIRCUMFLEX"] = 65] = "CIRCUMFLEX";
    TokenType[TokenType["LEFTSHIFT"] = 66] = "LEFTSHIFT";
    TokenType[TokenType["RIGHTSHIFT"] = 67] = "RIGHTSHIFT";
    TokenType[TokenType["PLUSEQUAL"] = 68] = "PLUSEQUAL";
    TokenType[TokenType["MINEQUAL"] = 69] = "MINEQUAL";
    TokenType[TokenType["STAREQUAL"] = 70] = "STAREQUAL";
    TokenType[TokenType["SLASHEQUAL"] = 71] = "SLASHEQUAL";
    TokenType[TokenType["PERCENTEQUAL"] = 72] = "PERCENTEQUAL";
    TokenType[TokenType["AMPEREQUAL"] = 73] = "AMPEREQUAL";
    TokenType[TokenType["VBAREQUAL"] = 74] = "VBAREQUAL";
    TokenType[TokenType["CIRCUMFLEXEQUAL"] = 75] = "CIRCUMFLEXEQUAL";
    TokenType[TokenType["LEFTSHIFTEQUAL"] = 76] = "LEFTSHIFTEQUAL";
    TokenType[TokenType["RIGHTSHIFTEQUAL"] = 77] = "RIGHTSHIFTEQUAL";
    TokenType[TokenType["DOUBLESTAREQUAL"] = 78] = "DOUBLESTAREQUAL";
    TokenType[TokenType["DOUBLESLASHEQUAL"] = 79] = "DOUBLESLASHEQUAL";
    TokenType[TokenType["AT"] = 80] = "AT";
    TokenType[TokenType["ATEQUAL"] = 81] = "ATEQUAL";
    TokenType[TokenType["RARROW"] = 82] = "RARROW";
    TokenType[TokenType["COLONEQUAL"] = 83] = "COLONEQUAL";
    TokenType[TokenType["OP"] = 84] = "OP";
    TokenType[TokenType["AWAIT"] = 85] = "AWAIT";
    TokenType[TokenType["ASYNC"] = 86] = "ASYNC";
    TokenType[TokenType["TYPE_IGNORE"] = 87] = "TYPE_IGNORE";
    TokenType[TokenType["TYPE_COMMENT"] = 88] = "TYPE_COMMENT";
    TokenType[TokenType["YIELD"] = 89] = "YIELD";
    TokenType[TokenType["WITH"] = 90] = "WITH";
    TokenType[TokenType["DEL"] = 91] = "DEL";
    TokenType[TokenType["TRY"] = 92] = "TRY";
    TokenType[TokenType["EXCEPT"] = 93] = "EXCEPT";
    TokenType[TokenType["FINALLY"] = 94] = "FINALLY";
    TokenType[TokenType["RAISE"] = 95] = "RAISE";
})(TokenType || (TokenType = {}));

function toPythonFloat(num) {
    if (Object.is(num, -0)) {
        return "-0.0";
    }
    if (num === 0) {
        return "0.0";
    }
    if (num === Infinity) {
        return "inf";
    }
    if (num === -Infinity) {
        return "-inf";
    }
    if (Number.isNaN(num)) {
        return "nan";
    }
    if (Math.abs(num) >= 1e16 || (num !== 0 && Math.abs(num) < 1e-4)) {
        return num.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
    }
    if (Number.isInteger(num)) {
        return num.toFixed(1).toString();
    }
    return num.toString();
}
function toPythonString(obj) {
    let ret;
    if (!obj) {
        return 'None';
    }
    if (obj.type === 'bigint' || obj.type === 'complex') {
        ret = obj.value.toString();
    }
    else if (obj.type === 'number') {
        ret = toPythonFloat(obj.value);
    }
    else if (obj.type === 'bool') {
        if (obj.value === true) {
            return "True";
        }
        else {
            return "False";
        }
    }
    else if (obj.type === 'error') {
        return obj.message;
    }
    else if (obj instanceof PyClosure) {
        if (obj.node) {
            const funcName = obj.node.name?.lexeme || '(anonymous)';
            return `<function ${funcName}>`;
        }
    }
    else if (obj.value === undefined) {
        ret = 'None';
    }
    else {
        ret = obj.value.toString();
    }
    return ret;
}
class BuiltInFunctions {
    static print(context, ...args) {
        const output = args.map(arg => toPythonString(arg)).join(' ');
        context.output += output + '\n';
        return { type: 'undefined' };
    }
    static _int(context, ...args) {
        if (args.length === 0) {
            return { type: 'bigint', value: BigInt(0) };
        }
        const arg = args[0];
        if (arg.type === 'number') {
            const truncated = Math.trunc(arg.value);
            return { type: 'bigint', value: BigInt(truncated) };
        }
        if (arg.type === 'bigint') {
            return { type: 'bigint', value: arg.value };
        }
        // TODO: Use proper TypeError class once node is passed to built-ins
        return { type: 'error', message: `TypeError: int() argument must be a string, a bytes-like object or a real number, not '${arg.type}'` };
    }
}
// Load only the functions we have implemented
const builtIns = new Map();
builtIns.set('print', BuiltInFunctions.print);
builtIns.set('_int', BuiltInFunctions._int);

function pyHandleRuntimeError(context, error) {
    context.errors.push(error);
    throw error;
}
function typeTranslator(type) {
    switch (type) {
        case "bigint":
            return "int";
        case "number":
            return "float";
        case "boolean":
            return "bool";
        case "bool":
            return "bool";
        case "string":
            return "str";
        case "complex":
            return "complex";
        case "undefined":
            return "NoneType";
        default:
            return "unknown";
    }
}
// TODO: properly adapt for the rest, string is passed in to cater for __py_adder etc...
function operatorTranslator(operator) {
    switch (operator) {
        case TokenType.PLUS:
            return '+';
        case TokenType.MINUS:
            return '-';
        case TokenType.STAR:
            return '*';
        case TokenType.SLASH:
            return '/';
        case TokenType.DOUBLESLASH:
            return '//';
        case TokenType.PERCENT:
            return '%';
        case TokenType.DOUBLESTAR:
            return '**';
        case TokenType.LESS:
            return '<';
        case TokenType.GREATER:
            return '>';
        case TokenType.DOUBLEEQUAL:
            return '==';
        case TokenType.NOTEQUAL:
            return '!=';
        case TokenType.LESSEQUAL:
            return '<=';
        case TokenType.GREATEREQUAL:
            return '>=';
        case TokenType.NOT:
            return 'not';
        case TokenType.AND:
            return 'and';
        case TokenType.OR:
            return 'or';
        default:
            return String(operator);
    }
}
function pythonMod(a, b) {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
        const big_a = BigInt(a);
        const big_b = BigInt(b);
        const mod = big_a % big_b;
        if ((mod < 0n && big_b > 0n) || (mod > 0n && big_b < 0n)) {
            return mod + big_b;
        }
        else {
            return mod;
        }
    }
    // both are numbers
    const mod = a % b;
    if ((mod < 0 && b > 0) || (mod > 0 && b < 0)) {
        return mod + b;
    }
    else {
        return mod;
    }
}
function pyDefineVariable(context, name, value, env = currentEnvironment(context)) {
    Object.defineProperty(env.head, name, {
        value: value,
        writable: true,
        enumerable: true
    });
}
function pyGetVariable(code, context, name, node) {
    const env = currentEnvironment(context);
    if (env.closure && env.closure.localVariables.has(name)) {
        if (!env.head.hasOwnProperty(name)) {
            throw new UnboundLocalError(code, name, node);
        }
    }
    let currentEnv = env;
    while (currentEnv) {
        if (Object.prototype.hasOwnProperty.call(currentEnv.head, name)) {
            return currentEnv.head[name];
        }
        else {
            currentEnv = currentEnv.tail;
        }
    }
    if (builtIns.has(name)) {
        return builtIns.get(name);
    }
    throw new NameError(code, name, node);
}
function scanForAssignments(node) {
    const assignments = new Set();
    const visitor = (curNode) => {
        if (!curNode || typeof curNode !== 'object') {
            return;
        }
        const nodeType = curNode.constructor.name;
        if (nodeType === 'Assign') {
            assignments.add(curNode.name.lexeme);
        }
        else if (nodeType === 'FunctionDef' || nodeType === 'Lambda') {
            // detach here, nested functions have their own scope
            return;
        }
        // Recurse through all other properties of the node
        for (const key in curNode) {
            if (Object.prototype.hasOwnProperty.call(curNode, key)) {
                const child = curNode[key];
                if (Array.isArray(child)) {
                    child.forEach(visitor);
                }
                else if (child && typeof child === 'object' && child.hasOwnProperty('type')) {
                    visitor(child);
                }
            }
        }
    };
    if (Array.isArray(node)) {
        node.forEach(visitor);
    }
    else {
        visitor(node);
    }
    return assignments;
}

/* Searches backwards and forwards till it hits a newline */
function getFullLine$1(source, current) {
    let back = current;
    let forward = current;
    while (back > 0 && source[back] != '\n') {
        back--;
    }
    if (source[back] === '\n') {
        back++;
    }
    while (forward < source.length && source[forward] != '\n') {
        forward++;
    }
    const line = source.slice(0, back).split('\n').length;
    const fullLine = source.slice(back, forward);
    return { line, fullLine };
}
function createErrorIndicator$1(snippet, errorPos) {
    let indicator = "";
    for (let i = 0; i < snippet.length; i++) {
        indicator += (i === errorPos ? "^" : "~");
    }
    return indicator;
}
// export class TypeConcatenateError extends PyRuntimeSourceError {
//     constructor(source: string, node: ExprNS.Expr, wrongType: string) {
//         super(node);
//         this.type = ErrorType.TYPE;
//         let index = (node as any).symbol?.loc?.start?.index;
//         const { line, fullLine } = getFullLine(source, index);
//         const snippet = (node as any).symbol?.loc?.source ?? '<unknown source>';
//         let hint = 'TypeError: can only concatenate str (not "' + wrongType + '") to str.';
//         const offset = fullLine.indexOf(snippet);
//         const indicator = createErrorIndicator(snippet, '+');
//         const name = "TypeError";
//         const suggestion = "You are trying to concatenate a string with an " + wrongType + ". To fix this, convert the " + wrongType + " to a string using str(), or ensure both operands are of the same type.";
//         const msg = name + " at line " + line + "\n\n    " + fullLine + "\n    " + " ".repeat(offset) + indicator + "\n" + hint + "\n" + suggestion;
//         this.message = msg;
//     }
// }
class UnsupportedOperandTypeError extends PyRuntimeSourceError {
    constructor(source, node, wrongType1, wrongType2, operand) {
        super(node);
        this.type = ErrorType$1.TYPE;
        const operatorStr = operatorTranslator(operand);
        const typeStr1 = typeTranslator(wrongType1);
        const { line, fullLine } = getFullLine$1(source, node.startToken.indexInSource);
        const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length);
        const offset = fullLine.indexOf(snippet);
        const adjustedOffset = offset >= 0 ? offset : 0;
        const errorPos = node.operator.indexInSource - node.startToken.indexInSource;
        const indicator = createErrorIndicator$1(snippet, errorPos);
        let hint;
        let suggestion;
        if (wrongType2 === '') {
            // Format for Unary operators
            hint = `TypeError: bad operand type for unary ${operatorStr}: '${typeStr1}'`;
            suggestion = `You are using the unary '${operatorStr}' operator on '${typeStr1}', which is not a supported type for this operation.\nMake sure the operator is of the correct type.\n`;
        }
        else {
            // Format for Binary operators
            const typeStr2 = typeTranslator(wrongType2);
            hint = `TypeError: unsupported operand type(s) for ${operatorStr}: '${typeStr1}' and '${typeStr2}'`;
            suggestion = `You are using the '${operatorStr}' operator between '${typeStr1}' and '${typeStr2}', which are not compatible types for this operation.\nMake sure both operands are of the correct type.\n`;
        }
        // Assemble the final multi-line message
        this.message = `TypeError at line ${line}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`;
    }
}
class ZeroDivisionError extends PyRuntimeSourceError {
    constructor(source, node, context) {
        super(node);
        this.type = ErrorType$1.TYPE;
        const { line, fullLine } = getFullLine$1(source, node.startToken.indexInSource);
        const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length);
        const offset = fullLine.indexOf(snippet);
        const adjustedOffset = offset >= 0 ? offset : 0;
        const errorPos = node.operator.indexInSource - node.startToken.indexInSource;
        const indicator = createErrorIndicator$1(snippet, errorPos);
        const name = "ZeroDivisionError";
        const operator = node.operator.lexeme;
        let hint;
        switch (operator) {
            case '/':
                hint = 'ZeroDivisionError: division by zero.';
                break;
            case '//':
                hint = 'ZeroDivisionError: integer division or modulo by zero.';
                break;
            case '%':
                hint = 'ZeroDivisionError: integer modulo by zero.';
                break;
            case '**':
                hint = 'ZeroDivisionError: 0.0 cannot be raised to a negative power.';
                break;
            default:
                hint = 'ZeroDivisionError: division by zero.';
        }
        const suggestion = "You attempted to divide by zero. Division or modulo operations cannot be performed with a divisor of zero. Please ensure that the divisor is non-zero before performing the operation.";
        const msg = `${name} at line ${line}\n\n     ${fullLine}\n     ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`;
        this.message = msg;
    }
}
class UnboundLocalError extends PyRuntimeSourceError {
    constructor(source, name, node) {
        super(node);
        this.type = ErrorType$1.TYPE;
        const { line, fullLine } = getFullLine$1(source, node.startToken.indexInSource);
        const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length);
        const offset = fullLine.indexOf(snippet);
        const adjustedOffset = offset >= 0 ? offset : 0;
        const errorPos = 0;
        const indicator = createErrorIndicator$1(snippet, errorPos);
        const hint = `UnboundLocalError: cannot access local variable '${name}' where it is not associated with a value`;
        const suggestion = `The variable '${name}' is used in the current function, so it's considered a local variable. However, you tried to access it before a value was assigned to it in the local scope. Assign a value to '${name}' before you use it.`;
        const msg = `UnboundLocalError at line ${line}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`;
        this.message = msg;
    }
}
class NameError extends PyRuntimeSourceError {
    constructor(source, name, node) {
        super(node);
        this.type = ErrorType$1.TYPE;
        const { line, fullLine } = getFullLine$1(source, node.startToken.indexInSource);
        const snippet = source.substring(node.startToken.indexInSource, node.endToken.indexInSource + node.endToken.lexeme.length);
        const offset = fullLine.indexOf(snippet);
        const adjustedOffset = offset >= 0 ? offset : 0;
        const errorPos = 0;
        const indicator = createErrorIndicator$1(snippet, errorPos);
        const hint = `NameError: name '${name}' is not defined`;
        const suggestion = `The name '${name}' is not defined in the current scope. Check for typos or make sure the variable is assigned a value before being used.`;
        this.message = `NameError at line ${line}\n\n    ${fullLine}\n    ${' '.repeat(adjustedOffset)}${indicator}\n${hint}\n${suggestion}`;
    }
}
// export class StepLimitExceededError extends PyRuntimeSourceError {
//   constructor(source: string, node: ExprNS.Expr, context: PyContext) {
//     super(node);
//     this.type = ErrorType.RUNTIME;
//     const index = (node as any).loc?.start?.index
//                   ?? (node as any).srcNode?.loc?.start?.index
//                   ?? 0;
//     const { line, fullLine } = getFullLine(source, index);
//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>';
//     const indicator = createErrorIndicator(fullLine, '@');  // no target symbol
//     const name = 'StepLimitExceededError';
//     const hint = 'The evaluation has exceeded the maximum step limit.';
//     const offset = fullLine.indexOf(fullLine);
//     const adjustedOffset = offset >= 0 ? offset : 0;
//     const msg = [
//       `${name} at line ${line}`,
//       '',
//       '    ' + fullLine,
//       '    ' + ' '.repeat(adjustedOffset) + indicator,
//       hint
//     ].join('\n');
//     this.message = msg;
//   }
// }
// export class ValueError extends PyRuntimeSourceError {
//   constructor(source: string, node: ExprNS.Expr, context: PyContext, functionName: string) {
//     super(node);
//     this.type = ErrorType.TYPE;
//     const index = (node as any).loc?.start?.index
//                   ?? (node as any).srcNode?.loc?.start?.index
//                   ?? 0;
//     const { line, fullLine } = getFullLine(source, index);
//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>';
//     let hint = 'ValueError: math domain error. ';
//     const offset = fullLine.indexOf(snippet);
//     const indicator = createErrorIndicator(snippet, '@');
//     const name = "ValueError";
//     const suggestion = `Ensure that the input value(s) passed to '${functionName}' satisfy the mathematical requirements`;
//     const msg = name + " at line " + line + "\n\n    " + fullLine + "\n    " + " ".repeat(offset) + indicator + "\n" + hint + suggestion;
//     this.message = msg;
//   }
// }
// export class TypeError extends PyRuntimeSourceError {
//   constructor(source: string, node: ExprNS.Expr, context: PyContext, originalType: string, targetType: string) {
//     super(node);
//     originalType = typeTranslator(originalType);
//     this.type = ErrorType.TYPE;
//     const index = (node as any).loc?.start?.index
//                   ?? (node as any).srcNode?.loc?.start?.index
//                   ?? 0;
//     const { line, fullLine } = getFullLine(source, index);
//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>';
//     let hint = "TypeError: '" + originalType + "' cannot be interpreted as an '" + targetType + "'.";
//     const offset = fullLine.indexOf(snippet);
//     const adjustedOffset = offset >= 0 ? offset : 0;
//     const indicator = createErrorIndicator(snippet, '@');
//     const name = "TypeError";
//     const suggestion = ' Make sure the value you are passing is compatible with the expected type.';
//     const msg = name + " at line " + line + "\n\n    " + fullLine + "\n    " + " ".repeat(adjustedOffset) + indicator + "\n" + hint + suggestion;
//     this.message = msg;
//   }
// }
// export class SublanguageError extends PyRuntimeSourceError {
//   constructor (
//   source: string,
//   node: ExprNS.Expr,
//   context: PyContext,
//   functionName: string,
//   chapter: string,
//   details?: string
// ) {
//     super(node)
//     this.type = ErrorType.TYPE
//     const index = (node as any).loc?.start?.index
//                 ?? (node as any).srcNode?.loc?.start?.index
//                 ?? 0
//     const { line, fullLine } = getFullLine(source, index)
//     const snippet = (node as any).loc?.source
//                   ?? (node as any).srcNode?.loc?.source
//                   ?? '<unknown source>'
//     const offset = fullLine.indexOf(snippet)
//     const indicator = createErrorIndicator(snippet, '@')
//     const name = 'SublanguageError'
//     const hint = 'Feature not supported in Python §' + chapter + '. '
//     const suggestion = `The call to '${functionName}()' relies on behaviour that is valid in full Python but outside the Python §1 sublanguage${details ? ': ' + details : ''}.`
//     this.message = `${name} at line ${line}\n\n ${fullLine}\n ${' '.repeat(offset)}${indicator}\n${hint}${suggestion}`
//   }
// }

// Helper function for truthiness based on Python rules
function isFalsy(value) {
    switch (value.type) {
        case 'bigint':
            return value.value === 0n;
        case 'number':
            return value.value === 0;
        case 'bool':
            return !value.value;
        case 'string':
            return value.value === '';
        case 'complex':
            return value.value.real === 0 && value.value.imag == 0;
        case 'undefined': // Represents None
            return true;
        default:
            // All other objects are considered truthy
            return false;
    }
}
function evaluateBoolExpression(code, command, context, operator, left, right) {
    if (operator === TokenType.OR) {
        // Python 'or': if the first value is truthy, return it. Otherwise, evaluate and return the second value.
        return !isFalsy(left) ? left : right;
    }
    else if (operator === TokenType.AND) {
        // Python 'and': if the first value is falsy, return it. Otherwise, evaluate and return the second value.
        return isFalsy(left) ? left : right;
    }
    else {
        pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, typeTranslator(left.type), typeTranslator(right.type), operatorTranslator(operator)));
        return { type: 'error', message: `Unreachable in evaluateBoolExpression}` };
    }
}
function evaluateUnaryExpression(code, command, context, operator, value) {
    switch (operator) {
        case TokenType.NOT:
            return { type: 'bool', value: isFalsy(value) };
        case TokenType.MINUS:
            switch (value.type) {
                case 'number':
                    return { type: 'number', value: -value.value };
                case 'bigint':
                    return { type: 'bigint', value: -value.value };
                case 'bool':
                    return { type: 'bigint', value: value.value ? -1n : 0n };
                case 'complex':
                    return {
                        type: 'complex',
                        value: new PyComplexNumber(-value.value.real, -value.value.imag)
                    };
                default:
                    pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, value.type, "", operatorTranslator(operator)));
                    return { type: 'error', message: 'Unreachable in evaluateUnaryExpression - MINUS' };
            }
        case TokenType.PLUS:
            switch (value.type) {
                case 'number':
                case 'bigint':
                case 'complex':
                    return value;
                case 'bool':
                    return { type: 'bigint', value: value.value ? 1n : 0n };
                default:
                    pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, value.type, "", operatorTranslator(operator)));
                    return { type: 'error', message: 'Unreachable in evaluateUnaryExpression - PLUS' };
            }
    }
    return { type: 'error', message: 'Unreachable in evaluateUnaryExpression' };
}
// Remove __py_{operators} translation stage and switch case for readability
// TODO: do we need to string repetition like 'a' * 10?
function evaluateBinaryExpression(code, command, context, operator, left, right) {
    // Handle Complex numbers
    if (left.type === 'complex' || right.type === 'complex') {
        if (right.type !== 'complex' && right.type !== 'number' && right.type !== 'bigint' && right.type !== 'bool') {
            pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, left.type, right.type, operatorTranslator(operator)));
            return { type: 'error', message: 'Unreachable in evaluateBinaryExpression - complex | complex (start)' };
        }
        const leftComplex = PyComplexNumber.fromValue(left.value);
        const rightComplex = PyComplexNumber.fromValue(right.value);
        let result;
        switch (operator) {
            case TokenType.PLUS:
                result = leftComplex.add(rightComplex);
                break;
            case TokenType.MINUS:
                result = leftComplex.sub(rightComplex);
                break;
            case TokenType.STAR:
                result = leftComplex.mul(rightComplex);
                break;
            case TokenType.SLASH:
                result = leftComplex.div(rightComplex);
                break;
            case TokenType.DOUBLESTAR:
                result = leftComplex.pow(rightComplex);
                break;
            case TokenType.DOUBLEEQUAL: return { type: 'bool', value: leftComplex.equals(rightComplex) };
            case TokenType.NOTEQUAL: return { type: 'bool', value: !leftComplex.equals(rightComplex) };
            default:
                pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, left.type, right.type, operatorTranslator(operator)));
                return { type: 'error', message: 'Unreachable in evaluateBinaryExpression - complex | complex (end)' };
        }
        return { type: 'complex', value: result };
    }
    // Handle comparisons with None (represented as 'undefined' type)
    if (left.type === 'undefined' || right.type === 'undefined') {
        switch (operator) {
            case TokenType.DOUBLEEQUAL:
                // True only if both are None
                return { type: 'bool', value: left.type === right.type };
            case TokenType.NOTEQUAL:
                return { type: 'bool', value: left.type !== right.type };
            default:
                pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, left.type, right.type, operatorTranslator(operator)));
                return { type: 'error', message: 'Unreachable in evaluateBinaryExpression - undefined | undefined' };
        }
    }
    // Handle string operations
    if (left.type === 'string' || right.type === 'string') {
        if (operator === TokenType.PLUS) {
            if (left.type === 'string' && right.type === 'string') {
                return { type: 'string', value: left.value + right.value };
            }
            else {
                pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, left.type, right.type, operatorTranslator(operator)));
            }
        }
        if (left.type === 'string' && right.type === 'string') {
            switch (operator) {
                case TokenType.DOUBLEEQUAL:
                    return { type: 'bool', value: left.value === right.value };
                case TokenType.NOTEQUAL:
                    return { type: 'bool', value: left.value !== right.value };
                case TokenType.LESS:
                    return { type: 'bool', value: left.value < right.value };
                case TokenType.LESSEQUAL:
                    return { type: 'bool', value: left.value <= right.value };
                case TokenType.GREATER:
                    return { type: 'bool', value: left.value > right.value };
                case TokenType.GREATEREQUAL:
                    return { type: 'bool', value: left.value >= right.value };
            }
        }
        // TypeError: Reached if one is a string and the other is not
        pyHandleRuntimeError(context, new UnsupportedOperandTypeError(code, command, left.type, right.type, operatorTranslator(operator)));
        return { type: 'error', message: 'Unreachable in evaluateBinaryExpression - string | string' };
    }
    /**
     * Coerce boolean to a numeric value for all other arithmetic
     * Support for True - 1 or False + 1
     */
    const leftNum = left.type === 'bool' ? (left.value ? 1 : 0) : left.value;
    const rightNum = right.type === 'bool' ? (right.value ? 1 : 0) : right.value;
    const leftType = left.type === 'bool' ? 'number' : left.type;
    const rightType = right.type === 'bool' ? 'number' : right.type;
    // Numeric Operations (number or bigint)
    switch (operator) {
        case TokenType.PLUS:
        case TokenType.MINUS:
        case TokenType.STAR:
        case TokenType.SLASH:
        case TokenType.DOUBLESLASH:
        case TokenType.PERCENT:
        case TokenType.DOUBLESTAR:
            if (leftType === 'number' || rightType === 'number') {
                const l = Number(leftNum);
                const r = Number(rightNum);
                switch (operator) {
                    case TokenType.PLUS:
                        return { type: 'number', value: l + r };
                    case TokenType.MINUS:
                        return { type: 'number', value: l - r };
                    case TokenType.STAR:
                        return { type: 'number', value: l * r };
                    case TokenType.SLASH:
                        if (r === 0) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        return { type: 'number', value: l / r };
                    case TokenType.DOUBLESLASH:
                        if (r === 0) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        return { type: 'number', value: Math.floor(l / r) };
                    case TokenType.PERCENT:
                        if (r === 0) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        return { type: 'number', value: pythonMod(l, r) };
                    case TokenType.DOUBLESTAR:
                        if (l === 0 && r < 0) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        return { type: 'number', value: l ** r };
                }
            }
            if (leftType === 'bigint' && rightType === 'bigint') {
                const l = leftNum;
                const r = rightNum;
                switch (operator) {
                    case TokenType.PLUS: return { type: 'bigint', value: l + r };
                    case TokenType.MINUS: return { type: 'bigint', value: l - r };
                    case TokenType.STAR: return { type: 'bigint', value: l * r };
                    case TokenType.SLASH:
                        if (r === 0n) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        return { type: 'number', value: Number(l) / Number(r) };
                    case TokenType.DOUBLESLASH:
                        if (r === 0n) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        return { type: 'bigint', value: (l - pythonMod(l, r)) / r };
                    case TokenType.PERCENT:
                        if (r === 0n) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        return { type: 'bigint', value: pythonMod(l, r) };
                    case TokenType.DOUBLESTAR:
                        if (l === 0n && r < 0n) {
                            pyHandleRuntimeError(context, new ZeroDivisionError(code, command, context));
                        }
                        if (r < 0n)
                            return { type: 'number', value: Number(l) ** Number(r) };
                        return { type: 'bigint', value: l ** r };
                }
            }
            break;
        // Comparison Operators
        case TokenType.DOUBLEEQUAL:
        case TokenType.NOTEQUAL:
        case TokenType.LESS:
        case TokenType.LESSEQUAL:
        case TokenType.GREATER:
        case TokenType.GREATEREQUAL: {
            const cmp = pyCompare(left, right);
            let result;
            switch (operator) {
                case TokenType.DOUBLEEQUAL:
                    result = cmp === 0;
                    break;
                case TokenType.NOTEQUAL:
                    result = cmp !== 0;
                    break;
                case TokenType.LESS:
                    result = cmp < 0;
                    break;
                case TokenType.LESSEQUAL:
                    result = cmp <= 0;
                    break;
                case TokenType.GREATER:
                    result = cmp > 0;
                    break;
                case TokenType.GREATEREQUAL:
                    result = cmp >= 0;
                    break;
                default: return { type: 'error', message: 'Unreachable in evaluateBinaryExpression - comparison' };
            }
            return { type: 'bool', value: result };
        }
    }
    return { type: 'error', message: 'todo error' };
}
/**
 * TEMPORARY IMPLEMENTATION
 * This function is a simplified comparison between int and float
 * to mimic Python-like ordering semantics.
 *
 * TODO: In future, replace this with proper method dispatch to
 * __eq__, __lt__, __gt__, etc., according to Python's object model.
 *
 * pyCompare: Compares a Python-style big integer (int_num) with a float (float_num),
 * returning -1, 0, or 1 for less-than, equal, or greater-than.
 *
 * This logic follows CPython's approach in floatobject.c, ensuring Python-like semantics:
 *
 * 1. Special Values:
 *    - If float_num is inf, any finite int_num is smaller (returns -1).
 *    - If float_num is -inf, any finite int_num is larger (returns 1).
 *
 * 2. Compare by Sign:
 *    - Determine each number’s sign (negative, zero, or positive). If they differ, return based on sign.
 *    - If both are zero, treat them as equal.
 *
 * 3. Safe Conversion:
 *    - If |int_num| <= 2^53, safely convert it to a double and do a normal floating comparison.
 *
 * 4. Handling Large Integers:
 *    - For int_num beyond 2^53, approximate the magnitudes via exponent/bit length.
 *    - Compare the integer’s digit count with float_num’s order of magnitude.
 *
 * 5. Close Cases:
 *    - If both integer and float have the same digit count, convert float_num to a “big-int-like” string
 *      (approximateBigIntString) and compare lexicographically to int_num’s string.
 *
 * By layering sign checks, safe numeric range checks, and approximate comparisons,
 * we achieve a Python-like ordering of large integers vs floats.
 */
function pyCompare(val1, val2) {
    // Handle same type comparisons first
    if (val1.type === 'bigint' && val2.type === 'bigint') {
        if (val1.value < val2.value)
            return -1;
        if (val1.value > val2.value)
            return 1;
        return 0;
    }
    if (val1.type === 'number' && val2.type === 'number') {
        if (val1.value < val2.value)
            return -1;
        if (val1.value > val2.value)
            return 1;
        return 0;
    }
    // int_num.value < float_num.value => -1
    // int_num.value = float_num.value => 0
    // int_num.value > float_num.value => 1
    let int_val;
    let float_val;
    if (val1.type === 'bigint' && val2.type === 'number') {
        int_val = val1.value;
        float_val = val2.value;
    }
    else if (val1.type === 'number' && val2.type === 'bigint') {
        int_val = val2.value;
        float_val = val1.value;
        // for swapped order, swap the result of comparison here
        return -pyCompare(val2, val1);
    }
    else {
        return 0;
    }
    // If float_num is positive Infinity, then int_num is considered smaller.
    if (float_val === Infinity) {
        return -1;
    }
    if (float_val === -Infinity) {
        return 1;
    }
    const signInt = (int_val < 0n) ? -1 : (int_val > 0n ? 1 : 0);
    const signFlt = Math.sign(float_val); // -1, 0, or 1
    if (signInt < signFlt)
        return -1; // e.g. int<0, float>=0 => int < float
    if (signInt > signFlt)
        return 1; // e.g. int>=0, float<0 => int > float
    // Both have the same sign (including 0).
    // If both are zero, treat them as equal.
    if (signInt === 0 && signFlt === 0) {
        return 0;
    }
    // Both are either positive or negative.
    // If |int_num.value| is within 2^53, it can be safely converted to a JS number for an exact comparison.
    const absInt = int_val < 0n ? -int_val : int_val;
    const MAX_SAFE = 9007199254740991; // 2^53 - 1
    if (absInt <= MAX_SAFE) {
        // Safe conversion to double.
        const intAsNum = Number(int_val);
        const diff = intAsNum - float_val;
        if (diff === 0)
            return 0;
        return diff < 0 ? -1 : 1;
    }
    // For large integers exceeding 2^53, need to distinguish more carefully.
    // Determine the order of magnitude of float_num.value (via log10) and compare it with
    // the number of digits of int_num.value. An approximate comparison can indicate whether
    // int_num.value is greater or less than float_num.value.
    // First, check if float_num.value is nearly zero (but not zero).
    if (float_val === 0) {
        // Although signFlt would be 0 and handled above, just to be safe:
        return signInt;
    }
    const absFlt = Math.abs(float_val);
    // Determine the order of magnitude.
    const exponent = Math.floor(Math.log10(absFlt));
    // Get the decimal string representation of the absolute integer.
    const intStr = absInt.toString();
    const intDigits = intStr.length;
    // If exponent + 1 is less than intDigits, then |int_num.value| has more digits
    // and is larger (if positive) or smaller (if negative) than float_num.value.
    // Conversely, if exponent + 1 is greater than intDigits, int_num.value has fewer digits.
    const integerPartLen = exponent + 1;
    if (integerPartLen < intDigits) {
        // length of int_num.value is larger => all positive => int_num.value > float_num.value
        //                => all negative => int_num.value < float_num.value
        return (signInt > 0) ? 1 : -1;
    }
    else if (integerPartLen > intDigits) {
        // length of int_num.value is smaller => all positive => int_num.value < float_num.value
        //                => all negative => int_num.value > float_num.value
        return (signInt > 0) ? -1 : 1;
    }
    else {
        // If the number of digits is the same, they may be extremely close.
        // Method: Convert float_num.value into an approximate BigInt string and perform a lexicographical comparison.
        const floatApproxStr = approximateBigIntString(absFlt, 30);
        const aTrim = intStr.replace(/^0+/, '');
        const bTrim = floatApproxStr.replace(/^0+/, '');
        // If lengths differ after trimming, the one with more digits is larger.
        if (aTrim.length > bTrim.length) {
            return (signInt > 0) ? 1 : -1;
        }
        else if (aTrim.length < bTrim.length) {
            return (signInt > 0) ? -1 : 1;
        }
        else {
            // Same length: use lexicographical comparison.
            const cmp = aTrim.localeCompare(bTrim);
            if (cmp === 0) {
                return 0;
            }
            // cmp>0 => aTrim > bTrim => aVal > bVal
            return (cmp > 0) ? (signInt > 0 ? 1 : -1)
                : (signInt > 0 ? -1 : 1);
        }
    }
}
function approximateBigIntString(num, precision) {
    // Use scientific notation to obtain a string in the form "3.333333333333333e+49"
    const s = num.toExponential(precision);
    // Split into mantissa and exponent parts.
    // The regular expression matches strings of the form: /^([\d.]+)e([+\-]\d+)$/
    const match = s.match(/^([\d.]+)e([+\-]\d+)$/);
    if (!match) {
        // For extremely small or extremely large numbers, toExponential() should follow this format.
        // As a fallback, return Math.floor(num).toString()
        return Math.floor(num).toString();
    }
    let mantissaStr = match[1]; // "3.3333333333..."
    const exp = parseInt(match[2], 10); // e.g. +49
    // Remove the decimal point
    mantissaStr = mantissaStr.replace('.', '');
    // Get the current length of the mantissa string
    const len = mantissaStr.length;
    // Calculate the required integer length: for exp ≥ 0, we want the integer part
    // to have (1 + exp) digits.
    const integerLen = 1 + exp;
    if (integerLen <= 0) {
        // This indicates num < 1 (e.g., exponent = -1, mantissa = "3" results in 0.xxx)
        // For big integer comparison, such a number is very small, so simply return "0"
        return "0";
    }
    if (len < integerLen) {
        // The mantissa is not long enough; pad with zeros at the end.
        return mantissaStr.padEnd(integerLen, '0');
    }
    // If the mantissa is too long, truncate it (this is equivalent to taking the floor).
    // Rounding could be applied if necessary, but truncation is sufficient for comparison.
    return mantissaStr.slice(0, integerLen);
}

/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */
/**
 * Function that returns the appropriate Promise<Result> given the output of CSE machine evaluating, depending
 * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
 * @param context The context of the program.
 * @param value The value of CSE machine evaluating the program.
 * @returns The corresponding promise.
 */
function PyCSEResultPromise(context, value) {
    return new Promise((resolve, reject) => {
        if (value instanceof CSEBreak) {
            resolve({ status: 'suspended-cse-eval', context });
        }
        else if (value && value.type === 'error') {
            const errorValue = value;
            const representation = new Representation(errorValue.message);
            resolve({ status: 'finished', context, value, representation });
        }
        else {
            const representation = new Representation(toPythonString(value));
            resolve({ status: 'finished', context, value, representation });
        }
    });
}
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
function PyEvaluate(code, program, context, options) {
    try {
        context.runtime.isRunning = true;
        context.control = new PyControl(program);
        const result = pyRunCSEMachine(code, context, context.control, context.stash, options.envSteps, options.stepLimit, options.isPrelude || false);
        return context.output ? { type: "string", value: context.output } : result;
    }
    catch (error) {
        return { type: 'error', message: error.message };
    }
    finally {
        context.runtime.isRunning = false;
    }
}
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
function pyRunCSEMachine(code, context, control, stash, envSteps, stepLimit, isPrelude = false) {
    const eceState = pyGenerateCSEMachineStateStream(code, context, control, stash, envSteps, stepLimit, isPrelude);
    // Execute the generator until it completes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of eceState) {
    }
    // Return the value at the top of the storage as the result
    const result = stash.peek();
    return result !== undefined ? result : { type: 'undefined' };
}
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
function* pyGenerateCSEMachineStateStream(code, context, control, stash, envSteps, stepLimit, isPrelude = false) {
    // steps: number of steps completed
    let steps = 0;
    let command = control.peek();
    // Push first node to be evaluated into context.
    // The typeguard is there to guarantee that we are pushing a node (which should always be the case)
    if (command && !('instrType' in command)) {
        context.runtime.nodes.unshift(command);
    }
    while (command) {
        // TODO: until envChanging is implemented
        // if (!isPrelude && envChanging(command)) {
        //   // command is evaluated on the next step
        //   // Hence, next step will change the environment
        //   context.runtime.changepointSteps.push(steps + 1)
        // }
        control.pop();
        if (!('instrType' in command)) {
            // Command is an AST node
            const node = command;
            context.runtime.nodes.shift();
            context.runtime.nodes.unshift(node);
            const nodeType = node.constructor.name;
            if (pyCmdEvaluators[nodeType]) {
                pyCmdEvaluators[nodeType](code, command, context, control, stash, isPrelude);
            }
            else {
                throw new Error(`Unknown Python AST node type: ${nodeType}`);
            }
            if (context.runtime.break && context.runtime.debuggerOn) ;
        }
        else {
            // Command is an instruction
            const instr = command;
            if (pyCmdEvaluators[instr.instrType]) {
                pyCmdEvaluators[instr.instrType](code, command, context, control, stash, isPrelude);
            }
            else {
                throw new Error(`Unknown instruction type: ${instr.instrType}`);
            }
        }
        command = control.peek();
        steps += 1;
        if (!isPrelude) {
            context.runtime.envStepsTotal = steps;
        }
        yield { stash, control, steps };
    }
}
const pyCmdEvaluators = {
    /**
     * AST Node Handlers
     */
    'FileInput': (code, command, context, control, stash, isPrelude) => {
        const fileInput = command;
        const statements = fileInput.statements.slice().reverse();
        control.push(...statements);
    },
    'SimpleExpr': (code, command, context, control, stash, isPrelude) => {
        const simpleExpr = command;
        control.push(simpleExpr.expression);
    },
    'Literal': (code, command, context, control, stash, isPrelude) => {
        const literal = command;
        if (typeof literal.value === 'number') {
            stash.push({ type: 'number', value: literal.value });
        }
        else if (typeof literal.value === 'boolean') {
            stash.push({ type: 'bool', value: literal.value });
        }
        else if (typeof literal.value === 'string') {
            stash.push({ type: 'string', value: literal.value });
        }
        else {
            stash.push({ type: 'undefined' }); // For null
        }
    },
    'BigIntLiteral': (code, command, context, control, stash, isPrelude) => {
        const literal = command;
        stash.push({ type: 'bigint', value: BigInt(literal.value) });
    },
    'Unary': (code, command, context, control, stash, isPrelude) => {
        const unary = command;
        const op_instr = unOpInstr(unary.operator.type, unary);
        control.push(op_instr);
        control.push(unary.right);
    },
    'Binary': (code, command, context, control, stash, isPrelude) => {
        const binary = command;
        const op_instr = binOpInstr(binary.operator.type, binary);
        control.push(op_instr);
        control.push(binary.right);
        control.push(binary.left);
    },
    'BoolOp': (code, command, context, control, stash, isPrelude) => {
        const boolOp = command;
        control.push(boolOpInstr(boolOp.operator.type, boolOp));
        control.push(boolOp.right);
        control.push(boolOp.left);
    },
    'Grouping': (code, command, context, control, stash, isPrelude) => {
        const groupingNode = command;
        control.push(groupingNode.expression);
    },
    'Complex': (code, command, context, control, stash, isPrelude) => {
        const complexNode = command;
        stash.push({ type: 'complex', value: complexNode.value });
    },
    'None': (code, command, context, control, stash, isPrelude) => {
        stash.push({ type: 'undefined' });
    },
    'Variable': (code, command, context, control, stash, isPrelude) => {
        const variableNode = command;
        const name = variableNode.name.lexeme;
        // if not built in, look up in environment
        const value = pyGetVariable(code, context, name, variableNode);
        stash.push(value);
    },
    'Compare': (code, command, context, control, stash, isPrelude) => {
        const compareNode = command;
        // For now, we only handle simple, single comparisons.
        const op_instr = binOpInstr(compareNode.operator.type, compareNode);
        control.push(op_instr);
        control.push(compareNode.right);
        control.push(compareNode.left);
    },
    'Assign': (code, command, context, control, stash, isPrelude) => {
        const assignNode = command;
        const assmtInstr$1 = assmtInstr(assignNode.name.lexeme, false, true, assignNode);
        control.push(assmtInstr$1);
        control.push(assignNode.value);
    },
    'Call': (code, command, context, control, stash, isPrelude) => {
        const callNode = command;
        // push application instruction, track number of arguments
        control.push(appInstr(callNode.args.length, callNode));
        // push arguments onto stacks in reverse order
        for (let i = callNode.args.length - 1; i >= 0; i--) {
            control.push(callNode.args[i]);
        }
        // push function expression itself
        control.push(callNode.callee);
    },
    'FunctionDef': (code, command, context, control, stash, isPrelude) => {
        const functionDefNode = command;
        // find all local variables defined in function body
        const localVariables = scanForAssignments(functionDefNode.body);
        // create closure, capture function code and environment
        const closure = PyClosure.makeFromFunctionDef(functionDefNode, currentEnvironment(context), context, localVariables);
        // define function name in current environment and bind to new closure
        pyDefineVariable(context, functionDefNode.name.lexeme, closure);
    },
    'Lambda': (code, command, context, control, stash, isPrelude) => {
        const lambdaNode = command;
        // find all local variables defined in function body
        const localVariables = scanForAssignments(lambdaNode.body);
        //create closure, capturing current environment
        const closure = PyClosure.makeFromLambda(lambdaNode, currentEnvironment(context), context, localVariables);
        // lambda is expression, just push value onto stash
        stash.push(closure);
    },
    /**
     * Only handles explicit return for now
     * To handle implicit return None next
     */
    'Return': (code, command, context, control, stash, isPrelude) => {
        const returnNode = command;
        let head;
        while (true) {
            head = control.pop();
            // if stack is empty before RESET, break
            if (!head || (('instrType' in head) && head.instrType === InstrType.RESET)) {
                break;
            }
        }
        if (head) {
            control.push(head);
        }
        // explicit return 
        if (returnNode.value) {
            control.push(returnNode.value);
        }
        else {
            // if just return, returns None like implicit return
            stash.push({ type: 'undefined' });
        }
    },
    'If': (code, command, context, control, stash, isPrelude) => {
        const ifNode = command;
        // create branch instruction, wrap statement arrays in 'StatementSequence' objects
        const branch = branchInstr({ type: 'StatementSequence', body: ifNode.body }, ifNode.elseBlock
            ? (Array.isArray(ifNode.elseBlock)
                // 'else' block
                ? { type: 'StatementSequence', body: ifNode.elseBlock }
                // 'elif' block
                : ifNode.elseBlock)
            // 'else' block dont exist
            : null, ifNode);
        control.push(branch);
        control.push(ifNode.condition);
    },
    'Ternary': (code, command, context, control, stash, isPrelude) => {
        const ternaryNode = command;
        const branch = branchInstr(ternaryNode.consequent, ternaryNode.alternative, ternaryNode);
        control.push(branch);
        control.push(ternaryNode.predicate);
    },
    'FromImport': (code, command, context, control, stash, isPrelude) => {
        // TODO: nothing to do for now, we can implement it for CSE instructions later on
        // All modules are preloaded into the global environment by the runner.
        // When the code later uses the module name (e.g., 'runes'), pyGetVariable
        // will find it in the global scope.
    },
    /**
     * Instruction Handlers
     */
    [InstrType.UNARY_OP]: function (code, command, context, control, stash, isPrelude) {
        const instr = command;
        const argument = stash.pop();
        if (argument) {
            const result = evaluateUnaryExpression(code, instr.srcNode, context, instr.symbol, argument);
            stash.push(result);
        }
    },
    [InstrType.BINARY_OP]: function (code, command, context, control, stash, isPrelude) {
        const instr = command;
        const right = stash.pop();
        const left = stash.pop();
        if (left && right) {
            const result = evaluateBinaryExpression(code, instr.srcNode, context, instr.symbol, left, right);
            stash.push(result);
        }
    },
    [InstrType.BOOL_OP]: function (code, command, context, control, stash, isPrelude) {
        const instr = command;
        const right = stash.pop();
        const left = stash.pop();
        if (left && right) {
            const result = evaluateBoolExpression(code, instr.srcNode, context, instr.symbol, left, right);
            stash.push(result);
        }
    },
    [InstrType.ASSIGNMENT]: (code, command, context, control, stash, isPrelude) => {
        const instr = command;
        // Get the evaluated value from the stash
        const value = stash.pop();
        if (value) {
            pyDefineVariable(context, instr.symbol, value);
        }
    },
    [InstrType.APPLICATION]: (code, command, context, control, stash, isPrelude) => {
        const instr = command;
        const numOfArgs = instr.numOfArgs;
        // pop evaluated arguments from stash
        const args = [];
        for (let i = 0; i < numOfArgs; i++) {
            args.unshift(stash.pop());
        }
        // pop callable from stash
        const callable = stash.pop();
        if (callable instanceof PyClosure) {
            // User-defined function
            const closure = callable;
            // push reset and implicit return for cleanup at end of function
            control.push(resetInstr(instr.srcNode));
            // Only push endOfFunctionBodyInstr for functionDef
            if (closure.node.constructor.name === 'FunctionDef') {
                control.push(endOfFunctionBodyInstr(instr.srcNode));
            }
            // create new function environment
            const newEnv = createEnvironment(context, closure, args, instr.srcNode);
            pushEnvironment(context, newEnv);
            // push function body onto control stack
            const closureNode = closure.node;
            if (closureNode.constructor.name === 'FunctionDef') {
                // 'def' has a body of statements (an array)
                const bodyStmts = closureNode.body.slice().reverse();
                control.push(...bodyStmts);
            }
            else {
                // 'lambda' has a body with a single expression
                const bodyExpr = closureNode.body;
                control.push(bodyExpr);
            }
        }
        else if (callable instanceof JsClosure) {
            const result = callable.call(args);
            stash.push(marshalToPy(result));
        }
        else {
            // Built-in function from stdlib / constants
            const result = callable(context, ...args);
            stash.push(result);
        }
    },
    [InstrType.RESET]: (code, command, context, control, stash, isPrelude) => {
        popEnvironment(context);
    },
    [InstrType.END_OF_FUNCTION_BODY]: (code, command, context, control, stash, isPrelude) => {
        // this is only reached if function runs to completion without explicit return 
        stash.push({ type: 'undefined' });
    },
    [InstrType.BRANCH]: (code, command, context, control, stash, isPrelude) => {
        const instr = command;
        const condition = stash.pop();
        if (!isFalsy(condition)) {
            // Condition is truthy, execute the consequent
            const consequent = instr.consequent;
            if (consequent && 'type' in consequent && consequent.type === 'StatementSequence') {
                control.push(...consequent.body.slice().reverse());
            }
            else if (consequent) {
                // consequent of ternary or single statement
                control.push(consequent);
            }
        }
        else if (instr.alternate) {
            // Condition is falsy, execute the alternate
            const alternate = instr.alternate;
            if (alternate && 'type' in alternate && alternate.type === 'StatementSequence') {
                // 'else' block
                control.push(...alternate.body.slice().reverse());
            }
            else if (alternate) {
                // 'elif' or ternary alternative
                control.push(alternate);
            }
        }
        // If condition is falsy and there's no alternate, do nothing
    },
    [InstrType.POP]: (code, command, context, control, stash, isPrelude) => {
        stash.pop();
    },
};

var ErrorType;
(function (ErrorType) {
    ErrorType["IMPORT"] = "Import";
    ErrorType["RUNTIME"] = "Runtime";
    ErrorType["SYNTAX"] = "Syntax";
    ErrorType["TYPE"] = "Type";
})(ErrorType || (ErrorType = {}));
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["WARNING"] = "Warning";
    ErrorSeverity["ERROR"] = "Error";
})(ErrorSeverity || (ErrorSeverity = {}));
function createErrorIndicator(snippet, errorOp = '/') {
    const pos = snippet.indexOf(errorOp);
    let indicator = "";
    for (let i = 0; i < snippet.length; i++) {
        indicator += (i === pos ? "^" : "~");
    }
    return indicator;
}

/*
    The offset is calculated as follows:
    Current position is one after real position of end of token: 1
*/
const MAGIC_OFFSET = 1;
const SPECIAL_CHARS = new RegExp("[\\\\$'\"]", "g");
function escape(unsafe) {
    // @TODO escape newlines
    return unsafe.replace(SPECIAL_CHARS, "\\$&");
}
/* Searches backwards and forwards till it hits a newline */
function getFullLine(source, current) {
    let back = current;
    let forward = current;
    if (source[back] == '\n') {
        back--;
    }
    while (back > 0 && source[back] != '\n') {
        back--;
    }
    if (source[back] === '\n') {
        back++;
    }
    while (forward < source.length && source[forward] != '\n') {
        forward++;
    }
    const lineIndex = source.slice(0, back).split('\n').length;
    const msg = source.slice(back, forward);
    return { lineIndex, msg };
}
function toEstreeLocation(line, column, offset) {
    return { line, column, offset };
}
var TokenizerErrors;
(function (TokenizerErrors) {
    class BaseTokenizerError extends SyntaxError {
        constructor(message, line, col) {
            super(`SyntaxError at line ${line} column ${col - 1}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseTokenizerError";
            this.loc = toEstreeLocation(line, col, 0);
        }
    }
    TokenizerErrors.BaseTokenizerError = BaseTokenizerError;
    class UnknownTokenError extends BaseTokenizerError {
        constructor(token, line, col, source, current) {
            let { lineIndex, msg } = getFullLine(source, current - 1);
            msg = '\n' + msg + '\n';
            let hint = `${col > 1 ? '~' : ''}^~ Unknown token '${escape(token)}'`;
            // The extra `~` character takes up some space.
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), " ");
            super(msg + hint, lineIndex, col);
            this.name = "UnknownTokenError";
        }
    }
    TokenizerErrors.UnknownTokenError = UnknownTokenError;
    class UnterminatedStringError extends BaseTokenizerError {
        constructor(line, col, source, start, current) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = `^ Unterminated string`;
            const diff = (current - start);
            // +1 because we want the arrow to point after the string (where we expect the closing ")
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "~");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(msg + hint, lineIndex, col);
            this.name = "UnterminatedStringError";
        }
    }
    TokenizerErrors.UnterminatedStringError = UnterminatedStringError;
    class NonFourIndentError extends BaseTokenizerError {
        constructor(line, col, source, start) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = `^ This indent should be a multiple of 4 spaces. It's currently ${col} spaces.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "-");
            super(msg + hint, lineIndex, col);
            this.name = "NonFourIndentError";
        }
    }
    TokenizerErrors.NonFourIndentError = NonFourIndentError;
    class InvalidNumberError extends BaseTokenizerError {
        constructor(line, col, source, start, current) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = `^ Invalid Number input.`;
            const diff = (current - start);
            // +1 because we want the arrow to point after the string (where we expect the closing ")
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "~");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(msg + hint, lineIndex, col);
            this.name = "InvalidNumberError";
        }
    }
    TokenizerErrors.InvalidNumberError = InvalidNumberError;
    class InconsistentIndentError extends BaseTokenizerError {
        constructor(line, col, source, start) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = `^ This indent/dedent is inconsistent with other indents/dedents. It's currently ${col} spaces.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "-");
            super(msg + hint, lineIndex, col);
            this.name = "InconsistentIndentError";
        }
    }
    TokenizerErrors.InconsistentIndentError = InconsistentIndentError;
    class ForbiddenIdentifierError extends BaseTokenizerError {
        constructor(line, col, source, start) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = `^ This identifier is reserved for use in Python. Consider using another identifier.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "^");
            super(msg + hint, lineIndex, col);
            this.name = "ForbiddenIdentifierError";
        }
    }
    TokenizerErrors.ForbiddenIdentifierError = ForbiddenIdentifierError;
    class ForbiddenOperatorError extends BaseTokenizerError {
        constructor(line, col, source, start, current) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = ` This operator is reserved for use in Python. It's not allowed to be used.`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(msg + hint, lineIndex, col);
            this.name = "ForbiddenOperatorError";
        }
    }
    TokenizerErrors.ForbiddenOperatorError = ForbiddenOperatorError;
    class NonMatchingParenthesesError extends BaseTokenizerError {
        constructor(line, col, source, current) {
            let { lineIndex, msg } = getFullLine(source, current - 1);
            msg = '\n' + msg + '\n';
            let hint = `${col > 1 ? '~' : ''}^~ Non-matching closing parentheses.`;
            // The extra `~` character takes up some space.
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), " ");
            super(msg + hint, lineIndex, col);
            this.name = "NonMatchingParenthesesError";
        }
    }
    TokenizerErrors.NonMatchingParenthesesError = NonMatchingParenthesesError;
})(TokenizerErrors || (TokenizerErrors = {}));
var ParserErrors;
(function (ParserErrors) {
    class BaseParserError extends SyntaxError {
        constructor(message, line, col) {
            super(`SyntaxError at line ${line}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseParserError";
            this.loc = toEstreeLocation(line, col, 0);
        }
    }
    ParserErrors.BaseParserError = BaseParserError;
    class ExpectedTokenError extends BaseParserError {
        constructor(source, current, expected) {
            let { lineIndex, msg } = getFullLine(source, current.indexInSource - current.lexeme.length);
            msg = '\n' + msg + '\n';
            let hint = `^ ${expected}. Found '${escape(current.lexeme)}'.`;
            hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
            super(msg + hint, lineIndex, current.col);
            this.name = "ExpectedTokenError";
        }
    }
    ParserErrors.ExpectedTokenError = ExpectedTokenError;
    class NoElseBlockError extends BaseParserError {
        constructor(source, current) {
            let { lineIndex, msg } = getFullLine(source, current.indexInSource);
            msg = '\n' + msg + '\n';
            let hint = `^ Expected else block after this if block.`;
            hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
            super(msg + hint, lineIndex, current.col);
            this.name = "ExpectedTokenError";
        }
    }
    ParserErrors.NoElseBlockError = NoElseBlockError;
    class GenericUnexpectedSyntaxError extends BaseParserError {
        constructor(line, col, source, start, current) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = ` Detected invalid syntax.`;
            const indicator = createErrorIndicator(msg, '@');
            super(msg + indicator + hint, lineIndex, col);
            this.name = "GenericUnexpectedSyntaxError";
        }
    }
    ParserErrors.GenericUnexpectedSyntaxError = GenericUnexpectedSyntaxError;
})(ParserErrors || (ParserErrors = {}));
var ResolverErrors;
(function (ResolverErrors) {
    class BaseResolverError extends SyntaxError {
        constructor(name, message, line, col) {
            super(`${name} at line ${line}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseResolverError";
            this.loc = toEstreeLocation(line, col, 0);
        }
    }
    ResolverErrors.BaseResolverError = BaseResolverError;
    class NameNotFoundError extends BaseResolverError {
        constructor(line, col, source, start, current, suggestion) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = ` This name is not found in the current or enclosing environment(s).`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            if (suggestion !== null) {
                let sugg = ` Perhaps you meant to type '${suggestion}'?`;
                sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, " ");
                sugg = '\n' + sugg;
                hint += sugg;
            }
            const name = "NameNotFoundError";
            super(name, msg + hint, lineIndex, col);
            this.name = "NameNotFoundError";
        }
    }
    ResolverErrors.NameNotFoundError = NameNotFoundError;
    class NameReassignmentError extends BaseResolverError {
        constructor(line, col, source, start, current, oldName) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = ` A name has been declared here.`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            let { lineIndex: oldLine, msg: oldNameLine } = getFullLine(source, oldName.indexInSource);
            oldNameLine = '\n' + oldNameLine + '\n';
            let sugg = ` However, it has already been declared in the same environment at line ${oldLine}, here: `;
            sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, " ");
            sugg = '\n' + sugg;
            hint += sugg;
            oldNameLine.padStart(oldNameLine.length + col - MAGIC_OFFSET + 1, " ");
            hint += oldNameLine;
            const name = "NameReassignmentError";
            super(name, msg + hint, lineIndex, col);
            this.name = "NameReassignmentError";
        }
    }
    ResolverErrors.NameReassignmentError = NameReassignmentError;
})(ResolverErrors || (ResolverErrors = {}));
var TranslatorErrors;
(function (TranslatorErrors) {
    class BaseTranslatorError extends SyntaxError {
        constructor(message, line, col) {
            super(`BaseTranslatorError at line ${line} column ${col - 1}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseTranslatorError";
            this.loc = toEstreeLocation(line, col, 0);
        }
    }
    TranslatorErrors.BaseTranslatorError = BaseTranslatorError;
    class UnsupportedOperator extends BaseTranslatorError {
        constructor(line, col, source, start) {
            let { lineIndex, msg } = getFullLine(source, start);
            msg = '\n' + msg + '\n';
            let hint = `^ This operator is not yet supported by us.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, " ");
            super(msg + hint, lineIndex, col);
            this.name = "UnsupportedOperator";
        }
    }
    TranslatorErrors.UnsupportedOperator = UnsupportedOperator;
})(TranslatorErrors || (TranslatorErrors = {}));

/*
* Full disclosure: The general structure of this file is adapted from my own
* Rust implementation of a scanner
* https://github.com/Fidget-Spinner/crafting_interpreters/blob/main/rust/src/scanner.rs.
* That is in turn is adapted from the Java code written by the excellent book,
* "Crafting Interpreters" https://craftinginterpreters.com/scanning.html.
* Said book's copyright is under Robert Nystrom.
* I've included the MIT license that code snippets from
* the book is licensed under down below. See
* https://github.com/munificent/craftinginterpreters/blob/master/LICENSE
*
* The changes I've made: I have rewritten basically everything from scratch.
* Only the method names and overall method APIs
* are the same. Their internal behaviors are quite different as the scanner
* in the book parses a JS-like language, not Python.
*
* - The book was written in Java. I have written this in TypeScript.
* - The scanner supports a whitespace significant language now.
* - Also added support for column numbers for better error messages in the future.
* - Also added better errors.
* - Also added forbidden identifiers.
*
*
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to
    deal in the Software without restriction, including without limitation the
    rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
    sell copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
    IN THE SOFTWARE.
* */
class Token {
    constructor(type, lexeme, line, col, indexInSource) {
        this.type = type;
        this.lexeme = lexeme;
        this.line = line;
        this.col = col;
        this.indexInSource = indexInSource;
    }
}
const specialIdentifiers = new Map([
    ["and", TokenType.AND],
    ["or", TokenType.OR],
    ["while", TokenType.WHILE],
    ["for", TokenType.FOR],
    ["None", TokenType.NONE],
    ["is", TokenType.IS],
    ["not", TokenType.NOT],
    ["pass", TokenType.PASS],
    ["def", TokenType.DEF],
    ["lambda", TokenType.LAMBDA],
    ["from", TokenType.FROM],
    ["True", TokenType.TRUE],
    ["False", TokenType.FALSE],
    ["break", TokenType.BREAK],
    ["continue", TokenType.CONTINUE],
    ["return", TokenType.RETURN],
    ["assert", TokenType.ASSERT],
    ["import", TokenType.IMPORT],
    ["global", TokenType.GLOBAL],
    ["nonlocal", TokenType.NONLOCAL],
    ["if", TokenType.IF],
    ["elif", TokenType.ELIF],
    ["else", TokenType.ELSE],
    ["in", TokenType.IN],
]);
const SPECIAL_IDENTIFIER_TOKENS = Array.from(specialIdentifiers.values());
class Tokenizer {
    // forbiddenOperators: Set<TokenType>;
    constructor(source) {
        this.lexemeBuffer = "";
        this.source = source;
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.line = 0;
        this.col = 0;
        this.indentStack = [0];
        this.specialIdentifiers = specialIdentifiers;
        // Not used by us, but should be kept reserved as per Python spec
        this.forbiddenIdentifiers = new Map([
            ["async", TokenType.ASYNC],
            ["await", TokenType.AWAIT],
            ["yield", TokenType.YIELD],
            ["with", TokenType.WITH],
            ["del", TokenType.DEL],
            ["try", TokenType.TRY],
            ["except", TokenType.EXCEPT],
            ["finally", TokenType.FINALLY],
            ["raise", TokenType.RAISE],
        ]);
        // Operators that are valid in Python, but invalid for our use case.
        // this.forbiddenOperators = new Set([
        //     TokenType.AT,
        //     // Augmented assign e.g. *=
        //     TokenType.ATEQUAL,
        //     TokenType.PLUSEQUAL,
        //     TokenType.MINEQUAL,
        //     TokenType.STAREQUAL,
        //     TokenType.SLASHEQUAL,
        //     TokenType.PERCENTEQUAL,
        //     TokenType.AMPEREQUAL,
        //     TokenType.VBAREQUAL,
        //     TokenType.CIRCUMFLEXEQUAL,
        //     TokenType.LEFTSHIFTEQUAL,
        //     TokenType.RIGHTSHIFTEQUAL,
        //     TokenType.DOUBLESTAREQUAL,
        //     TokenType.DOUBLESLASHEQUAL,
        // ])
        this.parenthesesLevel = 0;
    }
    isAtEnd() {
        return this.current >= this.source.length;
    }
    advance() {
        const res = this.source[this.current];
        if (this.peek() == '\n') {
            this.line += 1;
        }
        this.current += 1;
        this.col += 1;
        return res;
    }
    advanceString(record) {
        const res = this.source[this.current];
        if (this.peek() == '\n') {
            this.line += 1;
        }
        this.current += 1;
        this.col += 1;
        if (record) {
            this.lexemeBuffer += res;
        }
        return res;
    }
    getBuffer() {
        console.info(this.lexemeBuffer);
    }
    addBuffer(c) {
        this.lexemeBuffer += c;
    }
    subtractBufferForThreeQuoteString() {
        if (this.lexemeBuffer.length >= 3) {
            this.lexemeBuffer = this.lexemeBuffer.slice(0, -3);
            return true;
        }
        else {
            return false;
        }
    }
    /* Single character lookahead. */
    peek() {
        return this.isAtEnd() ? '\0' : this.source[this.current];
    }
    /* Double character lookahead. */
    overwriteToken(type) {
        const previousToken = this.tokens[this.tokens.length - 1];
        const lexeme = this.source.slice(previousToken.indexInSource, this.current);
        this.tokens[this.tokens.length - 1] = new Token(type, lexeme, previousToken.line, previousToken.col, previousToken.indexInSource);
    }
    addToken(type) {
        const line = this.line;
        const col = this.col;
        const lexeme = this.source.slice(this.start, this.current);
        this.tokens.push(new Token(type, lexeme, line, col, this.current - lexeme.length));
    }
    addStringToken(type) {
        const line = this.line;
        const col = this.col;
        // Remove starting and ending quotes when slicing
        // Ensures that string is parsed properly
        const lexeme = this.source.slice(this.start + 1, this.current - 1);
        this.tokens.push(new Token(type, this.lexemeBuffer, line, col, this.current - lexeme.length));
        this.lexemeBuffer = "";
    }
    addMultiLineStringToken(type) {
        const line = this.line;
        const col = this.col;
        // Remove three starting and ending quotes when slicing
        const lexeme = this.source.slice(this.start + 3, this.current - 3);
        this.tokens.push(new Token(type, this.lexemeBuffer, line, col, this.current - lexeme.length));
        this.lexemeBuffer = "";
    }
    // Checks that the current character matches a pattern. If so the character is consumed, else nothing is consumed.
    matches(pattern) {
        if (this.isAtEnd()) {
            return false;
        }
        else {
            if (this.source[this.current] === pattern) {
                this.col += 1;
                this.current += 1;
                return true;
            }
            return false;
        }
    }
    isLegalUnicode(c) {
        if (this.isDelimiter(c)) {
            return false;
        }
        return c.length === 1 && !/^\p{Nd}$/u.test(c);
    }
    isAlpha(c) {
        return /^[A-Za-z]$/i.test(c);
    }
    isDigit(c) {
        return /^[0-9]/.test(c);
    }
    isHexa(c) {
        return /^[0-9A-F]$/i.test(c);
    }
    isOcta(c) {
        return /^[0-7]/.test(c);
    }
    isBinary(c) {
        return /^[0-1]/.test(c);
    }
    // TODO: unicode
    isIdentifier(c) {
        if (/\s/.test(c)) {
            return false;
        }
        return c === '_' || this.isAlpha(c) || this.isDigit(c) || this.isLegalUnicode(c);
    }
    isDelimiter(c) {
        return /[\p{P}\p{S}]/u.test(c);
    }
    baseNumber() {
        switch (this.peek()) {
            case 'x':
                this.advance();
                if (!this.isHexa(this.peek())) {
                    throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                }
                while (this.isHexa(this.peek())) {
                    this.advance();
                }
                this.addToken(TokenType.BIGINT);
                break;
            case 'o':
                this.advance();
                if (!this.isOcta(this.peek())) {
                    throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                }
                while (this.isOcta(this.peek())) {
                    this.advance();
                }
                this.addToken(TokenType.BIGINT);
                break;
            case 'b':
                this.advance();
                if (!this.isBinary(this.peek())) {
                    throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                }
                while (this.isBinary(this.peek())) {
                    this.advance();
                }
                this.addToken(TokenType.BIGINT);
                break;
            default:
                while (this.isDigit(this.peek())) {
                    this.advance();
                }
                if (this.peek() !== '.' && this.peek() !== 'e') {
                    // if ends with j and J then complex number
                    if (this.peek() === 'j' || this.peek() === 'J') {
                        this.advance();
                        this.addToken(TokenType.COMPLEX);
                        return;
                    }
                    this.addToken(TokenType.BIGINT);
                    return;
                }
                if (this.peek() === '.') {
                    this.advance();
                    if (this.peek() === '_') {
                        // TODO:
                        // throw new error
                        throw new Error('_ after .');
                    }
                    while (this.isDigit(this.peek())) {
                        this.advance();
                    }
                }
                if (this.peek() === '_') {
                    this.advance();
                }
                if (this.peek() === 'e') {
                    this.advance();
                    if (this.peek() === '-') {
                        this.advance();
                    }
                    if (this.peek() === '+') {
                        this.advance();
                    }
                    if (!this.isDigit(this.peek())) {
                        throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                    }
                    while (this.isDigit(this.peek())) {
                        this.advance();
                    }
                }
                // if ends with j and J then complex number
                if (this.peek() === 'j' || this.peek() === 'J') {
                    this.advance();
                    this.addToken(TokenType.COMPLEX);
                }
                else {
                    this.addToken(TokenType.NUMBER);
                }
        }
    }
    number(c) {
        while ((this.isDigit(this.peek()) || this.peek() === '_') && c !== '.') {
            if (this.peek() === '_') {
                this.advance();
                if (!this.isDigit(this.peek())) {
                    throw new Error("Invalid use of underscore in number");
                }
            }
            else {
                this.advance();
            }
        }
        if (this.peek() !== '.' && this.peek() !== 'e' && c !== '.') {
            // if ends with j and J then complex number
            if (this.peek() === 'j' || this.peek() === 'J') {
                this.advance();
                this.addToken(TokenType.COMPLEX);
                return;
            }
            this.addToken(TokenType.BIGINT);
            return;
        }
        // Fractional part
        if ((this.peek() === '.' && c !== '.') || (this.peek() !== '.' && c === '.')) {
            this.advance();
            if (this.peek() === '_') {
                // TODO:
                // throw new error
                throw new Error('_ after .');
            }
            while (this.isDigit(this.peek()) || this.peek() === '_') {
                if (this.peek() === '_') {
                    this.advance();
                    if (!this.isDigit(this.peek())) {
                        throw new Error("Invalid use of underscore in number");
                    }
                }
                else {
                    this.advance();
                }
            }
        }
        // Exponent part
        if (this.peek() === 'e') {
            this.advance();
            if (this.peek() === '-') {
                this.advance();
            }
            if (this.peek() === '+') {
                this.advance();
            }
            if (!this.isDigit(this.peek())) {
                throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
            }
            while (this.isDigit(this.peek()) || this.peek() === '_') {
                if (this.peek() === '_') {
                    this.advance();
                    if (!this.isDigit(this.peek())) {
                        throw new Error("Invalid use of underscore in number");
                    }
                }
                else {
                    this.advance();
                }
            }
        }
        // if ends with j and J then complex number
        if (this.peek() === 'j' || this.peek() === 'J') {
            this.advance();
            this.addToken(TokenType.COMPLEX);
        }
        else {
            this.addToken(TokenType.NUMBER);
        }
        //this.addToken(TokenType.NUMBER);
    }
    name() {
        while (this.isIdentifier(this.peek())) {
            this.advance();
        }
        const identifier = this.source.slice(this.start, this.current);
        if (!!this.forbiddenIdentifiers.get(identifier)) {
            throw new TokenizerErrors.ForbiddenIdentifierError(this.line, this.col, this.source, this.start);
        }
        const specialIdent = this.specialIdentifiers.get(identifier);
        if (specialIdent !== undefined) {
            /* Merge multi-token operators, like 'is not', 'not in' */
            const previousToken = this.tokens[this.tokens.length - 1];
            switch (specialIdent) {
                case TokenType.NOT:
                    if (previousToken && previousToken.type === TokenType.IS) {
                        this.overwriteToken(TokenType.ISNOT);
                    }
                    else {
                        this.addToken(specialIdent);
                    }
                    return;
                case TokenType.IN:
                    if (previousToken.type === TokenType.NOT) {
                        this.overwriteToken(TokenType.NOTIN);
                    }
                    else {
                        this.addToken(specialIdent);
                    }
                    return;
                default:
                    this.addToken(specialIdent);
            }
        }
        else {
            this.addToken(TokenType.NAME);
        }
    }
    scanToken() {
        const c = this.advance();
        // KJ: I really hope the JS runtime optimizes this to a jump table...
        switch (c) {
            //// SPECIAL MARKERS
            // Comment -- advance to end of line.
            case '#':
                while ((this.peek() !== '\n' && this.peek() !== '\r') && !this.isAtEnd()) {
                    this.advance();
                }
                break;
            case ':':
                this.addToken(this.matches(':') ? TokenType.DOUBLECOLON : TokenType.COLON);
                break;
            // All non-significant whitespace
            case ' ':
                break;
            // CR LF on Windows
            case '\r':
                if (this.matches('\n')) ;
                else {
                    break;
                }
            case '\n':
                if (this.parenthesesLevel > 0) {
                    this.line += 1;
                    this.col = 0;
                    break;
                }
                this.addToken(TokenType.NEWLINE);
                this.line += 1;
                this.col = 0;
                let accLeadingWhiteSpace = 0;
                // Detect significant whitespace
                while (this.peek() === " " && !this.isAtEnd()) {
                    accLeadingWhiteSpace += 1;
                    // Consume the rest of the line's leading whitespace.
                    this.advance();
                }
                // Handles comments
                if (this.peek() === "#") {
                    while ((this.peek() !== '\n' && this.peek() !== '\r') && !this.isAtEnd()) {
                        this.advance();
                    }
                }
                // The following block handles things like
                /*
                def foo():
                    pass
                             <---- this newline should be zapped
                    pass     <---- this should be part of the block
                 */
                while ((this.peek() === "\n" || this.peek() === "\r") && !this.isAtEnd()) {
                    // Handle \r\n on Windows
                    if (this.peek() === "\r") {
                        this.advance();
                        if (this.peek() === "\n") {
                            this.advance();
                        }
                    }
                    else {
                        this.advance();
                    }
                    this.line += 1;
                    this.col = 0;
                    accLeadingWhiteSpace = 0;
                    // Detect significant whitespace
                    while (this.peek() === " " && !this.isAtEnd()) {
                        accLeadingWhiteSpace += 1;
                        // Consume the rest of the line's leading whitespace.
                        this.advance();
                    }
                }
                if (accLeadingWhiteSpace % 4 !== 0) {
                    throw new TokenizerErrors.NonFourIndentError(this.line, this.col, this.source, this.current);
                }
                const tos = this.indentStack[this.indentStack.length - 1];
                if (accLeadingWhiteSpace > tos) {
                    this.indentStack.push(accLeadingWhiteSpace);
                    const indents = Math.floor((accLeadingWhiteSpace - tos) / 4);
                    for (let i = 0; i < indents; ++i) {
                        this.addToken(TokenType.INDENT);
                    }
                }
                else if (accLeadingWhiteSpace < tos) {
                    if (this.indentStack.length == 0) {
                        throw new TokenizerErrors.InconsistentIndentError(this.line, this.col, this.source, this.current);
                    }
                    const prev = this.indentStack[this.indentStack.length - 1];
                    if (prev === undefined || prev === null) {
                        throw new TokenizerErrors.InconsistentIndentError(this.line, this.col, this.source, this.current);
                    }
                    const indents = Math.floor((prev - accLeadingWhiteSpace) / 4);
                    for (let i = 0; i < indents; ++i) {
                        this.indentStack.pop();
                        this.addToken(TokenType.DEDENT);
                    }
                }
                break;
            // String
            case '"':
            case "'":
                let quote = c;
                if (this.peek() == quote) { // handle multi-line string
                    this.advance(); // second quote found and consumed
                    if (this.peek() != quote) { // empty string ""
                        this.addStringToken(TokenType.STRING);
                        break;
                    }
                    this.advance(); // third quote consumed
                    let quote_sum = 0;
                    while (true) {
                        while (this.peek() != quote && !this.isAtEnd()) {
                            quote_sum = 0;
                            if (this.peek() === '\\') {
                                this.advanceString(false);
                                switch (this.peek()) {
                                    case '\n':
                                        break;
                                    case '\\':
                                        this.addBuffer('\\');
                                        break;
                                    case '\'':
                                        this.addBuffer('\'');
                                        break;
                                    case '\"':
                                        this.addBuffer('\"');
                                        break;
                                    case 'a':
                                        this.addBuffer('\a');
                                        break;
                                    case 'b':
                                        this.addBuffer('\b');
                                        break;
                                    case 'f':
                                        this.addBuffer('\f');
                                        break;
                                    case 'n':
                                        this.addBuffer('\n');
                                        break;
                                    case 'r':
                                        this.addBuffer('\r');
                                        break;
                                    case 't':
                                        this.addBuffer('\t');
                                        break;
                                    case 'v':
                                        this.addBuffer('\v');
                                        break;
                                    default:
                                        throw new Error("SyntaxWarning: invalid escape sequence");
                                }
                                this.advanceString(false);
                            }
                            else {
                                this.advanceString(true);
                            }
                            //this.advance(); // advance until ending quote found
                        }
                        if (this.isAtEnd()) {
                            throw new TokenizerErrors.UnterminatedStringError(this.line, this.col, this.source, this.start, this.current);
                        }
                        if (this.peek() == quote) {
                            this.advanceString(true);
                            quote_sum++;
                        }
                        //this.advance(); // consume first ending quote
                        // if (this.peek() != quote) {
                        //     throw new TokenizerErrors.UnterminatedStringError(this.line,
                        //         this.col, this.source, this.start, this.current);
                        // }
                        // this.advance();
                        if (quote_sum === 3) {
                            this.subtractBufferForThreeQuoteString();
                            // console.info('endof3quote');
                            // this.getBuffer();
                            break;
                        }
                    }
                    // // consume second ending quote
                    // if (this.peek() != quote) {
                    //     throw new TokenizerErrors.UnterminatedStringError(this.line,
                    //         this.col, this.source, this.start, this.current);
                    // }
                    // this.advance(); // consume third ending quote
                    this.addMultiLineStringToken(TokenType.STRING);
                }
                else { // other case, single-line string
                    while (this.peek() !== quote && this.peek() !== '\n' && !this.isAtEnd()) {
                        if (this.peek() === '\\') {
                            this.advanceString(false);
                            switch (this.peek()) {
                                case '\n':
                                    break;
                                case '\\':
                                    this.addBuffer('\\');
                                    break;
                                case '\'':
                                    this.addBuffer('\'');
                                    break;
                                case '\"':
                                    this.addBuffer('\"');
                                    break;
                                case 'a':
                                    this.addBuffer('\a');
                                    break;
                                case 'b':
                                    this.addBuffer('\b');
                                    break;
                                case 'f':
                                    this.addBuffer('\f');
                                    break;
                                case 'n':
                                    this.addBuffer('\n');
                                    break;
                                case 'r':
                                    this.addBuffer('\r');
                                    break;
                                case 't':
                                    this.addBuffer('\t');
                                    break;
                                case 'v':
                                    this.addBuffer('\v');
                                    break;
                                default:
                                    throw new Error("SyntaxWarning: invalid escape sequence");
                            }
                            this.advanceString(false);
                        }
                        else {
                            this.advanceString(true);
                        }
                    }
                    // should look for \\
                    if (this.peek() === '\n' || this.isAtEnd()) {
                        throw new TokenizerErrors.UnterminatedStringError(this.line, this.col, this.source, this.start, this.current);
                    }
                    // Consume Closing "
                    this.advance();
                    this.addStringToken(TokenType.STRING);
                }
                break;
            // Number... I wish JS had match statements :(
            case '0':
                this.baseNumber();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
            case '.':
                this.number(c);
                break;
            //// Everything else
            case '(':
                this.addToken(TokenType.LPAR);
                this.parenthesesLevel++;
                break;
            case ')':
                this.addToken(TokenType.RPAR);
                if (this.parenthesesLevel === 0) {
                    throw new TokenizerErrors.NonMatchingParenthesesError(this.line, this.col, this.source, this.current);
                }
                this.parenthesesLevel--;
                break;
            case ',':
                this.addToken(TokenType.COMMA);
                break;
            //// OPERATORS
            case '-':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(TokenType.MINUS);
                break;
            case '+':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(TokenType.PLUS);
                break;
            case '*':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(this.matches('*') ? TokenType.DOUBLESTAR : TokenType.STAR);
                break;
            case '/':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(this.matches('/') ? TokenType.DOUBLESLASH : TokenType.SLASH);
                break;
            case '%':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(TokenType.PERCENT);
                break;
            case '!':
                this.addToken(this.matches('=') ? TokenType.NOTEQUAL : TokenType.BANG);
                break;
            case '=':
                this.addToken(this.matches('=') ? TokenType.DOUBLEEQUAL : TokenType.EQUAL);
                break;
            case '<':
                this.addToken(this.matches('=') ? TokenType.LESSEQUAL : TokenType.LESS);
                break;
            case '>':
                this.addToken(this.matches('=') ? TokenType.GREATEREQUAL : TokenType.GREATER);
                break;
            default:
                // Identifier start
                // TODO: unicode
                if (c === '_' || this.isAlpha(c) || this.isLegalUnicode(c)) {
                    this.name();
                    break;
                }
                this.matchForbiddenOperator(c);
                throw new TokenizerErrors.UnknownTokenError(c, this.line, this.col, this.source, this.current);
        }
    }
    matchForbiddenOperator(ch) {
        switch (ch) {
            case '@':
            case '|':
            case '&':
            case '~':
            case '^':
                this.matches('=');
                this.raiseForbiddenOperator();
                break;
        }
    }
    scanEverything() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }
        // Unravel the indent stack
        while (this.indentStack[this.indentStack.length - 1] !== 0) {
            this.indentStack.pop();
            this.addToken(TokenType.DEDENT);
        }
        this.tokens.push(new Token(TokenType.ENDMARKER, "", this.line, this.col, this.current));
        return this.tokens;
    }
    printTokens() {
        for (const token of this.tokens) {
            console.log(`${token.indexInSource}:${token.line}-${token.line},${token.indexInSource + token.lexeme.length}\t\t\t\
            ${TokenType[token.type]}\t\t\t'${token.lexeme}'`);
        }
    }
    raiseForbiddenOperator() {
        throw new TokenizerErrors.ForbiddenOperatorError(this.line, this.col, this.source, this.start, this.current);
    }
}

var ExprNS;
(function (ExprNS) {
    class Expr {
        constructor(startToken, endToken) {
            this.startToken = startToken;
            this.endToken = endToken;
        }
    }
    ExprNS.Expr = Expr;
    class None extends Expr {
        constructor(startToken, endToken, value = "None") {
            super(startToken, endToken);
        }
        accept(visitor) {
            return visitor.visitNoneExpr(this);
        }
    }
    ExprNS.None = None;
    class BigIntLiteral extends Expr {
        constructor(startToken, endToken, value) {
            super(startToken, endToken);
            this.value = value;
        }
        accept(visitor) {
            return visitor.visitBigIntLiteralExpr(this);
        }
    }
    ExprNS.BigIntLiteral = BigIntLiteral;
    class Complex extends Expr {
        constructor(startToken, endToken, value) {
            super(startToken, endToken);
            this.value = PyComplexNumber.fromString(value);
        }
        accept(visitor) {
            return visitor.visitComplexExpr(this);
        }
    }
    ExprNS.Complex = Complex;
    class Binary extends Expr {
        constructor(startToken, endToken, left, operator, right) {
            super(startToken, endToken);
            this.left = left;
            this.operator = operator;
            this.right = right;
        }
        accept(visitor) {
            return visitor.visitBinaryExpr(this);
        }
    }
    ExprNS.Binary = Binary;
    class Compare extends Expr {
        constructor(startToken, endToken, left, operator, right) {
            super(startToken, endToken);
            this.left = left;
            this.operator = operator;
            this.right = right;
        }
        accept(visitor) {
            return visitor.visitCompareExpr(this);
        }
    }
    ExprNS.Compare = Compare;
    class BoolOp extends Expr {
        constructor(startToken, endToken, left, operator, right) {
            super(startToken, endToken);
            this.left = left;
            this.operator = operator;
            this.right = right;
        }
        accept(visitor) {
            return visitor.visitBoolOpExpr(this);
        }
    }
    ExprNS.BoolOp = BoolOp;
    class Grouping extends Expr {
        constructor(startToken, endToken, expression) {
            super(startToken, endToken);
            this.expression = expression;
        }
        accept(visitor) {
            return visitor.visitGroupingExpr(this);
        }
    }
    ExprNS.Grouping = Grouping;
    class Literal extends Expr {
        constructor(startToken, endToken, value) {
            super(startToken, endToken);
            this.value = value;
        }
        accept(visitor) {
            return visitor.visitLiteralExpr(this);
        }
    }
    ExprNS.Literal = Literal;
    class Unary extends Expr {
        constructor(startToken, endToken, operator, right) {
            super(startToken, endToken);
            this.operator = operator;
            this.right = right;
        }
        accept(visitor) {
            return visitor.visitUnaryExpr(this);
        }
    }
    ExprNS.Unary = Unary;
    class Ternary extends Expr {
        constructor(startToken, endToken, predicate, consequent, alternative) {
            super(startToken, endToken);
            this.predicate = predicate;
            this.consequent = consequent;
            this.alternative = alternative;
        }
        accept(visitor) {
            return visitor.visitTernaryExpr(this);
        }
    }
    ExprNS.Ternary = Ternary;
    class Lambda extends Expr {
        constructor(startToken, endToken, parameters, body) {
            super(startToken, endToken);
            this.parameters = parameters;
            this.body = body;
        }
        accept(visitor) {
            return visitor.visitLambdaExpr(this);
        }
    }
    ExprNS.Lambda = Lambda;
    class MultiLambda extends Expr {
        constructor(startToken, endToken, parameters, body, varDecls) {
            super(startToken, endToken);
            this.parameters = parameters;
            this.body = body;
            this.varDecls = varDecls;
        }
        accept(visitor) {
            return visitor.visitMultiLambdaExpr(this);
        }
    }
    ExprNS.MultiLambda = MultiLambda;
    class Variable extends Expr {
        constructor(startToken, endToken, name) {
            super(startToken, endToken);
            this.name = name;
        }
        accept(visitor) {
            return visitor.visitVariableExpr(this);
        }
    }
    ExprNS.Variable = Variable;
    class Call extends Expr {
        constructor(startToken, endToken, callee, args) {
            super(startToken, endToken);
            this.callee = callee;
            this.args = args;
        }
        accept(visitor) {
            return visitor.visitCallExpr(this);
        }
    }
    ExprNS.Call = Call;
})(ExprNS || (ExprNS = {}));
var StmtNS;
(function (StmtNS) {
    class Stmt {
        constructor(startToken, endToken) {
            this.startToken = startToken;
            this.endToken = endToken;
        }
    }
    StmtNS.Stmt = Stmt;
    class Indent extends Stmt {
        constructor(startToken, endToken) {
            super(startToken, endToken);
        }
        accept(visitor) {
            return visitor.visitIndentCreation(this);
        }
    }
    StmtNS.Indent = Indent;
    class Dedent extends Stmt {
        constructor(startToken, endToken) {
            super(startToken, endToken);
        }
        accept(visitor) {
            return visitor.visitDedentCreation(this);
        }
    }
    StmtNS.Dedent = Dedent;
    class Pass extends Stmt {
        constructor(startToken, endToken) {
            super(startToken, endToken);
        }
        accept(visitor) {
            return visitor.visitPassStmt(this);
        }
    }
    StmtNS.Pass = Pass;
    class Assign extends Stmt {
        constructor(startToken, endToken, name, value) {
            super(startToken, endToken);
            this.name = name;
            this.value = value;
        }
        accept(visitor) {
            return visitor.visitAssignStmt(this);
        }
    }
    StmtNS.Assign = Assign;
    class AnnAssign extends Stmt {
        constructor(startToken, endToken, name, value, ann) {
            super(startToken, endToken);
            this.name = name;
            this.value = value;
            this.ann = ann;
        }
        accept(visitor) {
            return visitor.visitAnnAssignStmt(this);
        }
    }
    StmtNS.AnnAssign = AnnAssign;
    class Break extends Stmt {
        constructor(startToken, endToken) {
            super(startToken, endToken);
        }
        accept(visitor) {
            return visitor.visitBreakStmt(this);
        }
    }
    StmtNS.Break = Break;
    class Continue extends Stmt {
        constructor(startToken, endToken) {
            super(startToken, endToken);
        }
        accept(visitor) {
            return visitor.visitContinueStmt(this);
        }
    }
    StmtNS.Continue = Continue;
    class Return extends Stmt {
        constructor(startToken, endToken, value) {
            super(startToken, endToken);
            this.value = value;
        }
        accept(visitor) {
            return visitor.visitReturnStmt(this);
        }
    }
    StmtNS.Return = Return;
    class FromImport extends Stmt {
        constructor(startToken, endToken, module, names) {
            super(startToken, endToken);
            this.module = module;
            this.names = names;
        }
        accept(visitor) {
            return visitor.visitFromImportStmt(this);
        }
    }
    StmtNS.FromImport = FromImport;
    class Global extends Stmt {
        constructor(startToken, endToken, name) {
            super(startToken, endToken);
            this.name = name;
        }
        accept(visitor) {
            return visitor.visitGlobalStmt(this);
        }
    }
    StmtNS.Global = Global;
    class NonLocal extends Stmt {
        constructor(startToken, endToken, name) {
            super(startToken, endToken);
            this.name = name;
        }
        accept(visitor) {
            return visitor.visitNonLocalStmt(this);
        }
    }
    StmtNS.NonLocal = NonLocal;
    class Assert extends Stmt {
        constructor(startToken, endToken, value) {
            super(startToken, endToken);
            this.value = value;
        }
        accept(visitor) {
            return visitor.visitAssertStmt(this);
        }
    }
    StmtNS.Assert = Assert;
    class If extends Stmt {
        constructor(startToken, endToken, condition, body, elseBlock) {
            super(startToken, endToken);
            this.condition = condition;
            this.body = body;
            this.elseBlock = elseBlock;
        }
        accept(visitor) {
            return visitor.visitIfStmt(this);
        }
    }
    StmtNS.If = If;
    class While extends Stmt {
        constructor(startToken, endToken, condition, body) {
            super(startToken, endToken);
            this.condition = condition;
            this.body = body;
        }
        accept(visitor) {
            return visitor.visitWhileStmt(this);
        }
    }
    StmtNS.While = While;
    class For extends Stmt {
        constructor(startToken, endToken, target, iter, body) {
            super(startToken, endToken);
            this.target = target;
            this.iter = iter;
            this.body = body;
        }
        accept(visitor) {
            return visitor.visitForStmt(this);
        }
    }
    StmtNS.For = For;
    class FunctionDef extends Stmt {
        constructor(startToken, endToken, name, parameters, body, varDecls) {
            super(startToken, endToken);
            this.name = name;
            this.parameters = parameters;
            this.body = body;
            this.varDecls = varDecls;
        }
        accept(visitor) {
            return visitor.visitFunctionDefStmt(this);
        }
    }
    StmtNS.FunctionDef = FunctionDef;
    class SimpleExpr extends Stmt {
        constructor(startToken, endToken, expression) {
            super(startToken, endToken);
            this.expression = expression;
        }
        accept(visitor) {
            return visitor.visitSimpleExprStmt(this);
        }
    }
    StmtNS.SimpleExpr = SimpleExpr;
    class FileInput extends Stmt {
        constructor(startToken, endToken, statements, varDecls) {
            super(startToken, endToken);
            this.statements = statements;
            this.varDecls = varDecls;
        }
        accept(visitor) {
            return visitor.visitFileInputStmt(this);
        }
    }
    StmtNS.FileInput = FileInput;
})(StmtNS || (StmtNS = {}));

/*
* Full disclosure: some of the functions and general layout of the file is
* from my own implementation of a parser
* in Rust.
* https://github.com/Fidget-Spinner/crafting_interpreters/blob/main/rust/src/parser.rs
*
* That is in turn an implementation of the book "Crafting Interpreters" by
* Robert Nystrom, which implements an interpreter in Java.
* https://craftinginterpreters.com/parsing-expressions.html.
* I've included the MIT license that code snippets from
* the book is licensed under down below. See
* https://github.com/munificent/craftinginterpreters/blob/master/LICENSE
*
*
* My changes:
*   - The book was written in Java. I have written this in TypeScript.
*   - My Rust implementation uses pattern matching, but the visitor pattern is
*     used here.
*   - Additionally, the production rules are completely different
*     from the book as a whole different language is being parsed.
*
*
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to
    deal in the Software without restriction, including without limitation the
    rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
    sell copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
    IN THE SOFTWARE.
**/
const PSEUD_NAMES = [
    TokenType.TRUE,
    TokenType.FALSE,
    TokenType.NONE,
];
class Parser {
    constructor(source, tokens) {
        this.source = source;
        this.tokens = tokens;
        this.current = 0;
    }
    // Consumes tokens while tokenTypes matches.
    match(...tokenTypes) {
        for (const tokenType of tokenTypes) {
            if (this.check(tokenType)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(...type) {
        if (this.isAtEnd()) {
            return false;
        }
        for (const tokenType of type) {
            if (this.peek().type === tokenType) {
                return true;
            }
        }
        return false;
    }
    advance() {
        if (!this.isAtEnd()) {
            this.current += 1;
        }
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === TokenType.ENDMARKER;
    }
    peek() {
        return this.tokens[this.current];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        const token = this.tokens[this.current];
        throw new ParserErrors.ExpectedTokenError(this.source, token, message);
    }
    synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.match(TokenType.NEWLINE)) {
                return false;
            }
            if (this.match(TokenType.FOR, TokenType.WHILE, TokenType.DEF, TokenType.IF, TokenType.ELIF, TokenType.ELSE, TokenType.RETURN)) {
                return true;
            }
            this.advance();
        }
        return false;
    }
    parse() {
        return this.file_input();
        // return this.expression();
    }
    //// THE NAMES OF THE FOLLOWING FUNCTIONS FOLLOW THE PRODUCTION RULES IN THE GRAMMAR.
    //// HENCE THEIR NAMES MIGHT NOT BE COMPLIANT WITH CAMELCASE
    file_input() {
        const startToken = this.peek();
        const statements = [];
        while (!this.isAtEnd()) {
            if (this.match(TokenType.NEWLINE) || this.match(TokenType.DEDENT)) {
                continue;
            }
            statements.push(this.stmt());
        }
        const endToken = this.peek();
        return new StmtNS.FileInput(startToken, endToken, statements, []);
    }
    stmt() {
        if (this.check(TokenType.DEF, TokenType.FOR, TokenType.IF, TokenType.WHILE)) {
            return this.compound_stmt();
        }
        else if (this.check(TokenType.NAME, ...PSEUD_NAMES, TokenType.NUMBER, TokenType.PASS, TokenType.BREAK, TokenType.CONTINUE, TokenType.MINUS, TokenType.PLUS, TokenType.INDENT, TokenType.DEDENT, TokenType.RETURN, TokenType.FROM, TokenType.GLOBAL, TokenType.NONLOCAL, TokenType.ASSERT, TokenType.LPAR, TokenType.STRING, TokenType.BIGINT, ...SPECIAL_IDENTIFIER_TOKENS)) {
            return this.simple_stmt();
        }
        const startToken = this.peek();
        const endToken = this.synchronize() ? this.previous() : this.peek();
        try {
            this.parse_invalid(startToken, endToken);
        }
        catch (e) {
            if (e instanceof ParserErrors.BaseParserError) {
                throw (e);
            }
        }
        throw new ParserErrors.GenericUnexpectedSyntaxError(startToken.line, startToken.col, this.source, startToken.indexInSource, endToken.indexInSource);
    }
    compound_stmt() {
        if (this.match(TokenType.IF)) {
            return this.if_stmt();
        }
        else if (this.match(TokenType.WHILE)) {
            return this.while_stmt();
        }
        else if (this.match(TokenType.FOR)) {
            return this.for_stmt();
        }
        else if (this.match(TokenType.DEF)) {
            return this.funcdef();
        }
        throw new Error("Unreachable code path");
    }
    if_stmt() {
        const startToken = this.previous();
        let start = this.previous();
        let cond = this.test();
        this.consume(TokenType.COLON, "Expected ':' after if");
        let block = this.suite();
        let elseStmt = null;
        if (this.match(TokenType.ELIF)) {
            elseStmt = [this.if_stmt()];
        }
        else if (this.match(TokenType.ELSE)) {
            this.consume(TokenType.COLON, "Expect ':' after else");
            elseStmt = this.suite();
        }
        else {
            throw new ParserErrors.NoElseBlockError(this.source, start);
        }
        const endToken = this.previous();
        return new StmtNS.If(startToken, endToken, cond, block, elseStmt);
    }
    while_stmt() {
        const startToken = this.peek();
        let cond = this.test();
        this.consume(TokenType.COLON, "Expected ':' after while");
        let block = this.suite();
        const endToken = this.previous();
        return new StmtNS.While(startToken, endToken, cond, block);
    }
    for_stmt() {
        const startToken = this.peek();
        let target = this.advance();
        this.consume(TokenType.IN, "Expected in after for");
        let iter = this.test();
        this.consume(TokenType.COLON, "Expected ':' after for");
        let block = this.suite();
        const endToken = this.previous();
        return new StmtNS.For(startToken, endToken, target, iter, block);
    }
    funcdef() {
        const startToken = this.peek();
        let name = this.advance();
        let args = this.parameters();
        this.consume(TokenType.COLON, "Expected ':' after def");
        let block = this.suite();
        const endToken = this.previous();
        return new StmtNS.FunctionDef(startToken, endToken, name, args, block, []);
    }
    simple_stmt() {
        const startToken = this.peek();
        let res = null;
        if (this.match(TokenType.NAME)) {
            res = this.assign_stmt();
        }
        else if (this.match(TokenType.INDENT)) {
            res = new StmtNS.Indent(startToken, startToken);
        }
        else if (this.match(TokenType.DEDENT)) {
            res = new StmtNS.Dedent(startToken, startToken);
        }
        else if (this.match(TokenType.PASS)) {
            res = new StmtNS.Pass(startToken, startToken);
        }
        else if (this.match(TokenType.BREAK)) {
            res = new StmtNS.Break(startToken, startToken);
        }
        else if (this.match(TokenType.CONTINUE)) {
            res = new StmtNS.Continue(startToken, startToken);
        }
        else if (this.match(TokenType.RETURN)) {
            res = new StmtNS.Return(startToken, startToken, this.check(TokenType.NEWLINE) ? null : this.test());
        }
        else if (this.match(TokenType.FROM)) {
            res = this.import_from();
        }
        else if (this.match(TokenType.GLOBAL)) {
            res = new StmtNS.Global(startToken, startToken, this.advance());
        }
        else if (this.match(TokenType.NONLOCAL)) {
            res = new StmtNS.NonLocal(startToken, startToken, this.advance());
        }
        else if (this.match(TokenType.ASSERT)) {
            res = new StmtNS.Assert(startToken, startToken, this.test());
        }
        else if (this.check(TokenType.LPAR, TokenType.NUMBER, TokenType.STRING, TokenType.BIGINT, TokenType.MINUS, TokenType.PLUS, ...SPECIAL_IDENTIFIER_TOKENS)) {
            res = new StmtNS.SimpleExpr(startToken, startToken, this.test());
        }
        else {
            throw new Error("Unreachable code path");
        }
        this.consume(TokenType.NEWLINE, "Expected newline");
        return res;
    }
    assign_stmt() {
        const startToken = this.previous();
        const name = this.previous();
        if (this.check(TokenType.COLON)) {
            const ann = this.test();
            this.consume(TokenType.EQUAL, "Expect equal in assignment");
            const expr = this.test();
            return new StmtNS.AnnAssign(startToken, this.previous(), name, expr, ann);
        }
        else if (this.check(TokenType.EQUAL)) {
            this.advance();
            const expr = this.test();
            return new StmtNS.Assign(startToken, this.previous(), name, expr);
        }
        else {
            this.current--;
            const expr = this.test();
            return new StmtNS.SimpleExpr(startToken, this.previous(), expr);
        }
    }
    import_from() {
        const startToken = this.previous();
        const module = this.advance();
        this.consume(TokenType.IMPORT, "Expected import keyword");
        let params;
        if (this.check(TokenType.NAME)) {
            params = [this.advance()];
        }
        else {
            params = this.parameters();
        }
        return new StmtNS.FromImport(startToken, this.previous(), module, params);
    }
    parameters() {
        this.consume(TokenType.LPAR, "Expected opening parentheses");
        let res = this.varparamslist();
        this.consume(TokenType.RPAR, "Expected closing parentheses");
        return res;
    }
    test() {
        if (this.match(TokenType.LAMBDA)) {
            return this.lambdef();
        }
        else {
            const startToken = this.peek();
            let consequent = this.or_test();
            if (this.match(TokenType.IF)) {
                const predicate = this.or_test();
                this.consume(TokenType.ELSE, "Expected else");
                const alternative = this.test();
                return new ExprNS.Ternary(startToken, this.previous(), predicate, consequent, alternative);
            }
            return consequent;
        }
    }
    lambdef() {
        const startToken = this.previous();
        let args = this.varparamslist();
        if (this.match(TokenType.COLON)) {
            let test = this.test();
            return new ExprNS.Lambda(startToken, this.previous(), args, test);
        }
        else if (this.match(TokenType.DOUBLECOLON)) {
            let block = this.suite();
            return new ExprNS.MultiLambda(startToken, this.previous(), args, block, []);
        }
        this.consume(TokenType.COLON, "Expected ':' after lambda");
        throw new Error("unreachable code path");
    }
    suite() {
        let stmts = [];
        if (this.match(TokenType.NEWLINE)) {
            this.consume(TokenType.INDENT, "Expected indent");
            while (!this.match(TokenType.DEDENT)) {
                stmts.push(this.stmt());
            }
        }
        return stmts;
    }
    varparamslist() {
        let params = [];
        while (!this.check(TokenType.COLON) && !this.check(TokenType.RPAR)) {
            let name = this.consume(TokenType.NAME, "Expected a proper identifier in parameter");
            params.push(name);
            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }
        return params;
    }
    or_test() {
        const startToken = this.peek();
        let expr = this.and_test();
        while (this.match(TokenType.OR)) {
            const operator = this.previous();
            const right = this.and_test();
            expr = new ExprNS.BoolOp(startToken, this.previous(), expr, operator, right);
        }
        return expr;
    }
    and_test() {
        const startToken = this.peek();
        let expr = this.not_test();
        while (this.match(TokenType.AND)) {
            const operator = this.previous();
            const right = this.not_test();
            expr = new ExprNS.BoolOp(startToken, this.previous(), expr, operator, right);
        }
        return expr;
    }
    not_test() {
        const startToken = this.peek();
        if (this.match(TokenType.NOT, TokenType.BANG)) {
            const operator = this.previous();
            return new ExprNS.Unary(startToken, this.previous(), operator, this.not_test());
        }
        return this.comparison();
    }
    comparison() {
        const startToken = this.peek();
        let expr = this.arith_expr();
        // @TODO: Add the rest of the comparisons
        while (this.match(TokenType.LESS, TokenType.GREATER, TokenType.DOUBLEEQUAL, TokenType.GREATEREQUAL, TokenType.LESSEQUAL, TokenType.NOTEQUAL, TokenType.IS, TokenType.ISNOT, TokenType.IN, TokenType.NOTIN)) {
            const operator = this.previous();
            const right = this.arith_expr();
            expr = new ExprNS.Compare(startToken, this.previous(), expr, operator, right);
        }
        return expr;
    }
    arith_expr() {
        const startToken = this.peek();
        let expr = this.term();
        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const token = this.previous();
            const right = this.term();
            expr = new ExprNS.Binary(startToken, this.previous(), expr, token, right);
        }
        return expr;
    }
    term() {
        const startToken = this.peek();
        let expr = this.factor();
        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT, TokenType.DOUBLESLASH)) {
            const token = this.previous();
            const right = this.factor();
            expr = new ExprNS.Binary(startToken, this.previous(), expr, token, right);
        }
        return expr;
    }
    factor() {
        const startToken = this.peek();
        if (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const op = this.previous();
            const factor = this.factor();
            const endToken = this.previous();
            return new ExprNS.Unary(startToken, endToken, op, factor);
        }
        return this.power();
    }
    power() {
        const startToken = this.peek();
        let expr = this.atom_expr();
        if (this.match(TokenType.DOUBLESTAR)) {
            const token = this.previous();
            const right = this.factor();
            const endToken = this.previous();
            return new ExprNS.Binary(startToken, endToken, expr, token, right);
        }
        return expr;
    }
    atom_expr() {
        let startToken = this.peek();
        let ato = this.atom();
        let res;
        if (this.match(TokenType.LPAR)) {
            let args = this.arglist();
            const endToken = this.previous();
            res = new ExprNS.Call(startToken, endToken, ato, args);
        }
        else {
            return ato;
        }
        // To handle things like x()()()
        startToken = this.peek();
        while (this.match(TokenType.LPAR)) {
            let args = this.arglist();
            res = new ExprNS.Call(startToken, this.previous(), res, args);
            startToken = this.peek();
        }
        return res;
    }
    arglist() {
        let args = [];
        while (!this.check(TokenType.RPAR)) {
            let arg = this.test();
            args.push(arg);
            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }
        this.consume(TokenType.RPAR, "Expected closing ')' after function application");
        return args;
    }
    atom() {
        const startToken = this.peek();
        if (this.match(TokenType.TRUE))
            return new ExprNS.Literal(startToken, this.previous(), true);
        if (this.match(TokenType.FALSE))
            return new ExprNS.Literal(startToken, this.previous(), false);
        if (this.match(TokenType.NONE))
            return new ExprNS.None(startToken, this.previous());
        if (this.match(TokenType.STRING)) {
            return new ExprNS.Literal(startToken, this.previous(), this.previous().lexeme);
        }
        if (this.match(TokenType.NUMBER)) {
            return new ExprNS.Literal(startToken, this.previous(), Number(this.previous().lexeme.replace(/_/g, "")));
        }
        if (this.match(TokenType.BIGINT)) {
            return new ExprNS.BigIntLiteral(startToken, this.previous(), this.previous().lexeme);
        }
        if (this.match(TokenType.COMPLEX)) {
            return new ExprNS.Complex(startToken, this.previous(), this.previous().lexeme);
        }
        if (this.match(TokenType.NAME, ...PSEUD_NAMES)) {
            return new ExprNS.Variable(startToken, this.previous(), this.previous());
        }
        if (this.match(TokenType.LPAR)) {
            let expr = this.test();
            this.consume(TokenType.RPAR, "Expected closing ')'");
            return new ExprNS.Grouping(startToken, this.previous(), expr);
        }
        const startTokenInvalid = this.peek();
        this.synchronize();
        const endTokenInvalid = this.peek();
        throw new ParserErrors.GenericUnexpectedSyntaxError(startToken.line, startToken.col, this.source, startTokenInvalid.indexInSource, endTokenInvalid.indexInSource);
    }
    //// INVALID RULES
    parse_invalid(startToken, endToken) {
        // @TODO invalid rules
    }
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function getAugmentedNamespace(n) {
  if (Object.prototype.hasOwnProperty.call(n, '__esModule')) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			var isInstance = false;
      try {
        isInstance = this instanceof a;
      } catch {}
			if (isInstance) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var levenshtein$1 = {exports: {}};

const peq = new Uint32Array(0x10000);
const myers_32 = (a, b) => {
    const n = a.length;
    const m = b.length;
    const lst = 1 << (n - 1);
    let pv = -1;
    let mv = 0;
    let sc = n;
    let i = n;
    while (i--) {
        peq[a.charCodeAt(i)] |= 1 << i;
    }
    for (i = 0; i < m; i++) {
        let eq = peq[b.charCodeAt(i)];
        const xv = eq | mv;
        eq |= ((eq & pv) + pv) ^ pv;
        mv |= ~(eq | pv);
        pv &= eq;
        if (mv & lst) {
            sc++;
        }
        if (pv & lst) {
            sc--;
        }
        mv = (mv << 1) | 1;
        pv = (pv << 1) | ~(xv | mv);
        mv &= xv;
    }
    i = n;
    while (i--) {
        peq[a.charCodeAt(i)] = 0;
    }
    return sc;
};
const myers_x = (b, a) => {
    const n = a.length;
    const m = b.length;
    const mhc = [];
    const phc = [];
    const hsize = Math.ceil(n / 32);
    const vsize = Math.ceil(m / 32);
    for (let i = 0; i < hsize; i++) {
        phc[i] = -1;
        mhc[i] = 0;
    }
    let j = 0;
    for (; j < vsize - 1; j++) {
        let mv = 0;
        let pv = -1;
        const start = j * 32;
        const vlen = Math.min(32, m) + start;
        for (let k = start; k < vlen; k++) {
            peq[b.charCodeAt(k)] |= 1 << k;
        }
        for (let i = 0; i < n; i++) {
            const eq = peq[a.charCodeAt(i)];
            const pb = (phc[(i / 32) | 0] >>> i) & 1;
            const mb = (mhc[(i / 32) | 0] >>> i) & 1;
            const xv = eq | mv;
            const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
            let ph = mv | ~(xh | pv);
            let mh = pv & xh;
            if ((ph >>> 31) ^ pb) {
                phc[(i / 32) | 0] ^= 1 << i;
            }
            if ((mh >>> 31) ^ mb) {
                mhc[(i / 32) | 0] ^= 1 << i;
            }
            ph = (ph << 1) | pb;
            mh = (mh << 1) | mb;
            pv = mh | ~(xv | ph);
            mv = ph & xv;
        }
        for (let k = start; k < vlen; k++) {
            peq[b.charCodeAt(k)] = 0;
        }
    }
    let mv = 0;
    let pv = -1;
    const start = j * 32;
    const vlen = Math.min(32, m - start) + start;
    for (let k = start; k < vlen; k++) {
        peq[b.charCodeAt(k)] |= 1 << k;
    }
    let score = m;
    for (let i = 0; i < n; i++) {
        const eq = peq[a.charCodeAt(i)];
        const pb = (phc[(i / 32) | 0] >>> i) & 1;
        const mb = (mhc[(i / 32) | 0] >>> i) & 1;
        const xv = eq | mv;
        const xh = ((((eq | mb) & pv) + pv) ^ pv) | eq | mb;
        let ph = mv | ~(xh | pv);
        let mh = pv & xh;
        score += (ph >>> (m - 1)) & 1;
        score -= (mh >>> (m - 1)) & 1;
        if ((ph >>> 31) ^ pb) {
            phc[(i / 32) | 0] ^= 1 << i;
        }
        if ((mh >>> 31) ^ mb) {
            mhc[(i / 32) | 0] ^= 1 << i;
        }
        ph = (ph << 1) | pb;
        mh = (mh << 1) | mb;
        pv = mh | ~(xv | ph);
        mv = ph & xv;
    }
    for (let k = start; k < vlen; k++) {
        peq[b.charCodeAt(k)] = 0;
    }
    return score;
};
const distance = (a, b) => {
    if (a.length < b.length) {
        const tmp = b;
        b = a;
        a = tmp;
    }
    if (b.length === 0) {
        return a.length;
    }
    if (a.length <= 32) {
        return myers_32(a, b);
    }
    return myers_x(a, b);
};
const closest = (str, arr) => {
    let min_distance = Infinity;
    let min_index = 0;
    for (let i = 0; i < arr.length; i++) {
        const dist = distance(str, arr[i]);
        if (dist < min_distance) {
            min_distance = dist;
            min_index = i;
        }
    }
    return arr[min_index];
};

var mod = /*#__PURE__*/Object.freeze({
    __proto__: null,
    closest: closest,
    distance: distance
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(mod);

var hasRequiredLevenshtein;

function requireLevenshtein () {
	if (hasRequiredLevenshtein) return levenshtein$1.exports;
	hasRequiredLevenshtein = 1;
	(function (module, exports) {
		(function() {
		  
		  var collator;
		  try {
		    collator = (typeof Intl !== "undefined" && typeof Intl.Collator !== "undefined") ? Intl.Collator("generic", { sensitivity: "base" }) : null;
		  } catch (err){
		    console.log("Collator could not be initialized and wouldn't be used");
		  }

		  var levenshtein = require$$0;

		  // arrays to re-use
		  var prevRow = [],
		    str2Char = [];
		  
		  /**
		   * Based on the algorithm at http://en.wikipedia.org/wiki/Levenshtein_distance.
		   */
		  var Levenshtein = {
		    /**
		     * Calculate levenshtein distance of the two strings.
		     *
		     * @param str1 String the first string.
		     * @param str2 String the second string.
		     * @param [options] Additional options.
		     * @param [options.useCollator] Use `Intl.Collator` for locale-sensitive string comparison.
		     * @return Integer the levenshtein distance (0 and above).
		     */
		    get: function(str1, str2, options) {
		      var useCollator = (options && collator && options.useCollator);
		      
		      if (useCollator) {
		        var str1Len = str1.length,
		          str2Len = str2.length;
		        
		        // base cases
		        if (str1Len === 0) return str2Len;
		        if (str2Len === 0) return str1Len;

		        // two rows
		        var curCol, nextCol, i, j, tmp;

		        // initialise previous row
		        for (i=0; i<str2Len; ++i) {
		          prevRow[i] = i;
		          str2Char[i] = str2.charCodeAt(i);
		        }
		        prevRow[str2Len] = str2Len;

		        var strCmp;
		        // calculate current row distance from previous row using collator
		        for (i = 0; i < str1Len; ++i) {
		          nextCol = i + 1;

		          for (j = 0; j < str2Len; ++j) {
		            curCol = nextCol;

		            // substution
		            strCmp = 0 === collator.compare(str1.charAt(i), String.fromCharCode(str2Char[j]));

		            nextCol = prevRow[j] + (strCmp ? 0 : 1);

		            // insertion
		            tmp = curCol + 1;
		            if (nextCol > tmp) {
		              nextCol = tmp;
		            }
		            // deletion
		            tmp = prevRow[j + 1] + 1;
		            if (nextCol > tmp) {
		              nextCol = tmp;
		            }

		            // copy current col value into previous (in preparation for next iteration)
		            prevRow[j] = curCol;
		          }

		          // copy last col value into previous (in preparation for next iteration)
		          prevRow[j] = nextCol;
		        }
		        return nextCol;
		      }
		      return levenshtein.distance(str1, str2);
		    }

		  };

		  // amd
		  if (module !== null && 'object' !== "undefined" && module.exports === exports) {
		    module.exports = Levenshtein;
		  }
		  // web worker
		  else if (typeof self !== "undefined" && typeof self.postMessage === 'function' && typeof self.importScripts === 'function') {
		    self.Levenshtein = Levenshtein;
		  }
		  // browser main thread
		  else if (typeof window !== "undefined" && window !== null) {
		    window.Levenshtein = Levenshtein;
		  }
		}()); 
	} (levenshtein$1, levenshtein$1.exports));
	return levenshtein$1.exports;
}

var levenshteinExports = requireLevenshtein();
var levenshtein = /*@__PURE__*/getDefaultExportFromCjs(levenshteinExports);

// const levenshtein = require('fast-levenshtein');
const RedefineableTokenSentinel = new Token(TokenType.AT, "", 0, 0, 0);
class Environment {
    constructor(source, enclosing, names) {
        this.source = source;
        this.enclosing = enclosing;
        this.names = names;
        this.functions = new Set();
        this.moduleBindings = new Set();
        this.definedNames = new Set();
    }
    /*
    * Does a full lookup up the environment chain for a name.
    * Returns the distance of the name from the current environment.
    * If name isn't found, return -1.
    * */
    lookupName(identifier) {
        const name = identifier.lexeme;
        let distance = 0;
        let curr = this;
        while (curr !== null) {
            if (curr.names.has(name)) {
                break;
            }
            distance += 1;
            curr = curr.enclosing;
        }
        return (curr === null) ? -1 : distance;
    }
    /* Looks up the name but only for the current environment. */
    lookupNameCurrentEnv(identifier) {
        return this.names.get(identifier.lexeme);
    }
    lookupNameCurrentEnvWithError(identifier) {
        if (this.lookupName(identifier) < 0) {
            throw new ResolverErrors.NameNotFoundError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, this.suggestName(identifier));
        }
    }
    lookupNameParentEnvWithError(identifier) {
        const name = identifier.lexeme;
        let parent = this.enclosing;
        if (parent === null || !parent.names.has(name)) {
            throw new ResolverErrors.NameNotFoundError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + name.length, this.suggestName(identifier));
        }
    }
    declareName(identifier) {
        const lookup = this.lookupNameCurrentEnv(identifier);
        if (lookup !== undefined && this.definedNames.has(identifier.lexeme)) {
            throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, lookup);
        }
        if (lookup !== undefined && lookup !== RedefineableTokenSentinel) {
            throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, lookup);
        }
        this.names.set(identifier.lexeme, identifier);
        this.definedNames.add(identifier.lexeme);
    }
    // Same as declareName but allowed to re-declare later.
    declarePlaceholderName(identifier) {
        const lookup = this.lookupNameCurrentEnv(identifier);
        if (lookup !== undefined) {
            throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, lookup);
        }
        this.names.set(identifier.lexeme, RedefineableTokenSentinel);
    }
    suggestNameCurrentEnv(identifier) {
        const name = identifier.lexeme;
        let minDistance = Infinity;
        let minName = null;
        for (const declName of this.names.keys()) {
            const dist = levenshtein.get(name, declName);
            if (dist < minDistance) {
                minDistance = dist;
                minName = declName;
            }
        }
        return minName;
    }
    /*
    * Finds name closest to name in all environments up to builtin environment.
    * Calculated using min levenshtein distance.
    * */
    suggestName(identifier) {
        const name = identifier.lexeme;
        let minDistance = Infinity;
        let minName = null;
        let curr = this;
        while (curr !== null) {
            for (const declName of curr.names.keys()) {
                const dist = levenshtein.get(name, declName);
                if (dist < minDistance) {
                    minDistance = dist;
                    minName = declName;
                }
            }
            curr = curr.enclosing;
        }
        if (minDistance >= 4) {
            // This is pretty far, so just return null
            return null;
        }
        return minName;
    }
}
class Resolver {
    constructor(source, ast) {
        this.source = source;
        this.ast = ast;
        // The global environment
        this.environment = new Environment(source, null, new Map([
            // misc library
            ["_int", new Token(TokenType.NAME, "_int", 0, 0, 0)],
            ["_int_from_string", new Token(TokenType.NAME, "_int_from_string", 0, 0, 0)],
            ["abs", new Token(TokenType.NAME, "abs", 0, 0, 0)],
            ["char_at", new Token(TokenType.NAME, "char_at", 0, 0, 0)],
            ["error", new Token(TokenType.NAME, "error", 0, 0, 0)],
            ["input", new Token(TokenType.NAME, "input", 0, 0, 0)],
            ["isinstance", new Token(TokenType.NAME, "isinstance", 0, 0, 0)],
            ["max", new Token(TokenType.NAME, "max", 0, 0, 0)],
            ["min", new Token(TokenType.NAME, "min", 0, 0, 0)],
            ["print", new Token(TokenType.NAME, "print", 0, 0, 0)],
            ["random_random", new Token(TokenType.NAME, "random_random", 0, 0, 0)],
            ["round", new Token(TokenType.NAME, "round", 0, 0, 0)],
            ["str", new Token(TokenType.NAME, "str", 0, 0, 0)],
            ["time_time", new Token(TokenType.NAME, "time_time", 0, 0, 0)],
            // math constants
            ["math_pi", new Token(TokenType.NAME, "math_pi", 0, 0, 0)],
            ["math_e", new Token(TokenType.NAME, "math_e", 0, 0, 0)],
            ["math_inf", new Token(TokenType.NAME, "math_inf", 0, 0, 0)],
            ["math_nan", new Token(TokenType.NAME, "math_nan", 0, 0, 0)],
            ["math_tau", new Token(TokenType.NAME, "math_tau", 0, 0, 0)],
            // math library
            ["math_acos", new Token(TokenType.NAME, "math_acos", 0, 0, 0)],
            ["math_acosh", new Token(TokenType.NAME, "math_acosh", 0, 0, 0)],
            ["math_asin", new Token(TokenType.NAME, "math_asin", 0, 0, 0)],
            ["math_asinh", new Token(TokenType.NAME, "math_asinh", 0, 0, 0)],
            ["math_atan", new Token(TokenType.NAME, "math_atan", 0, 0, 0)],
            ["math_atan2", new Token(TokenType.NAME, "math_atan2", 0, 0, 0)],
            ["math_atanh", new Token(TokenType.NAME, "math_atanh", 0, 0, 0)],
            ["math_cbrt", new Token(TokenType.NAME, "math_cbrt", 0, 0, 0)],
            ["math_ceil", new Token(TokenType.NAME, "math_ceil", 0, 0, 0)],
            ["math_comb", new Token(TokenType.NAME, "math_comb", 0, 0, 0)],
            ["math_copysign", new Token(TokenType.NAME, "math_copysign", 0, 0, 0)],
            ["math_cos", new Token(TokenType.NAME, "math_cos", 0, 0, 0)],
            ["math_cosh", new Token(TokenType.NAME, "math_cosh", 0, 0, 0)],
            ["math_degrees", new Token(TokenType.NAME, "math_degrees", 0, 0, 0)],
            ["math_erf", new Token(TokenType.NAME, "math_erf", 0, 0, 0)],
            ["math_erfc", new Token(TokenType.NAME, "math_erfc", 0, 0, 0)],
            ["math_exp", new Token(TokenType.NAME, "math_exp", 0, 0, 0)],
            ["math_exp2", new Token(TokenType.NAME, "math_exp2", 0, 0, 0)],
            ["math_expm1", new Token(TokenType.NAME, "math_expm1", 0, 0, 0)],
            ["math_fabs", new Token(TokenType.NAME, "math_fabs", 0, 0, 0)],
            ["math_factorial", new Token(TokenType.NAME, "math_factorial", 0, 0, 0)],
            ["math_floor", new Token(TokenType.NAME, "math_floor", 0, 0, 0)],
            ["math_fma", new Token(TokenType.NAME, "math_fma", 0, 0, 0)],
            ["math_fmod", new Token(TokenType.NAME, "math_fmod", 0, 0, 0)],
            ["math_gamma", new Token(TokenType.NAME, "math_gamma", 0, 0, 0)],
            ["math_gcd", new Token(TokenType.NAME, "math_gcd", 0, 0, 0)],
            ["math_isfinite", new Token(TokenType.NAME, "math_isfinite", 0, 0, 0)],
            ["math_isinf", new Token(TokenType.NAME, "math_isinf", 0, 0, 0)],
            ["math_isnan", new Token(TokenType.NAME, "math_isnan", 0, 0, 0)],
            ["math_isqrt", new Token(TokenType.NAME, "math_isqrt", 0, 0, 0)],
            ["math_lcm", new Token(TokenType.NAME, "math_lcm", 0, 0, 0)],
            ["math_ldexp", new Token(TokenType.NAME, "math_ldexp", 0, 0, 0)],
            ["math_lgamma", new Token(TokenType.NAME, "math_lgamma", 0, 0, 0)],
            ["math_log", new Token(TokenType.NAME, "math_log", 0, 0, 0)],
            ["math_log10", new Token(TokenType.NAME, "math_log10", 0, 0, 0)],
            ["math_log1p", new Token(TokenType.NAME, "math_log1p", 0, 0, 0)],
            ["math_log2", new Token(TokenType.NAME, "math_log2", 0, 0, 0)],
            ["math_nextafter", new Token(TokenType.NAME, "math_nextafter", 0, 0, 0)],
            ["math_perm", new Token(TokenType.NAME, "math_perm", 0, 0, 0)],
            ["math_pow", new Token(TokenType.NAME, "math_pow", 0, 0, 0)],
            ["math_radians", new Token(TokenType.NAME, "math_radians", 0, 0, 0)],
            ["math_remainder", new Token(TokenType.NAME, "math_remainder", 0, 0, 0)],
            ["math_sin", new Token(TokenType.NAME, "math_sin", 0, 0, 0)],
            ["math_sinh", new Token(TokenType.NAME, "math_sinh", 0, 0, 0)],
            ["math_sqrt", new Token(TokenType.NAME, "math_sqrt", 0, 0, 0)],
            ["math_tan", new Token(TokenType.NAME, "math_tan", 0, 0, 0)],
            ["math_tanh", new Token(TokenType.NAME, "math_tanh", 0, 0, 0)],
            ["math_trunc", new Token(TokenType.NAME, "math_trunc", 0, 0, 0)],
            ["math_ulp", new Token(TokenType.NAME, "math_ulp", 0, 0, 0)]
        ]));
        this.functionScope = null;
    }
    resolve(stmt) {
        if (stmt === null) {
            return;
        }
        if (stmt instanceof Array) {
            // Resolve all top-level functions first. Python allows functions declared after
            // another function to be used in that function.
            for (const st of stmt) {
                if (st instanceof StmtNS.FunctionDef) {
                    this.environment?.declarePlaceholderName(st.name);
                }
            }
            for (const st of stmt) {
                st.accept(this);
            }
        }
        else {
            stmt.accept(this);
        }
    }
    varDeclNames(names) {
        const res = Array.from(names.values())
            .filter(name => (
        // Filter out functions and module bindings.
        // Those will be handled separately, so they don't
        // need to be hoisted.
        !this.environment?.functions.has(name.lexeme)
            && !this.environment?.moduleBindings.has(name.lexeme)));
        return res.length === 0 ? null : res;
    }
    functionVarConstraint(identifier) {
        if (this.functionScope == null) {
            return;
        }
        let curr = this.environment;
        while (curr !== this.functionScope) {
            if (curr !== null && curr.names.has(identifier.lexeme)) {
                const token = curr.names.get(identifier.lexeme);
                if (token === undefined) {
                    throw new Error("placeholder error");
                }
                throw new ResolverErrors.NameReassignmentError(identifier.line, identifier.col, this.source, identifier.indexInSource, identifier.indexInSource + identifier.lexeme.length, token);
            }
            curr = curr?.enclosing ?? null;
        }
    }
    //// STATEMENTS
    visitFileInputStmt(stmt) {
        // Create a new environment.
        const oldEnv = this.environment;
        this.environment = new Environment(this.source, this.environment, new Map());
        this.resolve(stmt.statements);
        // Grab identifiers from that new environment. That are NOT functions.
        // stmt.varDecls = this.varDeclNames(this.environment.names)
        this.environment = oldEnv;
    }
    visitIndentCreation(stmt) {
        // Create a new environment
        this.environment = new Environment(this.source, this.environment, new Map());
    }
    visitDedentCreation(stmt) {
        // Switch to the previous environment.
        if (this.environment?.enclosing !== undefined) {
            this.environment = this.environment.enclosing;
        }
    }
    visitFunctionDefStmt(stmt) {
        this.environment?.declareName(stmt.name);
        this.environment?.functions.add(stmt.name.lexeme);
        // Create a new environment.
        const oldEnv = this.environment;
        // Assign the parameters to the new environment.
        const newEnv = new Map(stmt.parameters.map(param => [param.lexeme, param]));
        this.environment = new Environment(this.source, this.environment, newEnv);
        // const params = new Map(
        //     stmt.parameters.map(param => [param.lexeme, param])
        // );
        // if (this.environment !== null) {
        //     this.environment.names = params;
        // }
        this.functionScope = this.environment;
        this.resolve(stmt.body);
        // Grab identifiers from that new environment. That are NOT functions.
        // stmt.varDecls = this.varDeclNames(this.environment.names)
        // Restore old environment
        this.functionScope = null;
        this.environment = oldEnv;
    }
    visitAnnAssignStmt(stmt) {
        this.resolve(stmt.ann);
        this.resolve(stmt.value);
        this.functionVarConstraint(stmt.name);
        this.environment?.declareName(stmt.name);
    }
    visitAssignStmt(stmt) {
        this.resolve(stmt.value);
        this.functionVarConstraint(stmt.name);
        this.environment?.declareName(stmt.name);
    }
    visitAssertStmt(stmt) {
        this.resolve(stmt.value);
    }
    visitForStmt(stmt) {
        this.environment?.declareName(stmt.target);
        this.resolve(stmt.iter);
        this.resolve(stmt.body);
    }
    visitIfStmt(stmt) {
        this.resolve(stmt.condition);
        this.resolve(stmt.body);
        this.resolve(stmt.elseBlock);
    }
    // @TODO we need to treat all global statements as variable declarations in the global
    // scope.
    visitGlobalStmt(stmt) {
        // Do nothing because global can also be declared in our
        // own scope.
    }
    // @TODO nonlocals mean that any variable following that name in the current env
    // should not create a variable declaration, but instead point to an outer variable.
    visitNonLocalStmt(stmt) {
        this.environment?.lookupNameParentEnvWithError(stmt.name);
    }
    visitReturnStmt(stmt) {
        if (stmt.value !== null) {
            this.resolve(stmt.value);
        }
    }
    visitWhileStmt(stmt) {
        this.resolve(stmt.condition);
        this.resolve(stmt.body);
    }
    visitSimpleExprStmt(stmt) {
        this.resolve(stmt.expression);
    }
    visitFromImportStmt(stmt) {
        for (const name of stmt.names) {
            this.environment?.declareName(name);
            this.environment?.moduleBindings.add(name.lexeme);
        }
    }
    visitContinueStmt(stmt) {
    }
    visitBreakStmt(stmt) {
    }
    visitPassStmt(stmt) {
    }
    //// EXPRESSIONS
    visitVariableExpr(expr) {
        this.environment?.lookupNameCurrentEnvWithError(expr.name);
    }
    visitLambdaExpr(expr) {
        // Create a new environment.
        const oldEnv = this.environment;
        // Assign the parameters to the new environment.
        const newEnv = new Map(expr.parameters.map(param => [param.lexeme, param]));
        this.environment = new Environment(this.source, this.environment, newEnv);
        this.resolve(expr.body);
        // Restore old environment
        this.environment = oldEnv;
    }
    visitMultiLambdaExpr(expr) {
        // Create a new environment.
        const oldEnv = this.environment;
        // Assign the parameters to the new environment.
        const newEnv = new Map(expr.parameters.map(param => [param.lexeme, param]));
        this.environment = new Environment(this.source, this.environment, newEnv);
        this.resolve(expr.body);
        // Grab identifiers from that new environment.
        expr.varDecls = Array.from(this.environment.names.values());
        // Restore old environment
        this.environment = oldEnv;
    }
    visitUnaryExpr(expr) {
        this.resolve(expr.right);
    }
    visitGroupingExpr(expr) {
        this.resolve(expr.expression);
    }
    visitBinaryExpr(expr) {
        this.resolve(expr.left);
        this.resolve(expr.right);
    }
    visitBoolOpExpr(expr) {
        this.resolve(expr.left);
        this.resolve(expr.right);
    }
    visitCompareExpr(expr) {
        this.resolve(expr.left);
        this.resolve(expr.right);
    }
    visitCallExpr(expr) {
        this.resolve(expr.callee);
        this.resolve(expr.args);
    }
    visitTernaryExpr(expr) {
        this.resolve(expr.predicate);
        this.resolve(expr.consequent);
        this.resolve(expr.alternative);
    }
    visitNoneExpr(expr) {
    }
    visitLiteralExpr(expr) {
    }
    visitBigIntLiteralExpr(expr) {
    }
    visitComplexExpr(expr) {
    }
}

// Simplified error implementation
// TODO: make it more correct in the future after the import is working
// Base class
class ModuleError extends Error {
    constructor(message) {
        super(message);
    }
}
// Error for when a module cannot be fetched from the network
class ModuleConnectionError extends ModuleError {
    constructor() {
        super('Unable to connect to module servers');
        this.type = 'ModuleConnectionError';
    }
}
// Error for when something goes wrong inside a module's code
class ModuleInternalError extends ModuleError {
    constructor(moduleName, error) {
        super(`Error in module ${moduleName}:\n${error.message}`);
        this.moduleName = moduleName;
        this.error = error;
        this.type = 'ModuleInternalError';
    }
}

/**
 * Returns a function that simulates the job of Node's `require`. The require
 * provider is then used by Source modules to access the context and py-slang standard
 * library
 */
const getRequireProvider = (context) => (x) => {
    const pathSegments = x.split('/');
    const recurser = (obj, segments) => {
        if (segments.length === 0)
            return obj;
        const currObj = obj[segments[0]];
        if (currObj !== undefined)
            return recurser(currObj, segments.splice(1));
        throw new Error(`Dynamic require of ${x} is not supported`);
    };
    const exports = {
        'py-slang': {
            context,
        },
    };
    return recurser(exports, pathSegments);
};

// Using a default static URL as a fallback.
let MODULES_STATIC_URL = 'https://source-academy.github.io/modules';
// Module cache for performance and circular dependency resolution.
const moduleCache = new Map();
async function loadModuleBundle(moduleName, context) {
    if (moduleCache.has(moduleName)) {
        return moduleCache.get(moduleName);
    }
    const loadPromise = (async () => {
        const bundleUrl = `${MODULES_STATIC_URL}/bundles/${moduleName}.js`;
        try {
            const response = await fetch(bundleUrl);
            if (!response.ok) {
                throw new ModuleConnectionError();
            }
            const bundleText = await response.text();
            const require = getRequireProvider(context);
            // Execute the module bundle as an IIFE.
            const moduleIIFE = new Function('require', bundleText);
            return moduleIIFE(require);
        }
        catch (error) {
            if (error instanceof ModuleConnectionError) {
                throw error;
            }
            // Wrap other errors as a ModuleInternalError.
            throw new ModuleInternalError(moduleName, error);
        }
    })();
    moduleCache.set(moduleName, loadPromise);
    return loadPromise;
}

var O$1;!function(O){O[O.VOID=0]="VOID",O[O.BOOLEAN=1]="BOOLEAN",O[O.NUMBER=2]="NUMBER",O[O.CONST_STRING=3]="CONST_STRING",O[O.EMPTY_LIST=4]="EMPTY_LIST",O[O.PAIR=5]="PAIR",O[O.ARRAY=6]="ARRAY",O[O.CLOSURE=7]="CLOSURE",O[O.OPAQUE=8]="OPAQUE",O[O.LIST=9]="LIST";}(O$1||(O$1={}));

var a;!function(a){a[a.HELLO=0]="HELLO",a[a.ABORT=1]="ABORT",a[a.ENTRY=2]="ENTRY";}(a||(a={}));

var O;!function(O){O[O.PROTOCOL_VERSION=0]="PROTOCOL_VERSION",O[O.PROTOCOL_MIN_VERSION=0]="PROTOCOL_MIN_VERSION",O[O.SETUP_MESSAGES_BUFFER_SIZE=10]="SETUP_MESSAGES_BUFFER_SIZE";}(O||(O={}));

var N;!function(N){N[N.ONLINE=0]="ONLINE",N[N.EVAL_READY=1]="EVAL_READY",N[N.RUNNING=2]="RUNNING",N[N.WAITING=3]="WAITING",N[N.BREAKPOINT=4]="BREAKPOINT",N[N.STOPPED=5]="STOPPED",N[N.ERROR=6]="ERROR";}(N||(N={}));

class PyDataHandler {
    constructor(context) {
        this.context = context;
        this.hasDataInterface = true;
    }
    async closure_make(sig, func) {
        const jsClosure = new JsClosure(sig, func, this.context);
        return {
            type: O$1.CLOSURE,
            value: jsClosure,
        };
    }
    async pair_make(head, tail) {
        return Promise.reject(new Error('Method not implemented'));
    }
    async pair_head(p) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_sethead(p, tv) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_tail(p) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_settail(p, tv) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async pair_assert(p, headType, tailType) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_make(t, len, init) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_length(a) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_get(a, idx) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_type(a) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_set(a, idx, tv) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async array_assert(a, type, length) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_is_vararg(c) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_arity(c) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_call(c, args, returnType) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_call_unchecked(c, args) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async closure_arity_assert(c, arity) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async opaque_make(v, immutable) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async opaque_get(o) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async opaque_update(o, v) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async tie(dependent, dependee) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async untie(dependent, dependee) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async list(...elements) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async is_list(xs) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async list_to_vec(xs) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async accumulate(op, initial, sequence, resultType) {
        return Promise.reject(new Error('Method not implemented.'));
    }
    async length(xs) {
        return Promise.reject(new Error('Method not implemented.'));
    }
}

function findImportedModules(program) {
    const moduleNames = new Set();
    function traverse(node) {
        if (!node || typeof node !== 'object') {
            return;
        }
        if (node.constructor.name === 'FromImport') {
            const importNode = node;
            moduleNames.add(importNode.module.lexeme);
        }
        for (const key in node) {
            if (node.hasOwnProperty(key)) {
                const child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(traverse);
                }
                else {
                    traverse(child);
                }
            }
        }
    }
    traverse(program);
    return Array.from(moduleNames);
}
async function preloadModules(context, ast) {
    const conductor = context.nativeStorage.conductor;
    if (!conductor) {
        return;
    }
    const moduleNames = findImportedModules(ast);
    if (moduleNames.length === 0) {
        return;
    }
    const rawModules = await Promise.all(moduleNames.map(name => loadModuleBundle(name, context)));
    const dataHandler = new PyDataHandler(context);
    const loadedModules = {};
    for (let i = 0; i < moduleNames.length; i++) {
        const moduleName = moduleNames[i];
        const rawModule = rawModules[i];
        const processedModule = {};
        for (const funcName in rawModule) {
            const signature = { args: [], returnType: 0 };
            const typedValue = await dataHandler.closure_make(signature, rawModule[funcName]);
            processedModule[funcName] = typedValue.value;
        }
        loadedModules[moduleName] = processedModule;
    }
    const globalEnv = context.runtime.environments[context.runtime.environments.length - 1];
    for (const moduleName in loadedModules) {
        pyDefineVariable(context, moduleName, loadedModules[moduleName], globalEnv);
    }
}

async function runPyAST(code, variant = 1, doValidate = false) {
    const script = code + "\n";
    const tokenizer = new Tokenizer(script);
    const tokens = tokenizer.scanEverything();
    const pyParser = new Parser(script, tokens);
    const ast = pyParser.parse();
    if (doValidate) {
        new Resolver(code, ast).resolve(ast);
    }
    return ast;
}
async function PyRunInContext(code, context, options = {}) {
    const ast = await runPyAST(code, 1, true);
    await preloadModules(context, ast);
    const result = PyRunCSEMachine(code, ast, context, options);
    return result;
}
function PyRunCSEMachine(code, program, context, options = {}) {
    const result = PyEvaluate(code, program, context, options);
    return PyCSEResultPromise(context, result);
}

class Stash extends Stack {
    constructor() {
        super();
    }
    copy() {
        const newStash = new Stash();
        const stackCopy = super.getStack();
        newStash.push(...stackCopy);
        return newStash;
    }
}

class PyContext {
    constructor(program, context) {
        this.output = '';
        //public environment: Environment;
        this.errors = [];
        this.createGlobalEnvironment = () => ({
            tail: null,
            name: 'global',
            head: {},
            heap: new Heap(),
            id: '-1'
        });
        this.createEmptyRuntime = () => ({
            break: false,
            debuggerOn: true,
            isRunning: false,
            environmentTree: new EnvTree(),
            environments: [],
            value: undefined,
            nodes: [],
            control: null,
            stash: null,
            objectCount: 0,
            envSteps: -1,
            envStepsTotal: 0,
            breakpointSteps: [],
            changepointSteps: []
        });
        this.control = new PyControl(program);
        this.stash = new Stash();
        this.runtime = this.createEmptyRuntime();
        //this.environment = createProgramEnvironment(context || this, false);
        if (this.runtime.environments.length === 0) {
            const globalEnvironment = this.createGlobalEnvironment();
            this.runtime.environments.push(globalEnvironment);
            this.runtime.environmentTree.insert(globalEnvironment);
        }
        this.nativeStorage = {
            builtins: new Map(),
            previousProgramsIdentifiers: new Set(),
            operators: new Map(),
            maxExecTime: 1000,
            //evaller: null,
            loadedModules: {},
            loadedModuleTypes: {},
            conductor: null,
        };
    }
    reset(program) {
        this.control = new PyControl(program);
        this.stash = new Stash();
        //this.environment = createProgramEnvironment(this, false);
        this.errors = [];
    }
    copy() {
        const newContext = new PyContext();
        newContext.control = this.control.copy();
        newContext.stash = this.stash.copy();
        //newContext.environments = this.copyEnvironment(this.environments);
        return newContext;
    }
    copyEnvironment(env) {
        const newTail = env.tail ? this.copyEnvironment(env.tail) : null;
        const newEnv = {
            id: env.id,
            name: env.name,
            tail: newTail,
            head: { ...env.head },
            heap: new Heap(),
            callExpression: env.callExpression,
            thisContext: env.thisContext
        };
        return newEnv;
    }
}
class EnvTree {
    constructor() {
        this._root = null;
        this.map = new Map();
    }
    get root() {
        return this._root;
    }
    insert(environment) {
        const tailEnvironment = environment.tail;
        if (tailEnvironment === null) {
            if (this._root === null) {
                this._root = new EnvTreeNode(environment, null);
                this.map.set(environment, this._root);
            }
        }
        else {
            const parentNode = this.map.get(tailEnvironment);
            if (parentNode) {
                const childNode = new EnvTreeNode(environment, parentNode);
                parentNode.addChild(childNode);
                this.map.set(environment, childNode);
            }
        }
    }
    getTreeNode(environment) {
        return this.map.get(environment);
    }
}
class EnvTreeNode {
    constructor(environment, parent) {
        this.environment = environment;
        this.parent = parent;
        this._children = [];
    }
    get children() {
        return this._children;
    }
    resetChildren(newChildren) {
        this.clearChildren();
        this.addChildren(newChildren);
        newChildren.forEach(c => (c.parent = this));
    }
    clearChildren() {
        this._children = [];
    }
    addChildren(newChildren) {
        this._children.push(...newChildren);
    }
    addChild(newChild) {
        this._children.push(newChild);
        return newChild;
    }
}

// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team
const defaultContext = new PyContext();
const defaultOptions = {
    isPrelude: false,
    envSteps: 100000,
    stepLimit: 100000,
};
class PyEvaluator {
    constructor(conductor) {
        this.conductor = conductor;
        this.hasDataInterface = true;
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
    async startEvaluator(entrypoint) {
        return this.evaluateChunk(entrypoint);
    }
    async evaluateChunk(chunk) {
        try {
            const result = await PyRunInContext(chunk, this.context, this.options);
            this.conductor.sendOutput(`${result.representation.toString()}`);
        }
        catch (error) {
            this.conductor.sendOutput(`Error: ${error instanceof Error ? error.message : error}`);
        }
    }
}

module.exports = PyEvaluator;
//# sourceMappingURL=python-evaluator.cjs.map
