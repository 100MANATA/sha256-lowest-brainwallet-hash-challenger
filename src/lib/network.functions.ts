import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const heartbeatSchema = z.object({
  sessionId: z.string().min(8).max(64),
  username: z.string().trim().min(1).max(32).default("Anonymous"),
  hashRate: z.number().min(0).max(1e15),
  engine: z.enum(["cpu", "gpu", "both"]).optional(),
});

export interface NetworkStats {
  totalHashRate: number;
  activeMiners: number;
  cpuHashRate: number;
  gpuHashRate: number;
}

/** Miners report their current hash rate every ~15s while searching. */
export const reportHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => heartbeatSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("heartbeats").upsert(
      {
        session_id: data.sessionId,
        username: data.username,
        hash_rate: data.hashRate,
        engine: data.engine ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Aggregate the hash rate of miners seen in the last 60 seconds. */
export const getNetworkStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<NetworkStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("heartbeats")
      .select("hash_rate, engine")
      .gte("updated_at", since)
      .limit(1000);
    if (error) throw new Error(error.message);

    let totalHashRate = 0;
    let cpuHashRate = 0;
    let gpuHashRate = 0;
    for (const row of rows ?? []) {
      totalHashRate += row.hash_rate;
      if (row.engine === "gpu") gpuHashRate += row.hash_rate;
      else cpuHashRate += row.hash_rate;
    }

    // Best-effort cleanup of stale rows; failures are harmless.
    void supabaseAdmin
      .from("heartbeats")
      .delete()
      .lt("updated_at", new Date(Date.now() - 10 * 60_000).toISOString())
      .then(() => undefined);

    return { totalHashRate, activeMiners: rows?.length ?? 0, cpuHashRate, gpuHashRate };
  },
);
