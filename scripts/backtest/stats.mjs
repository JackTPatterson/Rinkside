// Scoring rules, calibration tables and a seeded paired bootstrap.

const EPS = 1e-6;
const clip = (p) => Math.min(1 - EPS, Math.max(EPS, p));

export const logLoss = (p, y) => -(y ? Math.log(clip(p)) : Math.log(1 - clip(p)));
export const brier = (p, y) => (p - (y ? 1 : 0)) ** 2;
export const correct = (p, y) => (p === 0.5 ? 0.5 : (p > 0.5) === !!y ? 1 : 0);

export const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);

/** {n, logLoss, brier, accuracy} for paired arrays of probabilities and 0/1 outcomes. */
export function binaryMetrics(ps, ys) {
    const n = ps.length;
    let ll = 0;
    let br = 0;
    let acc = 0;
    for (let i = 0; i < n; i++) {
        ll += logLoss(ps[i], ys[i]);
        br += brier(ps[i], ys[i]);
        acc += correct(ps[i], ys[i]);
    }
    return {n, logLoss: ll / n, brier: br / n, accuracy: acc / n};
}

/** 10% bins: [{bin, n, meanPred, observed}] */
export function calibration(ps, ys, bins = 10) {
    const out = Array.from({length: bins}, (_, i) => ({bin: `${i * 10}-${i * 10 + 10}%`, n: 0, sp: 0, sy: 0}));
    for (let i = 0; i < ps.length; i++) {
        const b = Math.min(bins - 1, Math.floor(ps[i] * bins));
        out[b].n++;
        out[b].sp += ps[i];
        out[b].sy += ys[i] ? 1 : 0;
    }
    return out.map((b) => ({bin: b.bin, n: b.n, meanPred: b.n ? b.sp / b.n : null, observed: b.n ? b.sy / b.n : null}));
}

/** Area under the ROC curve (rank-based; ties get half credit). */
export function auc(ps, ys) {
    const idx = ps.map((p, i) => i).sort((a, b) => ps[a] - ps[b]);
    let rankSum = 0;
    let pos = 0;
    let i = 0;
    while (i < idx.length) {
        let j = i;
        while (j + 1 < idx.length && ps[idx[j + 1]] === ps[idx[i]]) j++;
        const avgRank = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) if (ys[idx[k]]) {
            rankSum += avgRank;
            pos++;
        }
        i = j + 1;
    }
    const neg = idx.length - pos;
    return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : NaN;
}

export function pearson(xs, ys) {
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < xs.length; i++) {
        sxy += (xs[i] - mx) * (ys[i] - my);
        sxx += (xs[i] - mx) ** 2;
        syy += (ys[i] - my) ** 2;
    }
    return sxy / Math.sqrt(sxx * syy);
}

// mulberry32: small seeded PRNG so bootstrap CIs are reproducible run to run.
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Paired bootstrap of the mean of per-unit differences (units = games, so within-game
 * correlation is respected). Returns {mean, lo, hi, pBelowZero}.
 * diff convention in this script: Rinkside − MoneyPuck, so negative = Rinkside better.
 */
export function bootstrapMean(diffs, {B = 4000, seed = 20252026} = {}) {
    const n = diffs.length;
    const rand = rng(seed);
    const means = new Float64Array(B);
    for (let b = 0; b < B; b++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += diffs[Math.floor(rand() * n)];
        means[b] = s / n;
    }
    means.sort();
    let below = 0;
    for (const m of means) if (m < 0) below++;
    return {mean: mean(diffs), lo: means[Math.floor(0.025 * B)], hi: means[Math.floor(0.975 * B)], pBelowZero: below / B};
}
