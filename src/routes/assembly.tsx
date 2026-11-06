import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/site";
import { ASM, KERNELS, TAG_INFO, type AsmLine, type KernelId, type Tag } from "@/lib/assembly";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assembly")({
  head: () => ({
    meta: [
      { title: "Assembly Inspector — rvAIbench" },
      { name: "description", content: "Side-by-side GCC vs LLVM RISC-V assembly for GEMM, Sigmoid, SAXPY and reductions with root-cause annotations." },
      { property: "og:title", content: "Assembly Inspector — rvAIbench" },
      { property: "og:description", content: "Spot RVV instruction selection, register spills, unrolling and SLP vectorisation differences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssemblyPage,
});

const TAG_CLS: Record<Tag, string> = {
  vector: "bg-llvm/15 border-l-llvm",
  spill: "bg-destructive/20 border-l-destructive",
  unroll: "bg-primary/10 border-l-primary",
  slp: "bg-ok/15 border-l-ok",
  call: "bg-warn/20 border-l-warn",
  scalar: "bg-gcc/15 border-l-gcc",
  loop: "border-l-muted-foreground/40",
};
const DOT: Record<Tag, string> = {
  vector: "bg-llvm", spill: "bg-destructive", unroll: "bg-primary", slp: "bg-ok", call: "bg-warn", scalar: "bg-gcc", loop: "bg-muted-foreground",
};

function AsmView({ lines, active, onHover }: { lines: AsmLine[]; active: Set<Tag>; onHover: (n?: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-code py-2 font-mono text-xs">
      {lines.map((l, i) => {
        const on = l.tag && active.has(l.tag);
        return (
          <div
            key={i}
            onMouseEnter={() => onHover(l.note)}
            onMouseLeave={() => onHover(undefined)}
            className={cn("flex border-l-2 border-l-transparent px-3 py-0.5", on && l.tag && TAG_CLS[l.tag], l.note && "cursor-help")}
          >
            <span className="w-7 shrink-0 select-none text-muted-foreground/60">{i + 1}</span>
            <span className="whitespace-pre">{l.text}</span>
            {l.note && <span className="ml-auto pl-4 text-muted-foreground/70">●</span>}
          </div>
        );
      })}
    </div>
  );
}

function StatsRow({ s, tone }: { s: { instrs: number; vector: number; spills: number; unroll: number }; tone: string }) {
  return (
    <div className="mb-3 grid grid-cols-4 gap-2 font-mono text-xs">
      {[["instrs/iter", s.instrs], ["RVV ops", s.vector], ["spills", s.spills], ["unroll", `×${s.unroll}`]].map(([k, v]) => (
        <div key={k as string} className="rounded border border-border p-2">
          <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
          <div className={cn("text-lg font-bold", k === "spills" && Number(v) > 0 ? "text-destructive" : tone)}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function AssemblyPage() {
  const [k, setK] = useState<KernelId>("gemm");
  const [target, setTarget] = useState<"scalar" | "vector">("vector");
  const [active, setActive] = useState<Set<Tag>>(new Set(Object.keys(TAG_INFO) as Tag[]));
  const [note, setNote] = useState<string>();
  const pair = ASM[k][target];
  const kernel = KERNELS.find((x) => x.id === k)!;

  const toggle = (t: Tag) => setActive((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Module 03" title="Assembly Inspector & Root-Cause Analysis">
        Representative -O3 hot loops reconstructed from the code-generation patterns the paper identifies. Hover annotated lines (●) for explanations.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {KERNELS.map((x) => (
          <button key={x.id} onClick={() => setK(x.id)} className={cn("rounded-md border px-3 py-1.5 text-sm", k === x.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}>
            {x.name}
          </button>
        ))}
        <div className="ml-auto flex rounded-md border border-border p-0.5">
          {(["scalar", "vector"] as const).map((t) => (
            <button key={t} onClick={() => setTarget(t)} className={cn("rounded px-3 py-1 font-mono text-xs", target === t ? "bg-accent text-primary" : "text-muted-foreground")}>
              {t === "scalar" ? "-march=rv64gc" : "-march=rv64gcv"}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        <div className="font-mono text-xs text-muted-foreground">C source</div>
        <div className="mt-1 font-mono text-sm text-primary">{kernel.c}</div>
        <p className="mt-3 text-sm">{pair.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(TAG_INFO) as Tag[]).map((t) => (
            <button key={t} onClick={() => toggle(t)} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", active.has(t) ? "border-border" : "border-transparent opacity-40")}>
              <span className={cn("h-2 w-2 rounded-full", DOT[t])} />{TAG_INFO[t].label}
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="GCC 15.1.0">
          <StatsRow s={pair.gccStats} tone="text-gcc" />
          <AsmView lines={pair.gcc} active={active} onHover={setNote} />
        </Panel>
        <Panel title="LLVM 21.1.5">
          <StatsRow s={pair.llvmStats} tone="text-llvm" />
          <AsmView lines={pair.llvm} active={active} onHover={setNote} />
        </Panel>
      </div>

      <div className={cn("sticky bottom-4 rounded-md border border-primary bg-popover p-3 font-mono text-sm transition-opacity", note ? "opacity-100" : "pointer-events-none opacity-0")}>
        {note ?? "\u00a0"}
      </div>

      <Panel title="Root causes from the paper">
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div><b className="text-gcc">QEMU TCG overhead.</b> <span className="text-muted-foreground">Scalar RISC-V→x86 translation is a decade mature; RVV translation is not. GCC's aggressive vectorisation multiplies emulated vector ops.</span></div>
          <div><b className="text-gcc">Vectorisation threshold.</b> <span className="text-muted-foreground">GCC vectorises small trip-count loops where unrolled scalar code wins; LLVM's SLP vectoriser fuses only when profitable.</span></div>
          <div><b className="text-gcc">Register allocation.</b> <span className="text-muted-foreground">GCC spills vector register groups (vs8r.v / vl8re32.v) where LLVM keeps accumulators resident.</span></div>
          <div><b className="text-llvm">libm quality.</b> <span className="text-muted-foreground">LLVM inlines reduced-degree polynomials for exp/tanh — Sigmoid 2.1×, Tanh 1.9× faster.</span></div>
        </div>
      </Panel>
    </div>
  );
}
