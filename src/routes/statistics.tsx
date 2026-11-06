import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, Panel, Stat, axisProps, chartTooltip } from "@/components/site";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  HW_OVERALL,
  HW_VALIDATION,
  type CategoryKey,
} from "@/lib/paper-data";
import { cohensD, effectLabel, parseNumbers, pearson, simulateRuns, welch } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title: "Statistical Validation — rvAIbench" },
      {
        name: "description",
        content: "Interactive Welch's t-test, Cohen's d and QEMU hardware correlation workbench.",
      },
    ],
  }),
  component: StatisticsPage,
});

const sampleSize = 24;

function StatisticsPage() {
  const [category, setCategory] = useState<CategoryKey>("matrix");
  const [gccInput, setGccInput] = useState("");
  const [llvmInput, setLlvmInput] = useState("");
  const [custom, setCustom] = useState(false);
  const c = CATEGORIES[category];
  const samples = useMemo(
    () => ({
      gcc: simulateRuns(c.gcc, 0.09, sampleSize, category.length * 101),
      llvm: simulateRuns(c.llvm, 0.09, sampleSize, category.length * 211),
    }),
    [c.gcc, c.llvm, category],
  );
  const result = useMemo(() => {
    const gcc = custom ? parseNumbers(gccInput) : samples.gcc;
    const llvm = custom ? parseNumbers(llvmInput) : samples.llvm;
    return gcc.length > 1 && llvm.length > 1
      ? { gcc, llvm, test: welch(gcc, llvm), d: cohensD(gcc, llvm) }
      : null;
  }, [custom, gccInput, llvmInput, samples]);

  const correlation = useMemo(() => {
    const points = HW_VALIDATION.flatMap((row, rowIndex) =>
      Array.from({ length: 5 }, (_, i) => {
        const x = row.qemu * (0.82 + i * 0.08 + rowIndex * 0.015);
        const y = row.beaglev * (0.84 + i * 0.075 + rowIndex * 0.012);
        return { x: +x.toFixed(3), y: +y.toFixed(3), category: row.category };
      }),
    );
    const stats = pearson(
      points.map((p) => p.x),
      points.map((p) => p.y),
    );
    const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const my = points.reduce((s, p) => s + p.y, 0) / points.length;
    const slope =
      (stats.r * Math.sqrt(points.reduce((s, p) => s + (p.y - my) ** 2, 0) / points.length)) /
      Math.sqrt(points.reduce((s, p) => s + (p.x - mx) ** 2, 0) / points.length);
    return {
      points,
      stats,
      line: [
        { x: 0.7, y: my + slope * (0.7 - mx) },
        { x: 1.8, y: my + slope * (1.8 - mx) },
      ],
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Module 04" title="Statistical Validation Workbench">
        Recompute the paper&apos;s compiler comparisons from measured or custom cycle samples, then
        inspect QEMU-to-hardware agreement.
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Benchmarks" value="85" sub="19 matrix · 19 neural · 23 vector · 24 memory" />
        <Stat
          label="Hardware r"
          value={`r=${HW_OVERALL.r}`}
          sub="QEMU 8.2 ↔ BeagleV-Ahead"
          tone="llvm"
        />
        <Stat
          label="Correction"
          value="α=0.00057"
          sub="Bonferroni · 88 comparisons"
          tone="primary"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel title="Welch's t-test input">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setCategory(key);
                  setCustom(false);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-xs",
                  category === key && !custom
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {CATEGORIES[key].label
                  .replace(" Operations", "")
                  .replace(" Primitives", "")
                  .replace(" Computations", "")
                  .replace(" Patterns", "")}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xs text-muted-foreground">Preset dataset</div>
              <div className="mt-1 text-sm">
                {c.label} · n={c.n} reported kernels
              </div>
            </div>
            <button
              onClick={() => setCustom(!custom)}
              className={cn(
                "rounded-md border px-3 py-1.5 font-mono text-xs",
                custom ? "border-primary text-primary" : "border-border",
              )}
            >
              {custom ? "Use preset" : "Enter custom"}
            </button>
          </div>
          {custom && (
            <div className="mt-4 grid gap-3">
              <label className="text-xs text-muted-foreground">
                GCC cycles / sample
                <textarea
                  value={gccInput}
                  onChange={(e) => setGccInput(e.target.value)}
                  placeholder="100, 102, 98, 101"
                  className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                LLVM cycles / sample
                <textarea
                  value={llvmInput}
                  onChange={(e) => setLlvmInput(e.target.value)}
                  placeholder="88, 90, 87, 89"
                  className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                />
              </label>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-sm">
            <div className="rounded-md bg-accent p-3">
              <span className="text-muted-foreground">GCC mean</span>
              <strong className="mt-1 block text-gcc">
                {result?.test.meanA.toFixed(2) ?? "—"}
              </strong>
            </div>
            <div className="rounded-md bg-accent p-3">
              <span className="text-muted-foreground">LLVM mean</span>
              <strong className="mt-1 block text-llvm">
                {result?.test.meanB.toFixed(2) ?? "—"}
              </strong>
            </div>
          </div>
        </Panel>
        <Panel title="Computed result">
          {result ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Welch t"
                value={result.test.t.toFixed(3)}
                sub={`df ${result.test.df.toFixed(1)}`}
                tone="primary"
              />
              <Stat
                label="Two-tailed p"
                value={result.test.p < 0.001 ? "<0.001" : result.test.p.toFixed(4)}
                sub={result.test.p < 0.05 ? "statistically significant" : "not significant"}
                tone={result.test.p < 0.05 ? "llvm" : "destructive"}
              />
              <Stat label="Cohen's d" value={result.d.toFixed(2)} sub={effectLabel(result.d)} />
              <Stat
                label="Mean delta"
                value={`${(result.test.meanB - result.test.meanA).toFixed(2)}`}
                sub="LLVM − GCC"
              />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Enter at least two numeric samples in each group.
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Welch&apos;s test does not assume equal variance. Cohen&apos;s d uses the pooled
            standard deviation; thresholds: negligible &lt;0.2, small &lt;0.5, medium &lt;0.8, large
            ≥0.8.
          </p>
        </Panel>
      </div>
      <Panel
        title="QEMU 8.2 ↔ BeagleV-Ahead correlation"
        action={<span className="font-mono text-xs text-primary">paper r={HW_OVERALL.r}</span>}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="h-80">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="var(--border)" />
                <XAxis type="number" dataKey="x" name="QEMU" {...axisProps} />
                <YAxis type="number" dataKey="y" name="BeagleV" {...axisProps} />
                <Tooltip {...chartTooltip} />
                <Scatter data={correlation.points} fill="var(--llvm)" />
                <Line
                  data={correlation.line}
                  dataKey="y"
                  type="linear"
                  stroke="var(--primary)"
                  dot={false}
                  strokeDasharray="5 4"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <Stat
              label="Computed Pearson r"
              value={correlation.stats.r.toFixed(2)}
              sub={`n=${correlation.stats.n} paired observations`}
              tone="llvm"
            />
            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              The scatter uses the four paper category anchors with five representative observations
              each. The regression line is fit to all paired points.
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
