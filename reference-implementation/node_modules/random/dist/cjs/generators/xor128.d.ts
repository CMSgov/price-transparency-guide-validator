import RNG from '../rng';
export default class RNGXOR128 extends RNG {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(seed: number, opts?: Record<string, unknown>);
    get name(): string;
    next(): number;
    seed(seed: number, opts?: Record<string, unknown>): void;
    clone(seed: number, opts: Record<string, unknown>): RNGXOR128;
}
//# sourceMappingURL=xor128.d.ts.map