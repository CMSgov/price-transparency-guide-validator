"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
exports.default = (random, alpha = 1) => {
    validation_1.numberValidator(alpha).greaterThanOrEqual(0);
    const invAlpha = 1.0 / alpha;
    return () => {
        return 1.0 / Math.pow(1.0 - random.next(), invAlpha);
    };
};
//# sourceMappingURL=pareto.js.map