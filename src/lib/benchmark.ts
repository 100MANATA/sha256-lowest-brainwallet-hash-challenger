import type { WorkerInbound, WorkerOutbound } from "@/lib/miner-types";
import { DEFAULT_CONFIG } from "@/lib/miner-types";

export interface BenchmarkResult {
  threads: number;
  hashRate: number;
}

/**
 * Real measurement: spins up `threads` workers hashing for `durationMs`
 * and reports the aggregate rate. No synthetic numbers.
 */
export async function runBenchmark(threads: number, durationMs = 2500): Promise<BenchmarkResult> {
  const workers: Worker[] = [];
  let hashes = 0;
  let nonce = 0;

  const config = { ...DEFAULT_CONFIG, mode: "sequential" as const, prefix: "benchmark:" };

  for (let i = 0; i < threads; i++) {
    const worker = new Worker(new URL("../workers/miner.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
      const msg = event.data;
      if (msg.type === "progress") hashes += msg.hashes;
      if (msg.type === "idle") {
        const start = nonce;
        nonce += 500_000;
        worker.postMessage({
          type: "range",
          range: { start, end: start + 500_000 },
        } satisfies WorkerInbound);
      }
    };
    worker.postMessage({ type: "config", config, best: "f".repeat(64) } satisfies WorkerInbound);
    workers.push(worker);
  }

  const started = performance.now();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  const elapsed = performance.now() - started;

  for (const worker of workers) {
    worker.postMessage({ type: "stop" } satisfies WorkerInbound);
    worker.terminate();
  }

  return { threads, hashRate: (hashes / elapsed) * 1000 };
}
