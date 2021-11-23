"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
exports.default = (random, lambda = 1) => {
    validation_1.numberValidator(lambda).isPositive();
    return () => {
        return -Math.log(1 - random.next()) / lambda;
    };
};
//# sourceMappingURL=exponential.js.map