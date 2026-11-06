import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Check, Copy, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/benchmarks", label: "Suite" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/assembly", label: "Assembly" },
  { to: "/statistics", label: "Statistics" },
  { to: "/export", label: "Export" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-mono text-sm font-semibold">
          <Cpu className="h-5 w-5 text-primary" />
          <span>rv<span className="text-primary">AI</span>bench</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden font-mono text-[11px] text-muted-foreground md:block">
          GCC 15.1.0 · LLVM 21.1.5 · RVV 1.0 · VLEN=256
        </div>
      </div>
    </header>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      <div className="font-mono text-xs uppercase tracking-widest text-primary">{eyebrow}</div>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-3xl text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "gcc" | "llvm" | "primary" | "destructive" }) {
  const toneCls = { gcc: "text-gcc", llvm: "text-llvm", primary: "text-primary", destructive: "text-destructive" }[tone ?? "primary"];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-3xl font-bold", toneCls)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function CodeBlock({ code, className, maxH = "max-h-[520px]" }: { code: string; className?: string; maxH?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("relative rounded-md border border-border bg-code", className)}>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="absolute right-2 top-2 rounded border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className={cn("overflow-auto p-4 font-mono text-xs leading-relaxed", maxH)}>{code}</pre>
    </div>
  );
}

export function downloadText(content: string | Blob, filename: string, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const chartTooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontFamily: "JetBrains Mono" },
  labelStyle: { color: "var(--foreground)" },
  itemStyle: { color: "var(--foreground)" },
};
export const axisProps = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false };
