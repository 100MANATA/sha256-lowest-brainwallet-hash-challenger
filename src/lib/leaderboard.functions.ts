import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/sha256";
import { leadingZeroBitsHex } from "@/lib/hash-utils";

export interface LeaderboardRow {
  id: string;
  challenge_id: string;
  hash: string;
  input: string;
  leading_zero_bits: number;
  attempts: number;
  hash_rate: number;
  username: string;
  created_at: string;
  user_id: string | null;
}

const submitSchema = z.object({
  challengeId: z.string().min(1).max(64),
  input: z.string().min(1).max(512),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  attempts: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  hashRate: z.number().min(0).max(1e12),
  username: z.string().trim().min(1).max(32).default("Anonymous"),
});

const listSchema = z.object({
  challengeId: z.string().min(1).max(64),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Server-side verification: the server recomputes SHA-256 of the submitted
 * input (UTF-8) and only accepts the row when it matches the claimed hash.
 * A client can never publish a hash it did not actually find.
 */
export const submitRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const computed = sha256Hex(data.input);
    if (computed !== data.hash) {
      return { accepted: false as const, reason: "hash_mismatch" };
    }

    const bits = leadingZeroBitsHex(computed);
    // Spam guard: only meaningful results are stored publicly.
    if (bits < 16) {
      return { accepted: false as const, reason: "below_threshold" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Optional account link: a valid bearer token ties the record to the signed-in miner.
    let userId: string | null = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const auth = getRequest()?.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (token.split(".").length === 3) {
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        userId = u.user?.id ?? null;
      }
    } catch {
      userId = null;
    }

    // Atomic check-and-store: only insert when it beats the current best for
    // this challenge, and let the unique index settle simultaneous winners.
    const { data: current, error: readError } = await supabaseAdmin
      .from("records")
      .select("hash")
      .eq("challenge_id", data.challengeId)
      .order("hash", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (current && current.hash <= computed) {
      return { accepted: false as const, reason: "not_a_record" };
    }

    const { error } = await supabaseAdmin.from("records").insert({
      challenge_id: data.challengeId,
      input: data.input,
      hash: computed,
      leading_zero_bits: bits,
      attempts: data.attempts,
      hash_rate: data.hashRate,
      username: data.username,
      verified: true,
      user_id: userId,
    });

    if (error && error.code !== "23505") throw new Error(error.message);
    return { accepted: true as const, bits };
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listSchema.parse(data))
  .handler(async ({ data }): Promise<LeaderboardRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("records")
      .select("id, challenge_id, hash, input, leading_zero_bits, attempts, hash_rate, username, created_at, user_id")
      .eq("challenge_id", data.challengeId)
      .order("hash", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as LeaderboardRow[];
  });

export const getGlobalStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: bestRows, error: bestError }, { count, error: countError }] = await Promise.all([
    supabaseAdmin
      .from("records")
      .select("hash, leading_zero_bits, username, attempts, hash_rate, created_at")
      .order("hash", { ascending: true })
      .limit(1),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }),
  ]);

  if (bestError) throw new Error(bestError.message);
  if (countError) throw new Error(countError.message);

  return {
    best: bestRows?.[0] ?? null,
    totalRecords: count ?? 0,
  };
});

const COLS = "id, challenge_id, hash, input, leading_zero_bits, attempts, hash_rate, username, created_at, user_id";

export const getMyRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeaderboardRow[]> => {
    const { data, error } = await context.supabase
      .from("records")
      .select(COLS)
      .eq("user_id", context.userId)
      .order("hash", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as LeaderboardRow[];
  });

export const getRecordByHash = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ hash: z.string().regex(/^[0-9a-f]{64}$/) }).parse(data))
  .handler(async ({ data }): Promise<LeaderboardRow | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("records")
      .select(COLS)
      .eq("hash", data.hash)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as LeaderboardRow | null) ?? null;
  });
