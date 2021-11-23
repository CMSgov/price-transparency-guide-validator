"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RNG {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _seed(seed, _opts) {
        // TODO: add entropy and stuff
        if (seed === (seed || 0)) {
            return seed;
        }
        else {
            const strSeed = '' + seed;
            let s = 0;
            for (let k = 0; k < strSeed.length; ++k) {
                s ^= strSeed.charCodeAt(k) | 0;
            }
            return s;
        }
    }
}
exports.default = RNG;
//# sourceMappingURL=rng.js.map