import { BENCHMARKS } from "./benchmarks";
import { TOOLCHAIN } from "./paper-data";

export function makefile(ids: string[] = BENCHMARKS.map((b) => b.id)) {
  return `# RISC-V AI compiler benchmark suite — GCC ${TOOLCHAIN.gcc.split(" ")[1]} vs ${TOOLCHAIN.llvm}
# Usage: make all && make run

GCC     ?= riscv64-linux-gnu-gcc
CLANG   ?= clang
QEMU    ?= qemu-riscv64
SYSROOT ?= /usr/riscv64-linux-gnu

OPT      = ${TOOLCHAIN.opt}
ABI      = ${TOOLCHAIN.abi}
SCALAR   = ${TOOLCHAIN.scalar}
VECTOR   = ${TOOLCHAIN.vector}
LDFLAGS  = -static -lm
CLANGTGT = --target=riscv64-linux-gnu --sysroot=$(SYSROOT) --gcc-toolchain=/usr

QEMU_CPU = -cpu rv64,v=true,vlen=${TOOLCHAIN.vlen},vext_spec=v1.0

BENCHES = ${ids.join(" \\\n          ")}

BIN = bin
OUT = results

CONFIGS = gcc_scalar gcc_vector llvm_scalar llvm_vector
TARGETS = $(foreach c,$(CONFIGS),$(addprefix $(BIN)/$(c)/,$(BENCHES)))

.PHONY: all run clean stats

all: $(TARGETS)

$(BIN)/gcc_scalar/%: src/%.c
\t@mkdir -p $(@D)
\t$(GCC) $(OPT) $(SCALAR) $(ABI) $< -o $@ $(LDFLAGS)

$(BIN)/gcc_vector/%: src/%.c
\t@mkdir -p $(@D)
\t$(GCC) $(OPT) $(VECTOR) $(ABI) $< -o $@ $(LDFLAGS)

$(BIN)/llvm_scalar/%: src/%.c
\t@mkdir -p $(@D)
\t$(CLANG) $(CLANGTGT) $(OPT) $(SCALAR) $(ABI) $< -o $@ $(LDFLAGS)

$(BIN)/llvm_vector/%: src/%.c
\t@mkdir -p $(@D)
\t$(CLANG) $(CLANGTGT) $(OPT) $(VECTOR) $(ABI) $< -o $@ $(LDFLAGS)

# Pin to cores 0-5 as in the paper's protocol
run: all
\t@mkdir -p $(OUT)
\t@for c in $(CONFIGS); do \\
\t  echo "benchmark,iter,ns,mops" > $(OUT)/$$c.csv; \\
\t  for b in $(BENCHES); do \\
\t    QEMU_MTCG=1 taskset -c 0-5 $(QEMU) $(QEMU_CPU) $(BIN)/$$c/$$b | tail -n +2 >> $(OUT)/$$c.csv; \\
\t  done; \\
\tdone

stats: run
\tpython3 analysis.py $(OUT)

clean:
\trm -rf $(BIN) $(OUT)
`;
}

export function dockerfile() {
  return `# Reproducible environment: QEMU 8.2 + RISC-V GCC + LLVM/Clang
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \\
      build-essential git wget ca-certificates ninja-build pkg-config python3 python3-pip \\
      libglib2.0-dev libpixman-1-dev flex bison gnupg lsb-release software-properties-common \\
      gcc-riscv64-linux-gnu g++-riscv64-linux-gnu libc6-dev-riscv64-cross util-linux \\
 && rm -rf /var/lib/apt/lists/*

# --- QEMU 8.2 (user-mode, RVV 1.0) ---
RUN wget -q https://download.qemu.org/qemu-8.2.0.tar.xz && tar xf qemu-8.2.0.tar.xz \\
 && cd qemu-8.2.0 && ./configure --target-list=riscv64-linux-user --disable-docs \\
 && make -j"$(nproc)" && make install && cd .. && rm -rf qemu-8.2.0*

# --- LLVM 21 (clang) ---
RUN wget -qO /tmp/llvm.sh https://apt.llvm.org/llvm.sh && chmod +x /tmp/llvm.sh \\
 && /tmp/llvm.sh 21 && ln -sf /usr/bin/clang-21 /usr/local/bin/clang

# --- GCC 15.1 cross toolchain (riscv-gnu-toolchain) ---
# Ubuntu's packaged cross GCC is older; build 15.1.0 for exact reproduction.
ARG BUILD_GCC15=1
RUN if [ "$BUILD_GCC15" = "1" ]; then \\
      apt-get update && apt-get install -y autoconf automake autotools-dev curl libmpc-dev libmpfr-dev \\
        libgmp-dev gawk texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev && \\
      git clone --depth 1 https://github.com/riscv-collab/riscv-gnu-toolchain /opt/rgt && \\
      cd /opt/rgt && git submodule update --init --depth 1 gcc binutils glibc && \\
      cd gcc && git fetch --depth 1 origin releases/gcc-15.1.0 && git checkout FETCH_HEAD && cd .. && \\
      ./configure --prefix=/opt/riscv --with-arch=rv64gcv --with-abi=lp64d && make linux -j"$(nproc)" && \\
      rm -rf /opt/rgt; fi
ENV PATH="/opt/riscv/bin:$PATH"

RUN pip3 install --no-cache-dir numpy scipy pandas matplotlib

WORKDIR /bench
COPY . /bench
# GCC=riscv64-unknown-linux-gnu-gcc when built from source above
CMD ["bash", "-lc", "make GCC=$( command -v riscv64-unknown-linux-gnu-gcc || echo riscv64-linux-gnu-gcc ) stats"]
`;
}

