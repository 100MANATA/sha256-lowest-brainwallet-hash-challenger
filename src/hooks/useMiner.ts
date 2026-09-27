import { useCallback, useEffect, useRef, useState } from "react";
import { compareHex, leadingZeroBits, MAX_HASH_HEX } from "@/lib/hash-utils";
import { bytesToHex, sha256Bytes } from "@/lib/sha256";
import { GpuMiner } from "@/lib/gpu/gpu-miner";
import {
  DEFAULT_CONFIG,
  type SearchConfig,
  type WorkerInbound,
  type WorkerOutbound,
} from "@/lib/miner-types";

export type MinerStatus = "idle" | "running" | "paused";
export type Engine = "cpu" | "gpu" | "both";

export interface FoundRecord {
  hash: string;
  input: string;
  bits: number;
  attempts: number;
  hashRate: number;
  at: number;
  engine?: "cpu" | "gpu";
}

export interface MinerStats {
  hashes: number;
  elapsedMs: number;
  hashRate: number;
  threads: number;
  cpuHashRate: number;
  gpuHashRate: number;
  gpuActive: boolean;
}

const STORAGE_KEY = "sha256-challenge-best-v1";
const encoder = new TextEncoder();

function createWorker(): Worker {
  return new Worker(new URL("../workers/miner.worker.ts", import.meta.url), {
    type: "module",
  });
}

const EMPTY: MinerStats = {
  hashes: 0,
  elapsedMs: 0,
  hashRate: 0,
  threads: 0,
  cpuHashRate: 0,
  gpuHashRate: 0,
  gpuActive: false,
};

