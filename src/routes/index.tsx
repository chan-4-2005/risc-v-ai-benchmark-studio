import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Binary, Calculator, Download, Layers } from "lucide-react";
import { Stat } from "@/components/site";
import { CATEGORIES, CATEGORY_KEYS, HEADLINE, TOOLCHAIN } from "@/lib/paper-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "rvAIbench — GCC vs LLVM for AI on RISC-V" },
      { name: "description", content: "Explore 88 AI microbenchmarks, assembly, statistics and reproduction kits comparing GCC 15.1 and LLVM 21.1 on RV64GC/RV64GCV." },
      { property: "og:title", content: "rvAIbench — GCC vs LLVM for AI on RISC-V" },
      { property: "og:description", content: "Interactive workbench for the RISC-V AI compiler performance study." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const MODULES = [
  { to: "/benchmarks", icon: Layers, title: "Benchmark Suite Explorer", text: "All 88 kernels with C source, parameters and complexity." },
  { to: "/dashboard", icon: BarChart3, title: "Performance Dashboard", text: "Category throughput, radar profiles and vector divergence." },
  { to: "/assembly", icon: Binary, title: "Assembly Inspector", text: "GCC vs LLVM RISC-V code for GEMM, Sigmoid, SAXPY, reductions." },
  { to: "/statistics", icon: Calculator, title: "Statistics Studio", text: "Welch's t, Cohen's d, CIs and QEMU↔BeagleV correlation." },
  { to: "/export", icon: Download, title: "Export Center", text: "C sources, Makefile, Dockerfile and Python analysis." },
] as const;

function Index() {
  return (
    <div className="space-y-12">
      <section className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary">RV64GC · RV64GCV · RVV 1.0</div>
          <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
            Which compiler should run your AI workloads on <span className="text-primary">RISC-V</span>?
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            A workbench for the GCC vs LLVM study: {TOOLCHAIN.gcc} against {TOOLCHAIN.llvm}, 88 microbenchmarks, {TOOLCHAIN.qemu}, validated on BeagleV-Ahead hardware.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/export" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
              Get reproduction kit
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Scalar speedup" value={`${HEADLINE.scalarSpeedup}×`} sub="LLVM over GCC · p<0.001 · d=0.89" tone="llvm" />
          <Stat label="LLVM + RVV" value="+28.3%" sub="1.283× vs scalar · d=0.67" tone="primary" />
          <Stat label="GCC + RVV" value="−69%" sub="0.312× vs scalar · d=−1.42" tone="destructive" />
          <Stat label="QEMU ↔ HW" value={`r=${HEADLINE.correlation}`} sub="BeagleV-Ahead, n=20" tone="gcc" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {CATEGORY_KEYS.map((k) => {
          const c = CATEGORIES[k];
          return (
            <div key={k} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{c.label}</span>
                <span className="font-mono text-xs text-muted-foreground">n={c.n}</span>
              </div>
              <div className={`mt-2 font-mono text-2xl font-bold ${c.adv > 0 ? "text-llvm" : "text-gcc"}`}>
                {c.adv > 0 ? "+" : ""}{c.adv}%
              </div>
              <div className="text-xs text-muted-foreground">{c.adv > 0 ? "LLVM" : "GCC"} advantage · {c.gcc} vs {c.llvm} M ops/s</div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary">
            <m.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 text-lg font-semibold">{m.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
            <span className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
              open <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
