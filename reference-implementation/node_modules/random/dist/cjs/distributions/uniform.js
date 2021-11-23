"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (random, min = 0, max = 1) => {
    return () => {
        return random.next() * (max - min) + min;
    };
};
//# sourceMappingURL=uniform.js.map