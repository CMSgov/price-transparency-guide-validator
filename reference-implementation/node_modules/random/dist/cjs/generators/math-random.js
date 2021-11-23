"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rng_1 = __importDefault(require("../rng"));
class RNGMathRandom extends rng_1.default {
    get name() {
        return 'default';
    }
    next() {
        return Math.random();
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    seed(_seed, _opts) {
        // intentionally empty
    }
    clone() {
        return new RNGMathRandom();
    }
}
exports.default = RNGMathRandom;
//# sourceMappingURL=math-random.js.map