"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const seedrandom_1 = __importDefault(require("seedrandom"));
const rng_1 = __importDefault(require("./rng"));
const function_1 = __importDefault(require("./generators/function"));
/**
 * Construct an RNG with variable inputs. Used in calls to Random constructor
 * @param {...*} args - Distribution-specific arguments
 * @return RNG
 *
 * @example
 * new Random(RNGFactory(...args))
 */
exports.default = (...args) => {
    const [arg0 = 'default', ...rest] = args;
    switch (typeof arg0) {
        case 'object':
            if (arg0 instanceof rng_1.default) {
                return arg0;
            }
            break;
        case 'function':
            return new function_1.default(arg0);
        case 'number':
        case 'string':
            return new function_1.default(seedrandom_1.default(...rest));
    }
    throw new Error(`invalid RNG "${arg0}"`);
};
//# sourceMappingURL=rng-factory.js.map