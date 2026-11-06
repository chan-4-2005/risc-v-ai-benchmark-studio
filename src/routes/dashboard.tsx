import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { PageHeader, Panel, Stat, axisProps, chartTooltip } from "@/components/site";
import { BENCHMARKS } from "@/lib/benchmarks";
import { CATEGORIES, CATEGORY_KEYS, HEADLINE } from "@/lib/paper-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Performance Dashboard — rvAIbench" },
      { name: "description", content: "GCC 15.1 vs LLVM 21.1 throughput on RV64GC and RV64GCV: category breakdowns, radar profiles and RVV divergence." },
      { property: "og:title", content: "Performance Dashboard — rvAIbench" },
      { property: "og:description", content: "1.447× scalar speedup, LLVM +28.3% with RVV, GCC −69% regression." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const catData = CATEGORY_KEYS.map((k) => {
  const c = CATEGORIES[k];
  return {
    name: c.label.split(" ")[0],
    gcc: c.gcc, llvm: c.llvm,
    gccV: +(c.gcc * c.gccVec).toFixed(2), llvmV: +(c.llvm * c.llvmVec).toFixed(2),
    gccVec: c.gccVec, llvmVec: c.llvmVec, adv: c.adv,
  };
});

const maxOf = (k: "gcc" | "llvm" | "gccV" | "llvmV") => Math.max(...catData.map((d) => d[k]));

function Dashboard() {
  const [mode, setMode] = useState<"scalar" | "vector" | "all">("scalar");
  const [log, setLog] = useState(true);

  const radar = catData.map((d) => ({
    axis: d.name,
    "GCC scalar": (d.gcc / Math.max(d.gcc, d.llvm, d.llvmV)) * 100,
    "LLVM scalar": (d.llvm / Math.max(d.gcc, d.llvm, d.llvmV)) * 100,
    "GCC +V": (d.gccV / Math.max(d.gcc, d.llvm, d.llvmV)) * 100,
    "LLVM +V": (d.llvmV / Math.max(d.gcc, d.llvm, d.llvmV)) * 100,
  }));
  void maxOf;

  const scatter = BENCHMARKS.map((b) => ({ x: b.gccScalar, y: b.llvmScalar, name: b.name, cat: b.category }));
  const vecDiv = catData.map((d) => ({ name: d.name, GCC: +((d.gccVec - 1) * 100).toFixed(1), LLVM: +((d.llvmVec - 1) * 100).toFixed(1) }));
  const wins = BENCHMARKS.filter((b) => b.llvmScalar > b.gccScalar).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Module 02" title="Performance & Comparison Dashboard">
        Empirical findings for GCC 15.1.0 and LLVM 21.1.5 at -O3 on RV64GC (scalar) and RV64GCV (RVV 1.0, VLEN=256) under QEMU 8.2.
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="GCC mean" value={`${HEADLINE.gccMean}`} sub={`M ops/s · max ${HEADLINE.gccMax}`} tone="gcc" />
        <Stat label="LLVM mean" value={`${HEADLINE.llvmMean}`} sub={`M ops/s · max ${HEADLINE.llvmMax}`} tone="llvm" />
        <Stat label="Scalar speedup" value="1.447×" sub="Welch p<0.001 · d=0.89 (large)" />
        <Stat label="LLVM vector" value="1.283×" sub="+28.3% · d=0.67" tone="llvm" />
        <Stat label="GCC vector" value="0.312×" sub="−69% · d=−1.42" tone="destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Category throughput (M ops/s)"
          action={
            <div className="flex gap-1">
              {(["scalar", "vector", "all"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cn("rounded px-2 py-1 font-mono text-[11px]", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                  {m}
                </button>
              ))}
              <button onClick={() => setLog(!log)} className={cn("ml-2 rounded px-2 py-1 font-mono text-[11px]", log ? "bg-accent text-foreground" : "text-muted-foreground")}>
                log
              </button>
            </div>
          }
        >
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={catData}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} scale={log ? "log" : "auto"} domain={log ? [5, "auto"] : [0, "auto"]} allowDataOverflow />
                <Tooltip {...chartTooltip} cursor={{ fill: "var(--accent)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {mode !== "vector" && <Bar dataKey="gcc" name="GCC rv64gc" fill="var(--gcc)" radius={[3, 3, 0, 0]} />}
                {mode !== "vector" && <Bar dataKey="llvm" name="LLVM rv64gc" fill="var(--llvm)" radius={[3, 3, 0, 0]} />}
                {mode !== "scalar" && <Bar dataKey="gccV" name="GCC rv64gcv" fill="var(--gcc)" fillOpacity={0.45} radius={[3, 3, 0, 0]} />}
                {mode !== "scalar" && <Bar dataKey="llvmV" name="LLVM rv64gcv" fill="var(--llvm)" fillOpacity={0.45} radius={[3, 3, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Normalised profile (radar)">
          <div className="h-80">
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                <Radar dataKey="LLVM +V" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} />
                <Radar dataKey="LLVM scalar" stroke="var(--llvm)" fill="var(--llvm)" fillOpacity={0.2} />
                <Radar dataKey="GCC scalar" stroke="var(--gcc)" fill="var(--gcc)" fillOpacity={0.2} />
                <Radar dataKey="GCC +V" stroke="var(--destructive)" fill="var(--destructive)" fillOpacity={0.1} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip {...chartTooltip} formatter={(v: number) => `${v.toFixed(0)}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Divergent vectorisation: RVV speedup vs scalar (%)">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={vecDiv}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} unit="%" />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                <Tooltip {...chartTooltip} cursor={{ fill: "var(--accent)" }} formatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="LLVM" fill="var(--llvm)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="GCC" fill="var(--destructive)" radius={[0, 0, 3, 3]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            LLVM gains in every category (1.151×–1.368×). GCC regresses across the board (0.247×–0.422×): a miscalibrated RVV cost model, vector register spills and QEMU TCG's immature RVV translation.
          </p>
        </Panel>

        <Panel title={`Per-benchmark scalar throughput · LLVM wins ${wins}/88`}>
          <div className="h-72">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="var(--border)" />
                <XAxis type="number" dataKey="x" name="GCC" scale="log" domain={["auto", "auto"]} {...axisProps} label={{ value: "GCC M ops/s", fill: "var(--muted-foreground)", fontSize: 11, position: "insideBottom", offset: -2 }} />
                <YAxis type="number" dataKey="y" name="LLVM" scale="log" domain={["auto", "auto"]} {...axisProps} />
                <ZAxis range={[40, 40]} />
                <ReferenceLine segment={[{ x: 1, y: 1 }, { x: 5000, y: 5000 }]} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <Tooltip {...chartTooltip} formatter={(v: number) => v.toFixed(1)} labelFormatter={() => ""} />
                {CATEGORY_KEYS.map((k, i) => (
                  <Scatter key={k} name={CATEGORIES[k].label} data={scatter.filter((s) => s.cat === k)} fill={`var(--chart-${i + 1})`} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Table IV / VI — category breakdown">
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2">Category</th><th>n</th><th>GCC</th><th>LLVM</th><th>LLVM adv.</th><th>p</th><th>Cohen's d</th><th>GCC vec</th><th>LLVM vec</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_KEYS.map((k) => {
                const c = CATEGORIES[k];
                return (
                  <tr key={k} className="border-b border-border/50">
                    <td className="py-2 font-sans">{c.label}</td><td>{c.n}</td>
                    <td className="text-gcc">{c.gcc}</td><td className="text-llvm">{c.llvm}</td>
                    <td className={c.adv > 0 ? "text-llvm" : "text-gcc"}>{c.adv > 0 ? "+" : ""}{c.adv}%</td>
                    <td>{c.p}</td><td>{c.d}</td>
                    <td className="text-destructive">{c.gccVec}×</td><td className="text-primary">{c.llvmVec}×</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
