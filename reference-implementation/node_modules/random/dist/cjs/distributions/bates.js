"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
exports.default = (random, n = 1) => {
    validation_1.numberValidator(n).isInt().isPositive();
    const irwinHall = random.irwinHall(n);
    return () => {
        return irwinHall() / n;
    };
};
//# sourceMappingURL=bates.js.map