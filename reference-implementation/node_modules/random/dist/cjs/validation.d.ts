export declare function numberValidator(num: number): NumberValidator;
export declare class NumberValidator {
    private n;
    constructor(num: number);
    isInt: () => this;
    isPositive: () => this;
    lessThan: (v: number) => this;
    greaterThanOrEqual: (v: number) => this;
    greaterThan: (v: number) => this;
}
//# sourceMappingURL=validation.d.ts.map