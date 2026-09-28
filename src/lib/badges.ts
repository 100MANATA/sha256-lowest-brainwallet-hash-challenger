import { BIP39_WORDS } from "@/lib/bip39-words";

export interface Badge {
  icon: string;
  label: string;
}

const WORDSET = new Set(BIP39_WORDS);
const TIERS = [40, 36, 32, 28, 24];

/** Achievement badges shown next to a record. */
export function recordBadges(opts: { bits: number; engine?: string | null | undefined; input: string }): Badge[] {
  const out: Badge[] = [];
  if (opts.engine === "gpu") out.push({ icon: "⚡", label: "GPU miner" });
  const parts = opts.input.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => WORDSET.has(p.toLowerCase()))) {
    out.push({ icon: "📖", label: "Wordsmith" });
  }
  const tier = TIERS.find((t) => opts.bits >= t);
  if (tier) out.push({ icon: "🎯", label: `Zero hunter ${tier}` });
  return out;
}
