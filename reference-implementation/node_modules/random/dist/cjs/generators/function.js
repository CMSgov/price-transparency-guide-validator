"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rng_1 = __importDefault(require("../rng"));
class RNGFunction extends rng_1.default {
    constructor(thunk, opts) {
        super();
        this.seed(thunk, opts);
    }
    get name() {
        return 'function';
    }
    next() {
        return this._rng();
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    seed(thunk, _opts) {
        this._rng = thunk;
    }
    clone(_, opts) {
        return new RNGFunction(this._rng, opts);
    }
}
exports.default = RNGFunction;
//# sourceMappingURL=function.js.map