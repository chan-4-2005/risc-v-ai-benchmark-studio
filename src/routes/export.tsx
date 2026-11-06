import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileCode2, Package, Search } from "lucide-react";
import JSZip from "jszip";
import { CodeBlock, PageHeader, Panel, downloadText } from "@/components/site";
import { BENCHMARKS, generateSource } from "@/lib/benchmarks";
import { analysisPy, categoriesCsv, dockerfile, makefile, readme } from "@/lib/export-files";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "Export Center — rvAIbench" },
      {
        name: "description",
        content: "Download the 85-kernel RISC-V benchmark reproduction kit and toolchain files.",
      },
    ],
  }),
  component: ExportPage,
});

const generated = [
  {
    id: "makefile",
    label: "Makefile",
    content: makefile(),
    filename: "Makefile",
    type: "text/plain",
  },
  {
    id: "dockerfile",
    label: "Dockerfile",
    content: dockerfile(),
    filename: "Dockerfile",
    type: "text/plain",
  },
  {
    id: "analysis",
    label: "analyze_results.py",
    content: analysisPy(),
    filename: "analyze_results.py",
    type: "text/x-python",
  },
  {
    id: "categories",
    label: "categories.csv",
    content: categoriesCsv(),
    filename: "categories.csv",
    type: "text/csv",
  },
  {
    id: "readme",
    label: "README.md",
    content: readme(),
    filename: "README.md",
    type: "text/markdown",
  },
] as const;

function ExportPage() {
  const [selected, setSelected] = useState("makefile");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const file = generated.find((item) => item.id === selected) ?? generated[0];
  const benchmarks = useMemo(
    () => BENCHMARKS.filter((b) => `${b.id} ${b.name}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const downloadBundle = async () => {
    const zip = new JSZip();
    zip.file("Makefile", makefile());
    zip.file("Dockerfile", dockerfile());
    zip.file("analyze_results.py", analysisPy());
    zip.file("categories.csv", categoriesCsv());
    zip.file("README.md", readme());
    for (const b of BENCHMARKS) zip.file(`src/${b.id}.c`, generateSource(b));
    downloadText(
      await zip.generateAsync({ type: "blob" }),
      "rvAIbench-reproduction-kit.zip",
      "application/zip",
    );
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Module 05" title="Code & Environment Export Center">
        Download the complete 85-microbenchmark reproduction kit, inspect generated files, or take a
        single C kernel into your own toolchain.
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <div className="font-mono text-2xl font-bold text-primary">85</div>
          <div className="text-xs text-muted-foreground">C microbenchmarks</div>
        </Panel>
        <Panel>
          <div className="font-mono text-2xl font-bold">4</div>
          <div className="text-xs text-muted-foreground">compiler configurations</div>
        </Panel>
        <button
          onClick={downloadBundle}
          className="rounded-lg border border-primary bg-primary/10 p-4 text-left hover:bg-primary/20"
        >
          <Package className="h-5 w-5 text-primary" />
          <div className="mt-2 font-semibold">Download full kit</div>
          <div className="text-xs text-muted-foreground">85 C files + environment</div>
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Panel title="Generated environment">
          <div className="space-y-1">
            {generated.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm",
                  selected === item.id ? "bg-accent text-primary" : "hover:bg-accent",
                )}
              >
                <FileCode2 className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
            Exact flags: <code>-O3 -march=rv64gc</code> and <code>-march=rv64gcv -mabi=lp64d</code>.
          </div>
        </Panel>
        <Panel
          title={file.filename}
          action={
            <button
              onClick={() => downloadText(file.content, file.filename, file.type)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-xs hover:bg-accent"
            >
              <Download className="h-3 w-3" /> download
            </button>
          }
        >
          <CodeBlock code={file.content} maxH="max-h-[560px]" />
        </Panel>
      </div>
      <Panel
        title="Individual benchmark C files"
        action={
          <span className="font-mono text-xs text-muted-foreground">
            {benchmarks.length}/85 shown
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search benchmark IDs"
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
            />
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs hover:bg-accent"
          >
            {showAll ? "Collapse list" : "Show all 85"}
          </button>
        </div>
        {(showAll || query) && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {benchmarks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2"
              >
                <span className="min-w-0 truncate font-mono text-xs">
                  {String(b.index).padStart(2, "0")} · {b.id}
                </span>
                <button
                  aria-label={`Download ${b.id}`}
                  onClick={() => downloadText(generateSource(b), `${b.id}.c`, "text/x-c")}
                  className="shrink-0 text-muted-foreground hover:text-primary"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
