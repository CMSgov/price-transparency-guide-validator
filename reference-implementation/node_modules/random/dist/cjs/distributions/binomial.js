"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
exports.default = (random, n = 1, p = 0.5) => {
    validation_1.numberValidator(n).isInt().isPositive();
    validation_1.numberValidator(p).greaterThanOrEqual(0).lessThan(1);
    return () => {
        let i = 0;
        let x = 0;
        while (i++ < n) {
            if (random.next() < p) {
                x++;
            }
        }
        return x;
    };
};
//# sourceMappingURL=binomial.js.map