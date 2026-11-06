import { describe, expect, it } from "vitest";
import { cohensD, effectLabel, pearson, tTwoTailedP, welch } from "./stats";

describe("statistics", () => {
  it("Welch t-test matches a known textbook result", () => {
    const a = [27.5, 21.0, 19.0, 23.6, 17.0, 17.9, 16.9, 20.1, 21.9, 22.6, 23.1, 19.6, 19.0, 21.7, 21.4];
    const b = [27.1, 22.0, 20.8, 23.4, 23.4, 23.5, 25.8, 22.0, 24.8, 20.2, 21.9, 22.1, 22.9, 20.5, 24.4];
    const r = welch(a, b);
    expect(r.t).toBeCloseTo(2.46, 1);
    expect(r.df).toBeCloseTo(24.99, 0);
    expect(r.p).toBeCloseTo(0.021, 2);
  });

  it("t distribution two-tailed p at df=10, t=2.228 is 0.05", () => {
    expect(tTwoTailedP(2.228, 10)).toBeCloseTo(0.05, 3);
  });

  it("Cohen's d uses pooled sd and paper thresholds", () => {
    expect(cohensD([1, 2, 3], [2, 3, 4])).toBeCloseTo(1, 5);
    expect(effectLabel(0.89)).toBe("large");
    expect(effectLabel(0.67)).toBe("medium");
    expect(effectLabel(0.31)).toBe("small");
  });

  it("Pearson r is 1 for perfectly linear data", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8]).r).toBeCloseTo(1, 6);
  });
});
