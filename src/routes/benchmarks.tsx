import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Search } from "lucide-react";
import { CodeBlock, PageHeader, Panel, axisProps, chartTooltip, downloadText } from "@/components/site";
import { BENCHMARKS, PARAM_DEFS, defaultParams, generateSource, type ParamValues } from "@/lib/benchmarks";
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from "@/lib/paper-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/benchmarks")({
  head: () => ({
    meta: [
      { title: "Benchmark Suite Explorer — rvAIbench" },
      { name: "description", content: "Browse all 88 RISC-V AI microbenchmarks with C kernels, parameter controls and complexity." },
      { property: "og:title", content: "Benchmark Suite Explorer — rvAIbench" },
      { property: "og:description", content: "88 matrix, neural, vector and memory kernels with live C source generation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BenchmarksPage,
});

function BenchmarksPage() {
  const [cat, setCat] = useState<CategoryKey | "all">("all");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState(BENCHMARKS[1].id);
  const [params, setParams] = useState<Record<string, ParamValues>>({});

  const list = useMemo(
    () => BENCHMARKS.filter((b) => (cat === "all" || b.category === cat) && (b.name + b.id).toLowerCase().includes(q.toLowerCase())),
    [cat, q],
  );
  const sel = BENCHMARKS.find((b) => b.id === selId)!;
  const p = { ...defaultParams(sel), ...params[sel.id] };
  const src = generateSource(sel, p);
  const perf = [
    { k: "GCC scalar", v: sel.gccScalar, c: "var(--gcc)" },
    { k: "LLVM scalar", v: sel.llvmScalar, c: "var(--llvm)" },
    { k: "GCC +V", v: sel.gccVector, c: "var(--gcc)" },
    { k: "LLVM +V", v: sel.llvmVector, c: "var(--llvm)" },
  ];

  return (
    <div>
      <PageHeader eyebrow="Module 01" title="Benchmark Suite Explorer">
        88 microbenchmarks across four AI workload categories. Pick a kernel, tune its parameters and the C source regenerates instantly.
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...CATEGORY_KEYS] as const).map((k) => (
          <button
            key={k}
            onClick={() => setCat(k)}
            className={cn("rounded-full border px-3 py-1 font-mono text-xs", cat === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {k === "all" ? `All · 88` : `${CATEGORIES[k].label} · ${CATEGORIES[k].n}`}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search kernels" className="h-8 rounded-md border border-input bg-background pl-8 pr-3 text-sm" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="max-h-[78vh] overflow-y-auto rounded-lg border border-border bg-card">
          {list.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelId(b.id)}
              className={cn("flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left hover:bg-accent", b.id === selId && "bg-accent")}
            >
              <span className="font-mono text-[10px] text-muted-foreground">{String(b.index).padStart(2, "0")}</span>
              <span className="flex-1 truncate text-sm">{b.name}</span>
              <span className={cn("font-mono text-[10px]", b.llvmScalar >= b.gccScalar ? "text-llvm" : "text-gcc")}>
                {(b.llvmScalar / b.gccScalar).toFixed(2)}×
              </span>
            </button>
          ))}
          {list.length === 0 && <div className="p-4 text-sm text-muted-foreground">No kernels match.</div>}
        </div>

        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-primary">{CATEGORIES[sel.category].label} · #{sel.index}</div>
                <h2 className="mt-1 text-2xl font-bold">{sel.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{sel.description}</p>
              </div>
              <div className="flex gap-4 font-mono text-sm">
                <div><div className="text-[10px] uppercase text-muted-foreground">Time</div>{sel.complexity}</div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Space</div>{sel.memory}</div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Ops/call</div>{sel.ops}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sel.params.map((k) => (
                <label key={k} className="block">
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">{PARAM_DEFS[k].label}</span>
                  <select
                    value={String(p[k])}
                    onChange={(e) => setParams((s) => ({ ...s, [sel.id]: { ...s[sel.id], [k]: e.target.value } }))}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm"
                  >
                    {PARAM_DEFS[k].options.map((o) => (
                      <option key={o} value={String(o)}>{o}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{PARAM_DEFS[k].hint}</span>
                </label>
              ))}
            </div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
            <Panel
              title={`${sel.id}.c`}
              action={
                <button onClick={() => downloadText(src, `${sel.id}.c`, "text/x-c")} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-xs hover:bg-accent">
                  <Download className="h-3 w-3" /> .c
                </button>
              }
            >
              <CodeBlock code={src} />
            </Panel>
            <Panel title="Throughput (M ops/s)">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={perf}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="k" {...axisProps} fontSize={9} />
                    <YAxis {...axisProps} />
                    <Tooltip {...chartTooltip} cursor={{ fill: "var(--accent)" }} />
                    <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                      {perf.map((d, i) => <Cell key={i} fill={d.c} fillOpacity={i > 1 ? 0.55 : 1} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Simulated per-kernel values calibrated to the paper's category means (Table IV) and vector impact (Table VI).
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
