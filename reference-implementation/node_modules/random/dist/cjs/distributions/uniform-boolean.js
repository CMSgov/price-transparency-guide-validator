"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (random) => {
    return () => {
        return random.next() >= 0.5;
    };
};
//# sourceMappingURL=uniform-boolean.js.map