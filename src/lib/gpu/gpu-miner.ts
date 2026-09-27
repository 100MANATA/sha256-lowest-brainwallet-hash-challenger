/// <reference types="@webgpu/types" />
import { BIP39_WORDS } from "@/lib/bip39-words";
import {
  DYNAMIC_ALNUM,
  DYNAMIC_SYMBOLS,
  WORD_SEPARATORS,
  type SearchConfig,
} from "@/lib/miner-types";
import {
  CHARSET_MAX,
  CHARSET_OFF,
  DATA_LEN,
  DIGITS_OFF,
  PREFIX_MAX,
  PREFIX_OFF,
  SHA256_WGSL,
  SLOT_WORDS,
  SUFFIX_MAX,
  SUFFIX_OFF,
} from "./shader";

const RESULT_CAP = 64;
const RESULT_BYTES = 4 + RESULT_CAP * SLOT_WORDS * 4;
const MAX_DISPATCH = 65535 * 64;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type Gpu = { requestAdapter(opts?: unknown): Promise<GPUAdapter | null> };

function gpuApi(): Gpu | null {
  if (typeof navigator === "undefined") return null;
  return ((navigator as unknown as { gpu?: Gpu }).gpu ?? null);
}

let availability: Promise<boolean> | null = null;
/** True when the browser exposes WebGPU and a real adapter exists. */
export function isWebGpuAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      const gpu = gpuApi();
      if (!gpu) return false;
      try {
        return (await gpu.requestAdapter({ powerPreference: "high-performance" })) !== null;
      } catch {
        return false;
      }
    })();
  }
  return availability;
}

function wordsBuffer(): Uint32Array {
  const bytes = BIP39_WORDS.map((w) => encoder.encode(w));
  const total = bytes.reduce((s, b) => s + b.length, 0);
  const out = new Uint32Array(BIP39_WORDS.length + 1 + total);
  let off = 0;
  bytes.forEach((b, i) => {
    out[i] = off;
    for (let k = 0; k < b.length; k++) out[BIP39_WORDS.length + 1 + off + k] = b[k]!;
    off += b.length;
  });
  out[BIP39_WORDS.length] = off;
  return out;
}

function asciiOnly(s: string): string {
  let out = "";
  for (const ch of s) if (ch.charCodeAt(0) < 128) out += ch;
  return out;
}

function hexToWords(hex: string): Uint32Array {
  const out = new Uint32Array(8);
  for (let i = 0; i < 8; i++) out[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16) >>> 0;
  return out;
}

export interface GpuRunHandlers {
  /** Reserve `count` sequential nonces; returns the first. */
  allocate: (count: number) => number;
  onProgress: (hashes: number) => void;
  onCandidate: (input: string) => void;
}

export class GpuMiner {
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private size = 1 << 16;
  private config: SearchConfig | null = null;
  private data = new Uint32Array(DATA_LEN);
  private params = new Uint32Array(16);

  private constructor(
    private device: GPUDevice,
    private pipeline: GPUComputePipeline,
    private paramBuf: GPUBuffer,
    private dataBuf: GPUBuffer,
    private bestBuf: GPUBuffer,
    private resultBuf: GPUBuffer,
    private readBuf: GPUBuffer,
    private bindGroup: GPUBindGroup,
    public readonly adapterName: string,
  ) {}

