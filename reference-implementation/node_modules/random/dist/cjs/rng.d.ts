export declare type SeedFn = () => number;
export declare type SeedType = number | string | SeedFn | RNG;
export default abstract class RNG {
    abstract get name(): string;
    abstract next(): number;
    abstract seed(_seed?: SeedType, _opts?: Record<string, unknown>): void;
    abstract clone(_seed?: SeedType, _opts?: Record<string, unknown>): RNG;
    _seed(seed: number, _opts?: Record<string, unknown>): number;
}
//# sourceMappingURL=rng.d.ts.map