import RNG from '../rng';
export default class RNGMathRandom extends RNG {
    get name(): string;
    next(): number;
    seed(_seed: unknown, _opts: Record<string, unknown>): void;
    clone(): RNGMathRandom;
}
//# sourceMappingURL=math-random.d.ts.map