  static async create(): Promise<GpuMiner | null> {
    const gpu = gpuApi();
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" }).catch(() => null);
    if (!adapter) return null;
    const device = await adapter.requestDevice().catch(() => null);
    if (!device) return null;

    const module = device.createShaderModule({ code: SHA256_WGSL });
    const info = await module.getCompilationInfo();
    if (info.messages.some((m) => m.type === "error")) {
      console.error("GPU shader error", info.messages);
      return null;
    }
    const pipeline = await device.createComputePipelineAsync({
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });

    const words = wordsBuffer();
    const S = GPUBufferUsage;
    const paramBuf = device.createBuffer({ size: 64, usage: S.UNIFORM | S.COPY_DST });
    const dataBuf = device.createBuffer({ size: DATA_LEN * 4, usage: S.STORAGE | S.COPY_DST });
    const wordBuf = device.createBuffer({ size: words.byteLength, usage: S.STORAGE | S.COPY_DST });
    const bestBuf = device.createBuffer({ size: 32, usage: S.STORAGE | S.COPY_DST });
    const resultBuf = device.createBuffer({
      size: RESULT_BYTES,
      usage: S.STORAGE | S.COPY_SRC | S.COPY_DST,
    });
    const readBuf = device.createBuffer({ size: RESULT_BYTES, usage: S.MAP_READ | S.COPY_DST });
    device.queue.writeBuffer(wordBuf, 0, words);

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramBuf } },
        { binding: 1, resource: { buffer: dataBuf } },
        { binding: 2, resource: { buffer: wordBuf } },
        { binding: 3, resource: { buffer: bestBuf } },
        { binding: 4, resource: { buffer: resultBuf } },
      ],
    });
    const name =
      (adapter as unknown as { info?: { description?: string; vendor?: string } }).info?.description ||
      (adapter as unknown as { info?: { vendor?: string } }).info?.vendor ||
      "WebGPU";
    return new GpuMiner(device, pipeline, paramBuf, dataBuf, bestBuf, resultBuf, readBuf, bindGroup, name);
  }

  configure(config: SearchConfig) {
    this.config = config;
    const d = this.data;
    d.fill(0);
    const prefix = encoder.encode(config.prefix).slice(0, PREFIX_MAX);
    const suffix = encoder.encode(config.suffix).slice(0, SUFFIX_MAX);
    d.set(prefix, PREFIX_OFF);
    d.set(suffix, SUFFIX_OFF);

    let mode = 0;
    let charset = "";
    let minLen = 1;
    let maxLen = 1;
    if (config.mode === "dynamic") {
      mode = 1;
      charset = config.includeSymbols ? DYNAMIC_ALNUM + DYNAMIC_SYMBOLS : DYNAMIC_ALNUM;
      minLen = Math.max(1, Math.min(config.minLength, config.maxLength));
      maxLen = Math.max(minLen, Math.min(128, config.maxLength));
    } else if (config.mode === "random" || config.mode === "custom") {
      mode = 1;
      charset = asciiOnly(config.charset) || "0123456789abcdef";
      minLen = maxLen = Math.max(1, config.nonceLength);
    } else if (config.mode === "words") {
      mode = 2;
    }
    const cs = encoder.encode(charset).slice(0, CHARSET_MAX);
    d.set(cs, CHARSET_OFF);

    const lo = Math.max(1, Math.min(config.minWords, config.maxWords));
    const hi = Math.max(lo, Math.min(20, config.maxWords));
    const sep = encoder.encode(WORD_SEPARATORS[config.wordSeparator] ?? " ");

    const p = this.params;
    p.fill(0);
    p[0] = mode;
    p[1] = prefix.length;
    p[2] = config.mode === "sequential" ? 0 : suffix.length;
    p[3] = cs.length;
    p[4] = minLen;
    p[5] = maxLen;
    p[6] = lo;
    p[7] = hi;
    p[8] = sep.length > 0 ? 1 : 0;
    p[9] = sep[0] ?? 0;
    p[12] = RESULT_CAP;
    p[13] = BIP39_WORDS.length;
  }

  setBest(hex: string) {
    this.device.queue.writeBuffer(this.bestBuf, 0, hexToWords(hex));
  }

  start(handlers: GpuRunHandlers) {
    if (this.running || !this.config) return;
    this.running = true;
    this.loopPromise = this.loop(handlers);
  }

  async stop() {
    this.running = false;
    await this.loopPromise?.catch(() => undefined);
    this.loopPromise = null;
  }

  destroy() {
    this.running = false;
    this.device.destroy();
  }

  private async loop(h: GpuRunHandlers) {
    const seedBuf = new Uint32Array(1);
    const zero = new Uint32Array(1);
    while (this.running) {
      const t0 = performance.now();
      const count = this.size;
      crypto.getRandomValues(seedBuf);
      this.params[10] = seedBuf[0]!;
      if (this.config!.mode === "sequential") {
        const digits = String(h.allocate(count));
        this.params[11] = digits.length;
        for (let i = 0; i < digits.length; i++) this.data[DIGITS_OFF + i] = digits.charCodeAt(i) - 48;
      }
      const q = this.device.queue;
      q.writeBuffer(this.paramBuf, 0, this.params);
      q.writeBuffer(this.dataBuf, 0, this.data);
      q.writeBuffer(this.resultBuf, 0, zero);

      const enc = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.dispatchWorkgroups(Math.ceil(count / 64));
      pass.end();
      enc.copyBufferToBuffer(this.resultBuf, 0, this.readBuf, 0, RESULT_BYTES);
      q.submit([enc.finish()]);

      await this.readBuf.mapAsync(GPUMapMode.READ);
      const out = new Uint32Array(this.readBuf.getMappedRange().slice(0));
      this.readBuf.unmap();

      h.onProgress(Math.ceil(count / 64) * 64);
      const found = Math.min(out[0]!, RESULT_CAP);
      for (let s = 0; s < found; s++) {
        const base = 1 + s * SLOT_WORDS;
        const len = out[base]!;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = (out[base + 1 + (i >> 2)]! >>> (24 - 8 * (i & 3))) & 0xff;
        h.onCandidate(decoder.decode(bytes));
      }

      const dt = performance.now() - t0;
      if (dt < 60 && this.size < MAX_DISPATCH) this.size = Math.min(MAX_DISPATCH, this.size * 2);
      else if (dt > 160 && this.size > 4096) this.size = Math.floor(this.size / 2);
    }
  }
}

/** Measure real GPU throughput for `durationMs`. */
export async function runGpuBenchmark(config: SearchConfig, durationMs = 2500) {
  const miner = await GpuMiner.create();
  if (!miner) return null;
  miner.configure({ ...config, mode: "sequential", prefix: "benchmark:" });
  miner.setBest("0".repeat(64));
  let hashes = 0;
  let nonce = 0;
  const t0 = performance.now();
  miner.start({
    allocate: (n) => {
      const s = nonce;
      nonce += n;
      return s;
    },
    onProgress: (n) => (hashes += n),
    onCandidate: () => undefined,
  });
  await new Promise((r) => setTimeout(r, durationMs));
  await miner.stop();
  const elapsed = performance.now() - t0;
  miner.destroy();
  return { hashRate: (hashes / elapsed) * 1000, name: miner.adapterName };
}
