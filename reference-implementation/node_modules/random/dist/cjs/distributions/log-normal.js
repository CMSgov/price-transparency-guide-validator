"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (random, mu = 0, sigma = 1) => {
    const normal = random.normal(mu, sigma);
    return () => {
        return Math.exp(normal());
    };
};
//# sourceMappingURL=log-normal.js.map