import { useState } from "react";
import { Button } from "@/components/ui/button";
import { runBenchmark, type BenchmarkResult } from "@/lib/benchmark";
import { formatHashRate } from "@/lib/hash-utils";

export function BenchmarkPanel() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [running, setRunning] = useState(false);
  const cores = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 4) : 4;

  async function handleRun() {
    setRunning(true);
    setResults([]);
    const plan = [1, Math.max(2, Math.floor(cores / 2)), cores].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    );
    const collected: BenchmarkResult[] = [];
    for (const threads of plan) {
      const result = await runBenchmark(threads);
      collected.push(result);
      setResults([...collected]);
    }
    setRunning(false);
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-xs">Benchmark</h2>
        <Button size="sm" variant="secondary" onClick={handleRun} disabled={running}>
          {running ? "Measuring…" : "Run benchmark"}
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="label-xs">Logical cores</dt>
          <dd className="hash-text mt-1 text-foreground">{cores}</dd>
        </div>
        <div className="col-span-2">
          <dt className="label-xs">Engine</dt>
          <dd className="hash-text mt-1 text-foreground">Web Workers + JS SHA-256</dd>
        </div>
        <div>
          <dt className="label-xs">Encoding</dt>
          <dd className="hash-text mt-1 text-foreground">UTF-8</dd>
        </div>
      </dl>

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((r) => (
            <li
              key={r.threads}
              className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm"
            >
              <span className="hash-text text-muted-foreground">
                {r.threads} worker{r.threads > 1 ? "s" : ""}
              </span>
              <span className="hash-text text-primary">{formatHashRate(r.hashRate)}</span>
            </li>
          ))}
        </ul>
      )}
      {results.length === 0 && !running && (
        <p className="mt-4 text-sm text-muted-foreground">
          Measured live in your browser — no synthetic numbers.
        </p>
      )}
    </section>
  );
}
