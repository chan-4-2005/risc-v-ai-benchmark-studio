# RISC-V AI Benchmark Studio

Build an interactive RISC-V AI compiler benchmark platform and workbench based on the attached research paper 'Compiler Performance Analysis for AI Workloads on RISC-V: A Comprehensive Comparison of GCC and LLVM'.

The platform should include:
1. Complete Benchmark Suite Explorer: Browse all 85 microbenchmarks across the 4 categories (Matrix Operations n=19, Neural Network Primitives n=19, Vector Computations n=23, Memory Access Patterns n=24) with full C implementation kernels, parameter controls (dimensions, tile sizes, activation functions, vector lengths), and theoretical complexity.
2. Performance & Comparison Dashboard: Interactive visualizations of the paper's empirical findings comparing GCC 15.1.0 vs LLVM 21.1.5 on RV64GC (scalar) and RV64GCV (RVV 1.0 vector, VLEN=256), including category throughput breakdowns, radar charts, the 1.447x scalar speedup, and the divergent vectorization results (LLVM +28.3% speedup vs GCC -69% regression).
3. Assembly Inspector & Root-Cause Analysis: Side-by-side interactive RISC-V assembly viewer contrasting GCC and LLVM generated code for key kernels (GEMM, Sigmoid, SAXPY, reductions), highlighting vector instruction selection, register spills, unrolling, and SLP vectorization differences.
4. Statistical Analysis & Hardware Validation Studio: Interactive calculator and validator replicating the paper's Welch's t-test, Cohen's d effect sizes, and the QEMU vs BeagleV physical hardware correlation (r=0.87), allowing users to input or simulate custom benchmark runs.
5. Code & Environment Export Center: One-click export and download of ready-to-run C source files, Makefile with the exact compiler flags (-O3 -march=rv64gc / -march=rv64gcv -mabi=lp64d), Dockerfile preconfigured with QEMU 8.2 and RISC-V GCC/LLVM toolchains, and the Python statistical analysis script.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d9b7c1ff-7672-4ddf-9a0e-a58ff215c78f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
