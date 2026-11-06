export const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
export const variance = (a: number[]) => {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
};
export const sd = (a: number[]) => Math.sqrt(variance(a));

function logGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number) {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a,b). */
export function ibeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p-value for Student t with df degrees of freedom. */
export const tTwoTailedP = (t: number, df: number) => ibeta(df / (df + t * t), df / 2, 0.5);

/** Critical t for a two-sided confidence level. */
export function tCritical(df: number, conf = 0.95) {
  const target = 1 - conf;
  let lo = 0, hi = 100;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoTailedP(mid, df) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function welch(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b), va = variance(a), vb = variance(b);
  const na = a.length, nb = b.length;
  const se2 = va / na + vb / nb;
  const t = (mb - ma) / Math.sqrt(se2);
  const df = se2 ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  return { t, df, p: tTwoTailedP(Math.abs(t), df), meanA: ma, meanB: mb, sdA: Math.sqrt(va), sdB: Math.sqrt(vb) };
}

/** Cohen's d = (x̄₂ − x̄₁) / s_pooled. Positive when b > a. */
export function cohensD(a: number[], b: number[]) {
  const na = a.length, nb = b.length;
  const sp = Math.sqrt(((na - 1) * variance(a) + (nb - 1) * variance(b)) / (na + nb - 2));
  return (mean(b) - mean(a)) / sp;
}

export function effectLabel(d: number) {
  const x = Math.abs(d);
  if (x < 0.2) return "negligible";
  if (x < 0.5) return "small";
  if (x < 0.8) return "medium";
  return "large";
}

export function confidenceInterval(a: number[], conf = 0.95) {
  const m = mean(a), half = (tCritical(a.length - 1, conf) * sd(a)) / Math.sqrt(a.length);
  return [m - half, m + half] as const;
}

export function pearson(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const r = sxy / Math.sqrt(sxx * syy);
  const n = x.length;
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-12, 1 - r * r));
  return { r, p: n > 2 ? tTwoTailedP(Math.abs(t), n - 2) : 1, n };
}

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  const u = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return {
    uniform: u,
    normal: () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()),
  };
}

/** Simulate n throughput samples with a given mean and coefficient of variation. */
export function simulateRuns(mu: number, cv: number, n: number, seed: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => Math.max(0.01, mu * (1 + cv * r.normal())));
}

export const parseNumbers = (s: string) =>
  s.split(/[\s,;]+/).map(Number).filter((v) => Number.isFinite(v));
