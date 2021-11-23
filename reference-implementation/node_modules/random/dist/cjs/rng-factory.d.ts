import RNG from './rng';
declare const _default: <T extends any[]>(...args: T) => RNG;
/**
 * Construct an RNG with variable inputs. Used in calls to Random constructor
 * @param {...*} args - Distribution-specific arguments
 * @return RNG
 *
 * @example
 * new Random(RNGFactory(...args))
 */
export default _default;
//# sourceMappingURL=rng-factory.d.ts.map