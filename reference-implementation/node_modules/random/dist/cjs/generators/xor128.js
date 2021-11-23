"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rng_1 = __importDefault(require("../rng"));
class RNGXOR128 extends rng_1.default {
    constructor(seed, opts) {
        super();
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = 0;
        this.seed(seed, opts);
    }
    get name() {
        return 'xor128';
    }
    next() {
        const t = this.x ^ (this.x << 1);
        this.x = this.y;
        this.y = this.z;
        this.z = this.w;
        this.w = this.w ^ ((this.w >>> 19) ^ t ^ (t >>> 8));
        return (this.w >>> 0) / 0x100000000;
    }
    seed(seed, opts) {
        this.x = this._seed(seed, opts);
        // discard an initial batch of 64 values
        for (let i = 0; i < 64; ++i) {
            this.next();
        }
    }
    clone(seed, opts) {
        return new RNGXOR128(seed, opts);
    }
}
exports.default = RNGXOR128;
//# sourceMappingURL=xor128.js.map