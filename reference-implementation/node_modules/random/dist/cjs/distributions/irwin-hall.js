"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
exports.default = (random, n = 1) => {
    validation_1.numberValidator(n).isInt().greaterThanOrEqual(0);
    return () => {
        let sum = 0;
        for (let i = 0; i < n; ++i) {
            sum += random.next();
        }
        return sum;
    };
};
//# sourceMappingURL=irwin-hall.js.map