export function useMiner(onRecord?: (record: FoundRecord) => void) {
  const [status, setStatus] = useState<MinerStatus>("idle");
  const [stats, setStats] = useState<MinerStats>(EMPTY);
  const [best, setBest] = useState<FoundRecord | null>(null);
  const [history, setHistory] = useState<FoundRecord[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sha256-history");
      if (saved) setHistory(JSON.parse(saved) as FoundRecord[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);
  useEffect(() => {
    if (history.length) localStorage.setItem("sha256-history", JSON.stringify(history.slice(0, 50)));
  }, [history]);
  const [gpuError, setGpuError] = useState<string | null>(null);

  const workersRef = useRef<Worker[]>([]);
  const gpuRef = useRef<GpuMiner | null>(null);
  const gpuEnabledRef = useRef(false);
  const configRef = useRef<SearchConfig>(DEFAULT_CONFIG);
  const nextNonceRef = useRef(0);
  const hashesRef = useRef(0);
  const gpuHashesRef = useRef(0);
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  const bestHashRef = useRef(MAX_HASH_HEX);
  const recordCbRef = useRef(onRecord);
  recordCbRef.current = onRecord;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FoundRecord;
      if (parsed?.hash?.length === 64) {
        bestHashRef.current = parsed.hash;
        setBest(parsed);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const terminateAll = useCallback(() => {
    for (const w of workersRef.current) {
      w.postMessage({ type: "stop" } satisfies WorkerInbound);
      w.terminate();
    }
    workersRef.current = [];
    const gpu = gpuRef.current;
    gpuRef.current = null;
    if (gpu) void gpu.stop().then(() => gpu.destroy());
  }, []);

  useEffect(() => terminateAll, [terminateAll]);

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current);
      const total = hashesRef.current;
      const gpuH = gpuHashesRef.current;
      setStats((prev) => ({
        ...prev,
        hashes: total,
        elapsedMs: elapsed,
        hashRate: elapsed > 0 ? (total / elapsed) * 1000 : 0,
        gpuHashRate: elapsed > 0 ? (gpuH / elapsed) * 1000 : 0,
        cpuHashRate: elapsed > 0 ? ((total - gpuH) / elapsed) * 1000 : 0,
        gpuActive: gpuRef.current !== null,
      }));
    }, 400);
    return () => window.clearInterval(id);
  }, [status]);

  const allocate = useCallback((count: number) => {
    const start = nextNonceRef.current;
    nextNonceRef.current = start + count;
    return start;
  }, []);

  const assignRange = useCallback(
    (worker: Worker) => {
      const size = Math.max(1000, Math.min(configRef.current.batchSize, 5_000_000));
      const start = allocate(size);
      worker.postMessage({ type: "range", range: { start, end: start + size } } satisfies WorkerInbound);
    },
    [allocate],
  );

  const acceptRecord = useCallback((hash: string, input: string, bits: number, engine: "cpu" | "gpu") => {
    if (compareHex(hash, bestHashRef.current) >= 0) return;
    bestHashRef.current = hash;
    const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current);
    const record: FoundRecord = {
      hash,
      input,
      bits,
      attempts: hashesRef.current,
      hashRate: elapsed > 0 ? (hashesRef.current / elapsed) * 1000 : 0,
      at: Date.now(),
      engine,
    };
    setBest(record);
    setHistory((prev) => [record, ...prev].slice(0, 40));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* ignore */
    }
    recordCbRef.current?.(record);
    for (const w of workersRef.current) {
      w.postMessage({ type: "best", hash } satisfies WorkerInbound);
    }
    gpuRef.current?.setBest(hash);
  }, []);

  const handleMessage = useCallback(
    (worker: Worker, msg: WorkerOutbound) => {
      if (msg.type === "progress") {
        hashesRef.current += msg.hashes;
        return;
      }
      if (msg.type === "idle") {
        assignRange(worker);
        return;
      }
      acceptRecord(msg.hash, msg.input, msg.bits, "cpu");
    },
    [assignRange, acceptRecord],
  );

  // GPU candidates are re-hashed in JS so a shader bug can never create a fake record.
  const handleGpuCandidate = useCallback(
    (input: string) => {
      const digest = new Uint8Array(32);
      sha256Bytes(encoder.encode(input), digest);
      acceptRecord(bytesToHex(digest), input, leadingZeroBits(digest), "gpu");
    },
    [acceptRecord],
  );

  const startGpu = useCallback(() => {
    const gpu = gpuRef.current;
    if (!gpu) return;
    gpu.configure(configRef.current);
    gpu.setBest(bestHashRef.current);
    gpu.start({
      allocate,
      onProgress: (n) => {
        hashesRef.current += n;
        gpuHashesRef.current += n;
      },
      onCandidate: handleGpuCandidate,
    });
  }, [allocate, handleGpuCandidate]);

  const start = useCallback(
    (config: SearchConfig, threads: number, engine: Engine = "cpu") => {
      terminateAll();
      configRef.current = config;
      nextNonceRef.current = config.startNonce;
      hashesRef.current = 0;
      gpuHashesRef.current = 0;
      accumulatedRef.current = 0;
      startedAtRef.current = Date.now();
      setGpuError(null);

      const useCpu = engine !== "gpu";
      const count = useCpu ? Math.max(1, Math.min(threads, 32)) : 0;
      setStats({ ...EMPTY, threads: count });

      for (let i = 0; i < count; i++) {
        const worker = createWorker();
        worker.onmessage = (event: MessageEvent<WorkerOutbound>) => handleMessage(worker, event.data);
        worker.postMessage({ type: "config", config, best: bestHashRef.current } satisfies WorkerInbound);
        workersRef.current.push(worker);
      }

      gpuEnabledRef.current = engine !== "cpu";
      if (gpuEnabledRef.current) {
        void GpuMiner.create().then((gpu) => {
          if (!gpu) {
            setGpuError("Your browser doesn't support WebGPU");
            return;
          }
          if (!gpuEnabledRef.current) {
            gpu.destroy();
            return;
          }
          gpuRef.current = gpu;
          startGpu();
        });
      }
      setStatus("running");
    },
    [handleMessage, terminateAll, startGpu],
  );

  const pause = useCallback(() => {
    if (status !== "running") return;
    for (const w of workersRef.current) w.postMessage({ type: "stop" } satisfies WorkerInbound);
    void gpuRef.current?.stop();
    accumulatedRef.current += Date.now() - startedAtRef.current;
    setStatus("paused");
  }, [status]);

  const resume = useCallback(() => {
    if (status !== "paused") return;
    startedAtRef.current = Date.now();
    for (const w of workersRef.current) {
      w.postMessage({ type: "config", config: configRef.current, best: bestHashRef.current } satisfies WorkerInbound);
    }
    startGpu();
    setStatus("running");
  }, [status, startGpu]);

  const stop = useCallback(() => {
    gpuEnabledRef.current = false;
    terminateAll();
    accumulatedRef.current += startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    setStatus("idle");
  }, [terminateAll]);

  const resetBest = useCallback(() => {
    bestHashRef.current = MAX_HASH_HEX;
    setBest(null);
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { status, stats, best, history, gpuError, start, pause, resume, stop, resetBest };
}
