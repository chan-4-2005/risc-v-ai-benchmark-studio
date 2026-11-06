// Empirical values transcribed from the paper (Tables II–VII).
export type CategoryKey = "matrix" | "neural" | "vector" | "memory";

export const CATEGORIES: Record<
  CategoryKey,
  { label: string; n: number; gcc: number; llvm: number; adv: number; p: string; d: number; gccVec: number; llvmVec: number }
> = {
  matrix: { label: "Matrix Operations", n: 19, gcc: 113.45, llvm: 162.49, adv: 43.2, p: "0.001", d: 0.91, gccVec: 0.422, llvmVec: 1.368 },
  neural: { label: "Neural Network Primitives", n: 19, gcc: 59.45, llvm: 84.95, adv: 42.9, p: "<0.001", d: 0.87, gccVec: 0.247, llvmVec: 1.285 },
  vector: { label: "Vector Computations", n: 23, gcc: 100.8, llvm: 137.27, adv: 36.2, p: "<0.001", d: 0.73, gccVec: 0.272, llvmVec: 1.321 },
  memory: { label: "Memory Access Patterns", n: 24, gcc: 515.15, llvm: 451.12, adv: -12.4, p: "0.03", d: 0.31, gccVec: 0.291, llvmVec: 1.151 },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export const HEADLINE = {
  scalarSpeedup: 1.447,
  scalarP: "<0.001",
  scalarD: 0.89,
  llvmVecSpeedup: 1.283,
  llvmVecD: 0.67,
  gccVecRatio: 0.312,
  gccVecD: -1.42,
  gccMean: 211.38,
  llvmMean: 219.83,
  gccMax: 4863.31,
  llvmMax: 1622.16,
  gccMin: 0.49,
  llvmMin: 0.59,
  bonferroni: 0.05 / 88,
  correlation: 0.87,
};

export const TOOLCHAIN = {
  gcc: "GCC 15.1.0",
  llvm: "LLVM 21.1.5 (clang)",
  opt: "-O3",
  scalar: "-march=rv64gc",
  vector: "-march=rv64gcv",
  vlen: 256,
  abi: "-mabi=lp64d",
  qemu: "QEMU 8.2 user-mode (MTCG=1)",
  host: "AMD Ryzen 7 5800X, 32GB DDR4-3200, Ubuntu 22.04",
  protocol: "10 warmup + 100 measured iterations, clock_gettime(CLOCK_MONOTONIC)",
};

export const HW_VALIDATION = [
  { category: "Matrix", tests: 5, qemu: 1.43, beaglev: 1.31, r: 0.89 },
  { category: "Neural", tests: 5, qemu: 1.41, beaglev: 1.28, r: 0.92 },
  { category: "Vector", tests: 5, qemu: 1.36, beaglev: 1.22, r: 0.85 },
  { category: "Memory", tests: 5, qemu: 0.88, beaglev: 0.91, r: 0.78 },
];
export const HW_OVERALL = { qemu: 1.45, beaglev: 1.24, r: 0.87 };
