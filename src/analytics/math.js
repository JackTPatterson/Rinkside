// Numerical building blocks for the Rinkside models. Pure functions, no React / RN imports,
// so they run under `node --test` as well as in the app.

// Lanczos approximation of ln Γ(x), accurate to ~1e-15 for x > 0.
const LANCZOS = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = 0.99999999999980993;
    const t = x + 7.5;
    for (let i = 0; i < LANCZOS.length; i++) a += LANCZOS[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function poissonPmf(k, lambda) {
    if (k < 0 || !Number.isInteger(k)) return 0;
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return Math.exp(k * Math.log(lambda) - lambda - lgamma(k + 1));
}

/** Poisson pmf vector 0..max (the tail beyond max is negligible for hockey scoring rates). */
export function poissonVector(lambda, max = 15) {
    const out = new Array(max + 1);
    for (let k = 0; k <= max; k++) out[k] = poissonPmf(k, lambda);
    return out;
}

export function poissonCdf(k, lambda) {
    let s = 0;
    for (let i = 0; i <= k; i++) s += poissonPmf(i, lambda);
    return Math.min(1, s);
}

/** P(X >= k) for X ~ Poisson(lambda). */
export function poissonSf(k, lambda) {
    return k <= 0 ? 1 : Math.max(0, 1 - poissonCdf(k - 1, lambda));
}

// Regularised incomplete beta I_x(a, b) via Lentz's continued fraction (Numerical Recipes 6.4).
function betacf(x, a, b) {
    const MAXIT = 300;
    const EPS = 3e-14;
    const FPMIN = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c;
        if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c;
        if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
    }
    return h;
}

export function betaInc(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a;
    return 1 - (bt * betacf(1 - x, b, a)) / b;
}

/** Inverse of the Beta(a, b) CDF by bisection (monotone, robust, ~50 iterations). */
export function betaQuantile(p, a, b) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (betaInc(mid, a, b) < p) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/**
 * Negative binomial (Gamma–Poisson posterior predictive) pmf:
 *   P(K = k) = Γ(k + r) / (k! Γ(r)) · p^r · (1 − p)^k
 */
export function negBinPmf(k, r, p) {
    if (k < 0) return 0;
    return Math.exp(lgamma(k + r) - lgamma(k + 1) - lgamma(r) + r * Math.log(p) + k * Math.log1p(-p));
}

/** Smallest k with CDF(k) >= q. */
export function negBinQuantile(q, r, p, maxK = 2000) {
    let cdf = 0;
    for (let k = 0; k <= maxK; k++) {
        cdf += negBinPmf(k, r, p);
        if (cdf >= q) return k;
    }
    return maxK;
}

export function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}

export const logistic = (z) => 1 / (1 + Math.exp(-z));

export function sum(arr) {
    let s = 0;
    for (const v of arr) s += v;
    return s;
}

/**
 * Distribution of a sum of independent Bernoulli(p_i) — the Poisson-binomial — by exact DP.
 * Returns an array where out[k] = P(sum = k).
 */
export function poissonBinomial(probs) {
    let dist = [1];
    for (const p of probs) {
        const next = new Array(dist.length + 1).fill(0);
        for (let k = 0; k < dist.length; k++) {
            next[k] += dist[k] * (1 - p);
            next[k + 1] += dist[k] * p;
        }
        dist = next;
    }
    return dist;
}
