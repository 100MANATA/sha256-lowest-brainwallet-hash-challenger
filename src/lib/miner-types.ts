export type SearchMode = "sequential" | "random" | "custom";

export type ChallengeMode = "global" | "daily" | "fixed-prefix" | "custom";

export interface SearchConfig {
  mode: SearchMode;
  /** Prefix prepended to every generated input. */
  prefix: string;
  /** Suffix appended to every generated input (custom mode). */
  suffix: string;
  /** Character set used for random/custom nonces. */
  charset: string;
  /** Length of the generated nonce for random/custom modes. */
  nonceLength: number;
  /** First nonce for sequential mode. */
  startNonce: number;
  /** Nonces handed to a worker per assignment. */
  batchSize: number;
}

export interface WorkerRange {
  start: number;
  end: number;
}

export type WorkerInbound =
  | { type: "config"; config: SearchConfig; best: string }
  | { type: "range"; range: WorkerRange }
  | { type: "best"; hash: string }
  | { type: "stop" };

export type WorkerOutbound =
  | { type: "idle" }
  | { type: "progress"; hashes: number }
  | { type: "record"; input: string; hash: string; bits: number };

export const DEFAULT_CONFIG: SearchConfig = {
  mode: "sequential",
  prefix: "bitcoin:",
  suffix: "",
  charset: "0123456789abcdef",
  nonceLength: 16,
  startNonce: 0,
  batchSize: 1_000_000,
};

/**
 * Canonical input construction. Every participant must build inputs exactly
 * this way, UTF-8 encoded, so global results are comparable.
 */
export function buildInput(config: SearchConfig, nonce: string): string {
  if (config.mode === "sequential") return `${config.prefix}${nonce}`;
  return `${config.prefix}${nonce}${config.suffix}`;
}

/** Generate a random prefix of the given length using the default charset. */
export function randomPrefix(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out + ":";
}

export const CHALLENGES: Record<ChallengeMode, { label: string; description: string }> = {
  global: {
    label: "Global Record",
    description: "Lowest 256-bit hash of all time wins.",
  },
  daily: {
    label: "Daily Challenge",
    description: "A fresh leaderboard starts every UTC day.",
  },
  "fixed-prefix": {
    label: "Fixed Prefix",
    description: "Everyone searches SHA256(\"BTC:\" + nonce).",
  },
  custom: {
    label: "Custom Challenge",
    description: "Your own prefix, personal space.",
  },
};

export function challengeId(mode: ChallengeMode, prefix: string): string {
  switch (mode) {
    case "global":
      return "global-v1";
    case "daily":
      return `daily-${new Date().toISOString().slice(0, 10)}`;
    case "fixed-prefix":
      return "fixed-prefix-BTC:";
    case "custom":
      return `custom-${prefix}`;
  }
}
