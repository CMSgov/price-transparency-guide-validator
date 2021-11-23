"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Random = exports.RNGFactory = exports.RNG = void 0;
const rng_1 = __importDefault(require("./rng"));
exports.RNG = rng_1.default;
const rng_factory_1 = __importDefault(require("./rng-factory"));
exports.RNGFactory = rng_factory_1.default;
const uniform_1 = __importDefault(require("./distributions/uniform"));
const uniform_int_1 = __importDefault(require("./distributions/uniform-int"));
const uniform_boolean_1 = __importDefault(require("./distributions/uniform-boolean"));
const normal_1 = __importDefault(require("./distributions/normal"));
const log_normal_1 = __importDefault(require("./distributions/log-normal"));
const bernoulli_1 = __importDefault(require("./distributions/bernoulli"));
const binomial_1 = __importDefault(require("./distributions/binomial"));
const geometric_1 = __importDefault(require("./distributions/geometric"));
const poisson_1 = __importDefault(require("./distributions/poisson"));
const exponential_1 = __importDefault(require("./distributions/exponential"));
const irwin_hall_1 = __importDefault(require("./distributions/irwin-hall"));
const bates_1 = __importDefault(require("./distributions/bates"));
const pareto_1 = __importDefault(require("./distributions/pareto"));
const math_random_1 = __importDefault(require("./generators/math-random"));
/**
 * Seedable random number generator supporting many common distributions.
 *
 * Defaults to Math.random as its underlying pseudorandom number generator.
 *
 * @name Random
 * @class
 *
 * @param {RNG|function} [rng=Math.random] - Underlying pseudorandom number generator.
 */
