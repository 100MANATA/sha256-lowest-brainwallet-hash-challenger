import { useCallback, useEffect, useRef, useState } from "react";
import { compareHex, MAX_HASH_HEX } from "@/lib/hash-utils";
import {
  DEFAULT_CONFIG,
  type SearchConfig,
  type WorkerInbound,
  type WorkerOutbound,
} from "@/lib/miner-types";

export type MinerStatus = "idle" | "running" | "paused";

export interface FoundRecord {
  hash: string;
  input: string;
  bits: number;
  attempts: number;
  hashRate: number;
  at: number;
}

export interface MinerStats {
  hashes: number;
  elapsedMs: number;
  hashRate: number;
  threads: number;
}

const STORAGE_KEY = "sha256-challenge-best-v1";

function createWorker(): Worker {
  return new Worker(new URL("../workers/miner.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useMiner(onRecord?: (record: FoundRecord) => void) {
  const [status, setStatus] = useState<MinerStatus>("idle");
  const [stats, setStats] = useState<MinerStats>({
    hashes: 0,
    elapsedMs: 0,
    hashRate: 0,
    threads: 0,
  });
  const [best, setBest] = useState<FoundRecord | null>(null);
  const [history, setHistory] = useState<FoundRecord[]>([]);

  const workersRef = useRef<Worker[]>([]);
  const configRef = useRef<SearchConfig>(DEFAULT_CONFIG);
  const nextNonceRef = useRef(0);
  const hashesRef = useRef(0);
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  const bestHashRef = useRef(MAX_HASH_HEX);
  const recordCbRef = useRef(onRecord);
  recordCbRef.current = onRecord;

  // Restore the browser-local best on mount (client only).
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
  }, []);

  useEffect(() => terminateAll, [terminateAll]);

  // Live stats ticker.
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current);
      setStats((prev) => ({
        ...prev,
        hashes: hashesRef.current,
        elapsedMs: elapsed,
        hashRate: elapsed > 0 ? (hashesRef.current / elapsed) * 1000 : 0,
      }));
    }, 400);
    return () => window.clearInterval(id);
  }, [status]);

  const assignRange = useCallback((worker: Worker) => {
    const size = Math.max(1000, Math.min(configRef.current.batchSize, 5_000_000));
    const start = nextNonceRef.current;
    nextNonceRef.current = start + size;
    worker.postMessage({ type: "range", range: { start, end: start + size } } satisfies WorkerInbound);
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
      // New record candidate.
      if (compareHex(msg.hash, bestHashRef.current) >= 0) return;
      bestHashRef.current = msg.hash;
      const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current);
      const record: FoundRecord = {
        hash: msg.hash,
        input: msg.input,
        bits: msg.bits,
        attempts: hashesRef.current,
        hashRate: elapsed > 0 ? (hashesRef.current / elapsed) * 1000 : 0,
        at: Date.now(),
      };
      setBest(record);
      setHistory((prev) => [record, ...prev].slice(0, 40));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch {
        /* ignore */
      }
      recordCbRef.current?.(record);
      // Share the new best with every worker so they all raise the bar.
      for (const w of workersRef.current) {
        w.postMessage({ type: "best", hash: msg.hash } satisfies WorkerInbound);
      }
    },
    [assignRange],
  );

  const start = useCallback(
    (config: SearchConfig, threads: number) => {
      terminateAll();
      configRef.current = config;
      nextNonceRef.current = config.startNonce;
      hashesRef.current = 0;
      accumulatedRef.current = 0;
      startedAtRef.current = Date.now();
      setStats({ hashes: 0, elapsedMs: 0, hashRate: 0, threads });

      const count = Math.max(1, Math.min(threads, 32));
      for (let i = 0; i < count; i++) {
        const worker = createWorker();
        worker.onmessage = (event: MessageEvent<WorkerOutbound>) =>
          handleMessage(worker, event.data);
        worker.postMessage({
          type: "config",
          config,
          best: bestHashRef.current,
        } satisfies WorkerInbound);
        workersRef.current.push(worker);
      }
      setStatus("running");
    },
    [handleMessage, terminateAll],
  );

  const pause = useCallback(() => {
    if (status !== "running") return;
    for (const w of workersRef.current) {
      w.postMessage({ type: "stop" } satisfies WorkerInbound);
    }
    accumulatedRef.current += Date.now() - startedAtRef.current;
    setStatus("paused");
  }, [status]);

  const resume = useCallback(() => {
    if (status !== "paused") return;
    startedAtRef.current = Date.now();
    for (const w of workersRef.current) {
      w.postMessage({
        type: "config",
        config: configRef.current,
        best: bestHashRef.current,
      } satisfies WorkerInbound);
    }
    setStatus("running");
  }, [status]);

  const stop = useCallback(() => {
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

  return { status, stats, best, history, start, pause, resume, stop, resetBest };
}