export function analysisPy() {
  return `#!/usr/bin/env python3
"""Statistical analysis replicating the paper:
Welch's t-test, Cohen's d (pooled), 95% CI, Bonferroni (alpha=0.05/88),
and LLVM/GCC speedups for scalar (rv64gc) and vector (rv64gcv, VLEN=256).
Usage: python3 analysis.py results/
"""
import sys, os
import numpy as np
import pandas as pd
from scipy import stats

ALPHA = 0.05
N_TESTS = 88
BONF = ALPHA / N_TESTS  # 5.7e-4

CATEGORY = {}  # filled from categories.csv if present


def cohens_d(a, b):
    na, nb = len(a), len(b)
    sp = np.sqrt(((na - 1) * np.var(a, ddof=1) + (nb - 1) * np.var(b, ddof=1)) / (na + nb - 2))
    return (np.mean(b) - np.mean(a)) / sp


def effect(d):
    d = abs(d)
    return "negligible" if d < 0.2 else "small" if d < 0.5 else "medium" if d < 0.8 else "large"


def ci95(x):
    x = np.asarray(x)
    h = stats.t.ppf(0.975, len(x) - 1) * x.std(ddof=1) / np.sqrt(len(x))
    return x.mean() - h, x.mean() + h


def compare(df_a, df_b, label_a, label_b):
    rows = []
    for bench in sorted(set(df_a.benchmark) & set(df_b.benchmark)):
        a = df_a[df_a.benchmark == bench].mops.values
        b = df_b[df_b.benchmark == bench].mops.values
        t, p = stats.ttest_ind(b, a, equal_var=False)
        d = cohens_d(a, b)
        lo, hi = ci95(b)
        rows.append(dict(benchmark=bench, category=CATEGORY.get(bench, "?"),
                         **{f"{label_a}_mean": a.mean(), f"{label_b}_mean": b.mean()},
                         speedup=b.mean() / a.mean(), t=t, p=p, significant=p < BONF,
                         cohens_d=d, effect=effect(d), ci_low=lo, ci_high=hi,
                         cv=b.std(ddof=1) / b.mean()))
    return pd.DataFrame(rows)


def main(path):
    load = lambda n: pd.read_csv(os.path.join(path, f"{n}.csv"))
    cat_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "categories.csv")
    if os.path.exists(cat_file):
        CATEGORY.update(dict(pd.read_csv(cat_file).values))

    gs, gv, ls, lv = (load(n) for n in ["gcc_scalar", "gcc_vector", "llvm_scalar", "llvm_vector"])

    scalar = compare(gs, ls, "gcc", "llvm")
    print("=== Scalar rv64gc: LLVM vs GCC ===")
    print(scalar.groupby("category")[["gcc_mean", "llvm_mean", "speedup"]].mean().round(3))
    print(f"Geometric-mean speedup: {stats.gmean(scalar.speedup):.3f}x")
    print(f"Significant after Bonferroni: {scalar.significant.sum()}/{len(scalar)}")
    print(f"LLVM wins: {(scalar.speedup > 1).mean() * 100:.1f}% of tests")
    all_t = stats.ttest_ind(ls.mops, gs.mops, equal_var=False)
    print(f"Pooled Welch t={all_t.statistic:.3f} p={all_t.pvalue:.2e} d={cohens_d(gs.mops, ls.mops):.2f}")

    for name, sc, vc in [("GCC", gs, gv), ("LLVM", ls, lv)]:
        r = compare(sc, vc, "scalar", "vector")
        print(f"\\n=== {name}: vector vs scalar ===")
        print(r.groupby("category").speedup.mean().round(3))
        print(f"Mean vector speedup: {r.speedup.mean():.3f}x")

    scalar.to_csv(os.path.join(path, "scalar_comparison.csv"), index=False)
    print("\\nWrote", os.path.join(path, "scalar_comparison.csv"))


def hw_correlation(qemu, hw):
    """QEMU vs BeagleV ratio correlation (paper: r = 0.87)."""
    r, p = stats.pearsonr(qemu, hw)
    return r, p


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "results")
`;
}

export function categoriesCsv() {
  return "benchmark,category\n" + BENCHMARKS.map((b) => `${b.id},${b.category}`).join("\n") + "\n";
}

export function readme() {
  return `# RISC-V AI Compiler Benchmark Suite

Reproduction kit for "Compiler Performance Analysis for AI Workloads on RISC-V:
A Comprehensive Comparison of GCC and LLVM".

- ${BENCHMARKS.length} microbenchmarks in src/ (matrix 19, neural 19, vector 23, memory 24)
- Compilers: ${TOOLCHAIN.gcc}, ${TOOLCHAIN.llvm}
- Flags: ${TOOLCHAIN.opt} ${TOOLCHAIN.scalar} | ${TOOLCHAIN.vector} (VLEN=${TOOLCHAIN.vlen}) ${TOOLCHAIN.abi}
- Emulator: ${TOOLCHAIN.qemu}
- Protocol: ${TOOLCHAIN.protocol}

## Quick start
    docker build -t rv-ai-bench .
    docker run --rm -v $PWD/results:/bench/results rv-ai-bench

## Manual
    make all        # build 4 configurations
    make run        # execute under QEMU, CSV in results/
    make stats      # Welch t-test, Cohen's d, speedups

Override sizes at compile time, e.g. make CFLAGS_EXTRA="-DN=1024 -DTILE=64".
`;
}