class Random {
    constructor(rng) {
        this._cache = {};
        // --------------------------------------------------------------------------
        // Uniform utility functions
        // --------------------------------------------------------------------------
        /**
         * Convenience wrapper around `this.rng.next()`
         *
         * Returns a floating point number in [0, 1).
         *
         * @return {number}
         */
        this.next = () => {
            return this._rng.next();
        };
        /**
         * Samples a uniform random floating point number, optionally specifying
         * lower and upper bounds.
         *
         * Convence wrapper around `random.uniform()`
         *
         * @param {number} [min=0] - Lower bound (float, inclusive)
         * @param {number} [max=1] - Upper bound (float, exclusive)
         * @return {number}
         */
        this.float = (min, max) => {
            return this.uniform(min, max)();
        };
        /**
         * Samples a uniform random integer, optionally specifying lower and upper
         * bounds.
         *
         * Convence wrapper around `random.uniformInt()`
         *
         * @param {number} [min=0] - Lower bound (integer, inclusive)
         * @param {number} [max=1] - Upper bound (integer, inclusive)
         * @return {number}
         */
        this.int = (min, max) => {
            return this.uniformInt(min, max)();
        };
        /**
         * Samples a uniform random integer, optionally specifying lower and upper
         * bounds.
         *
         * Convence wrapper around `random.uniformInt()`
         *
         * @alias `random.int`
         *
         * @param {number} [min=0] - Lower bound (integer, inclusive)
         * @param {number} [max=1] - Upper bound (integer, inclusive)
         * @return {number}
         */
        this.integer = (min, max) => {
            return this.uniformInt(min, max)();
        };
        /**
         * Samples a uniform random boolean value.
         *
         * Convence wrapper around `random.uniformBoolean()`
         *
         * @alias `random.boolean`
         *
         * @return {boolean}
         */
        this.bool = () => {
            return this.uniformBoolean()();
        };
        /**
         * Samples a uniform random boolean value.
         *
         * Convence wrapper around `random.uniformBoolean()`
         *
         * @return {boolean}
         */
        this.boolean = () => {
            return this.uniformBoolean()();
        };
        // --------------------------------------------------------------------------
        // Uniform distributions
        // --------------------------------------------------------------------------
        /**
         * Generates a [Continuous uniform distribution](https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)).
         *
         * @param {number} [min=0] - Lower bound (float, inclusive)
         * @param {number} [max=1] - Upper bound (float, exclusive)
         * @return {function}
         */
        this.uniform = (min, max) => {
            return this._memoize('uniform', uniform_1.default, min, max);
        };
        /**
         * Generates a [Discrete uniform distribution](https://en.wikipedia.org/wiki/Discrete_uniform_distribution).
         *
         * @param {number} [min=0] - Lower bound (integer, inclusive)
         * @param {number} [max=1] - Upper bound (integer, inclusive)
         * @return {function}
         */
        this.uniformInt = (min, max) => {
            return this._memoize('uniformInt', uniform_int_1.default, min, max);
        };
        /**
         * Generates a [Discrete uniform distribution](https://en.wikipedia.org/wiki/Discrete_uniform_distribution),
         * with two possible outcomes, `true` or `false.
         *
         * This method is analogous to flipping a coin.
         *
         * @return {function}
         */
        this.uniformBoolean = () => {
            return this._memoize('uniformBoolean', uniform_boolean_1.default);
        };
        // --------------------------------------------------------------------------
        // Normal distributions
        // --------------------------------------------------------------------------
        /**
         * Generates a [Normal distribution](https://en.wikipedia.org/wiki/Normal_distribution).
         *
         * @param {number} [mu=0] - Mean
         * @param {number} [sigma=1] - Standard deviation
         * @return {function}
         */
        this.normal = (mu, sigma) => {
            return normal_1.default(this, mu, sigma);
        };
        /**
         * Generates a [Log-normal distribution](https://en.wikipedia.org/wiki/Log-normal_distribution).
         *
         * @param {number} [mu=0] - Mean of underlying normal distribution
         * @param {number} [sigma=1] - Standard deviation of underlying normal distribution
         * @return {function}
         */
        this.logNormal = (mu, sigma) => {
            return log_normal_1.default(this, mu, sigma);
        };
        // --------------------------------------------------------------------------
        // Bernoulli distributions
        // --------------------------------------------------------------------------
        /**
         * Generates a [Bernoulli distribution](https://en.wikipedia.org/wiki/Bernoulli_distribution).
         *
         * @param {number} [p=0.5] - Success probability of each trial.
         * @return {function}
         */
        this.bernoulli = (p) => {
            return bernoulli_1.default(this, p);
        };
        /**
         * Generates a [Binomial distribution](https://en.wikipedia.org/wiki/Binomial_distribution).
         *
         * @param {number} [n=1] - Number of trials.
         * @param {number} [p=0.5] - Success probability of each trial.
         * @return {function}
         */
        this.binomial = (n, p) => {
            return binomial_1.default(this, n, p);
        };
        /**
         * Generates a [Geometric distribution](https://en.wikipedia.org/wiki/Geometric_distribution).
         *
         * @param {number} [p=0.5] - Success probability of each trial.
         * @return {function}
         */
        this.geometric = (p) => {
            return geometric_1.default(this, p);
        };
        // --------------------------------------------------------------------------
        // Poisson distributions
        // --------------------------------------------------------------------------
        /**
         * Generates a [Poisson distribution](https://en.wikipedia.org/wiki/Poisson_distribution).
         *
         * @param {number} [lambda=1] - Mean (lambda > 0)
         * @return {function}
         */
        this.poisson = (lambda) => {
            return poisson_1.default(this, lambda);
        };
        /**
         * Generates an [Exponential distribution](https://en.wikipedia.org/wiki/Exponential_distribution).
         *
         * @param {number} [lambda=1] - Inverse mean (lambda > 0)
         * @return {function}
         */
        this.exponential = (lambda) => {
            return exponential_1.default(this, lambda);
        };
        // --------------------------------------------------------------------------
        // Misc distributions
        // --------------------------------------------------------------------------
        /**
         * Generates an [Irwin Hall distribution](https://en.wikipedia.org/wiki/Irwin%E2%80%93Hall_distribution).
         *
         * @param {number} [n=1] - Number of uniform samples to sum (n >= 0)
         * @return {function}
         */
        this.irwinHall = (n) => {
            return irwin_hall_1.default(this, n);
        };
        /**
         * Generates a [Bates distribution](https://en.wikipedia.org/wiki/Bates_distribution).
         *
         * @param {number} [n=1] - Number of uniform samples to average (n >= 1)
         * @return {function}
         */
        this.bates = (n) => {
            return bates_1.default(this, n);
        };
        /**
         * Generates a [Pareto distribution](https://en.wikipedia.org/wiki/Pareto_distribution).
         *
         * @param {number} [alpha=1] - Alpha
         * @return {function}
         */
        this.pareto = (alpha) => {
            return pareto_1.default(this, alpha);
        };
        if (rng && rng instanceof rng_1.default) {
            this.use(rng);
        }
        else {
            this.use(new math_random_1.default());
        }
        this._cache = {};
    }
    /**
     * @member {RNG} Underlying pseudo-random number generator
     */
    get rng() {
        return this._rng;
    }
    /**
     * Creates a new `Random` instance, optionally specifying parameters to
     * set a new seed.
     *
     * @see RNG.clone
     *
     * @param {string} [seed] - Optional seed for new RNG.
     * @param {object} [opts] - Optional config for new RNG options.
     * @return {Random}
     */
    clone(...args) {
        if (args.length) {
            return new Random(rng_factory_1.default(...args));
        }
        else {
            return new Random(this.rng.clone());
        }
    }
    /**
     * Sets the underlying pseudorandom number generator used via
     * either an instance of `seedrandom`, a custom instance of RNG
     * (for PRNG plugins), or a string specifying the PRNG to use
     * along with an optional `seed` and `opts` to initialize the
     * RNG.
     *
     * @example
     * const random = require('random')
     *
     * random.use('example_seedrandom_string')
     * // or
     * random.use(seedrandom('kittens'))
     * // or
     * random.use(Math.random)
     *
     * @param {...*} args
     */
    use(...args) {
        this._rng = rng_factory_1.default(...args);
    }
    /**
     * Patches `Math.random` with this Random instance's PRNG.
     */
    patch() {
        if (this._patch) {
            throw new Error('Math.random already patched');
        }
        this._patch = Math.random;
        Math.random = this.uniform();
    }
    /**
     * Restores a previously patched `Math.random` to its original value.
     */
    unpatch() {
        if (this._patch) {
            Math.random = this._patch;
            delete this._patch;
        }
    }
    // --------------------------------------------------------------------------
    // Internal
    // --------------------------------------------------------------------------
    /**
     * Memoizes distributions to ensure they're only created when necessary.
     *
     * Returns a thunk which that returns independent, identically distributed
     * samples from the specified distribution.
     *
     * @private
     *
     * @param {string} label - Name of distribution
     * @param {function} getter - Function which generates a new distribution
     * @param {...*} args - Distribution-specific arguments
     *
     * @return {function}
     */
    _memoize(label, getter, ...args) {
        const key = `${args.join(';')}`;
        let value = this._cache[label];
        if (value === undefined || value.key !== key) {
            value = {
                key,
                distribution: getter(this, ...args)
            };
            this._cache[label] = value;
        }
        return value.distribution;
    }
}
exports.Random = Random;
// defaults to Math.random as its RNG
exports.default = new Random();
//# sourceMappingURL=random.js.map