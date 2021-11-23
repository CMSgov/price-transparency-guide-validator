import RNG, { SeedFn } from '../rng';
export default class RNGFunction extends RNG {
    _rng: SeedFn;
    constructor(thunk: SeedFn, opts?: Record<string, unknown>);
    get name(): string;
    next(): number;
    seed(thunk: SeedFn, _opts?: Record<string, unknown>): void;
    clone(_: undefined, opts: Record<string, unknown>): RNGFunction;
}
//# sourceMappingURL=function.d.ts.map