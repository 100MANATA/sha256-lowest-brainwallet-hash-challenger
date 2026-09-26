/** Utilities for comparing and describing 256-bit SHA-256 digests. */

/** Compares two 32-byte digests as unsigned 256-bit integers. */
export function compareHash(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < 32; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  }
  return 0;
}

/** Compares two 64-char lowercase hex digests as unsigned 256-bit integers. */
export function compareHex(a: string, b: string): number {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Exact count of leading zero bits in a 32-byte digest. */
export function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    if (byte === 0) {
      bits += 8;
      continue;
    }
    let mask = 0x80;
    while (mask && (byte & mask) === 0) {
      bits++;
      mask >>= 1;
    }
    break;
  }
  return bits;
}

export function leadingZeroBitsHex(hex: string): number {
  return leadingZeroBits(hexToBytes(hex));
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Full 256-bit value as a BigInt (for exact comparisons / display). */
export function hexToBigInt(hex: string): bigint {
  return BigInt("0x" + hex);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Hash rate in hashes/second -> "4.82 MH/s" */
export function formatHashRate(hps: number): string {
  if (!isFinite(hps) || hps <= 0) return "0 H/s";
  const units = ["H/s", "kH/s", "MH/s", "GH/s"];
  let i = 0;
  let v = hps;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Expected attempts for N leading zero bits: 2^N in human form. */
export function expectedWork(bits: number): string {
  if (bits <= 0) return "1";
  const exact = 2 ** bits;
  const exponent = Math.floor(bits * Math.LOG10E * Math.LN2);
  const mantissa = exact / 10 ** exponent;
  if (bits < 14) return formatNumber(exact);
  return `${mantissa.toFixed(2)} × 10^${exponent}`;
}

export function shortHash(hex: string, head = 24): string {
  return hex.length > head ? `${hex.slice(0, head)}…` : hex;
}

/** 16x16 grid of the 256 bits, row-major (MSB first). */
export function hashBitGrid(hex: string): number[][] {
  const bytes = hexToBytes(hex);
  const rows: number[][] = [];
  for (let r = 0; r < 16; r++) {
    const row: number[] = [];
    for (let c = 0; c < 16; c++) {
      const bitIndex = r * 16 + c;
      const byte = bytes[bitIndex >> 3] ?? 0;
      row.push((byte >> (7 - (bitIndex & 7))) & 1);
    }
    rows.push(row);
  }
  return rows;
}

/** Binary rows of 32 bits each, for the text representation. */
export function hashBitRows(hex: string): string[] {
  const bytes = hexToBytes(hex);
  const rows: string[] = [];
  for (let i = 0; i < 32; i += 4) {
    rows.push(
      Array.from(bytes.slice(i, i + 4))
        .map((b) => b.toString(2).padStart(8, "0"))
        .join(" "),
    );
  }
  return rows;
}

export const MAX_HASH_HEX = "f".repeat(64);
