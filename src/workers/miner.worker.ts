/// <reference lib="webworker" />
import { sha256Bytes, bytesToHex } from "@/lib/sha256";
import { compareHash, hexToBytes, leadingZeroBits } from "@/lib/hash-utils";
import {
  buildInput,
  DYNAMIC_ALNUM,
  DYNAMIC_SYMBOLS,
  WORD_SEPARATORS,
  type SearchConfig,
  type WorkerInbound,
  type WorkerOutbound,
} from "@/lib/miner-types";
import { BIP39_WORDS } from "@/lib/bip39-words";

const CHUNK = 20_000;
const encoder = new TextEncoder();
const digest = new Uint8Array(32);

let config: SearchConfig | null = null;
let best = hexToBytes("f".repeat(64));
let running = false;
let range: { start: number; end: number } | null = null;
let cursor = 0;
let pendingHashes = 0;

/** Optional vanity target: full bytes plus an optional trailing high nibble. */
let vanity: { bytes: Uint8Array; nibble: number | null } | null = null;

function setVanity(hex: string) {
  const clean = hex.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 12);
  if (!clean) {
    vanity = null;
    return;
  }
  const pairs = clean.length >> 1;
  const bytes = hexToBytes(clean.slice(0, pairs * 2));
  const nibble = clean.length % 2 === 1 ? parseInt(clean[clean.length - 1]!, 16) : null;
  vanity = { bytes, nibble };
}

function matchVanity(d: Uint8Array): boolean {
  const v = vanity!;
  for (let i = 0; i < v.bytes.length; i++) {
    if (d[i] !== v.bytes[i]) return false;
  }
  if (v.nibble !== null && (d[v.bytes.length]! >> 4) !== v.nibble) return false;
  return true;
}

const randomBuf = new Uint32Array(64);
let randomIdx = randomBuf.length;

function randomUint(): number {
  if (randomIdx >= randomBuf.length) {
    crypto.getRandomValues(randomBuf);
    randomIdx = 0;
  }
  return randomBuf[randomIdx++]!;
}

function randomNonce(charset: string, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += charset.charAt(randomUint() % charset.length);
  }
  return s;
}

function post(msg: WorkerOutbound) {
  self.postMessage(msg);
}

function nextInput(index: number): string {
  const cfg = config!;
  if (cfg.mode === "sequential") return buildInput(cfg, String(index));
  if (cfg.mode === "words") {
    const lo = Math.max(1, Math.min(cfg.minWords, cfg.maxWords));
    const hi = Math.max(lo, Math.min(20, cfg.maxWords));
    const count = lo + (randomUint() % (hi - lo + 1));
    const sep = WORD_SEPARATORS[cfg.wordSeparator] ?? " ";
    let phrase = BIP39_WORDS[randomUint() % BIP39_WORDS.length]!;
    for (let w = 1; w < count; w++) {
      phrase += sep + BIP39_WORDS[randomUint() % BIP39_WORDS.length]!;
    }
    return buildInput(cfg, phrase);
  }
  if (cfg.mode === "dynamic") {
    const alphabet = cfg.includeSymbols ? DYNAMIC_ALNUM + DYNAMIC_SYMBOLS : DYNAMIC_ALNUM;
    const lo = Math.max(1, Math.min(cfg.minLength, cfg.maxLength));
    const hi = Math.max(lo, Math.min(128, cfg.maxLength));
    const len = lo + (randomUint() % (hi - lo + 1));
    return buildInput(cfg, randomNonce(alphabet, len));
  }
  const charset = cfg.charset.length > 0 ? cfg.charset : "0123456789abcdef";
  return buildInput(cfg, randomNonce(charset, Math.max(1, cfg.nonceLength)));
}

function runChunk() {
  if (!running || !config || !range) return;

  const limit = Math.min(cursor + CHUNK, range.end);
  for (let i = cursor; i < limit; i++) {
    const input = nextInput(i);
    sha256Bytes(encoder.encode(input), digest);
    if (vanity && matchVanity(digest)) {
      post({ type: "vanity", input, hash: bytesToHex(digest) });
    }
    if (compareHash(digest, best) < 0) {
      best = digest.slice();
      post({
        type: "record",
        input,
        hash: bytesToHex(best),
        bits: leadingZeroBits(best),
      });
    }
  }
  pendingHashes += limit - cursor;
  cursor = limit;

  post({ type: "progress", hashes: pendingHashes });
  pendingHashes = 0;

  if (cursor >= range.end) {
    range = null;
    post({ type: "idle" });
    return;
  }
  // Yield to the event loop so incoming messages (stop / new best) are handled.
  setTimeout(runChunk, 0);
}

self.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;
  switch (msg.type) {
    case "config":
      config = msg.config;
      setVanity(msg.config.vanityHex ?? "");
      best = hexToBytes(msg.best);
      running = true;
      post({ type: "idle" });
      break;
    case "best": {
      const candidate = hexToBytes(msg.hash);
      if (compareHash(candidate, best) < 0) best = candidate;
      break;
    }
    case "range":
      if (!config) return;
      range = msg.range;
      cursor = msg.range.start;
      running = true;
      runChunk();
      break;
    case "stop":
      running = false;
      range = null;
      break;
  }
};
