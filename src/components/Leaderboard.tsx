import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getLeaderboard } from "@/lib/leaderboard.functions";
import { formatHashRate, formatNumber, shortHash } from "@/lib/hash-utils";
import { Badges } from "@/components/Badges";

export function Leaderboard({ challengeId }: { challengeId: string }) {
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", challengeId],
    queryFn: () => fetchLeaderboard({ data: { challengeId, limit: 10 } }),
    refetchOnWindowFocus: false,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`records-${challengeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "records" }, () => {
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
        queryClient.invalidateQueries({ queryKey: ["global-stats"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [challengeId, queryClient]);

  const rows = data ?? [];
  const top = rows[0];

  // Flash a banner the moment somebody takes over the top spot.
  const seenTop = useRef<string | null>(null);
  const [flash, setFlash] = useState<{ username: string; bits: number } | null>(null);
  useEffect(() => {
    if (!top) return undefined;
    if (seenTop.current && seenTop.current !== top.hash) {
      setFlash({ username: top.username, bits: top.leading_zero_bits });
      seenTop.current = top.hash;
      const t = window.setTimeout(() => setFlash(null), 12_000);
      return () => window.clearTimeout(t);
    }
    seenTop.current = top.hash;
    return undefined;
  }, [top]);

  async function shareRow(row: (typeof rows)[number]) {
    const text = `⚡ ${row.username} found a SHA-256 hash with ${row.leading_zero_bits} leading zero bits!\n\ninput: ${row.input}\nhash: ${row.hash}\n\nThink you can go lower? Mine in your browser 👇\nhttps://sha256.world`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied — paste it in your X post");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="label-xs">Global leaderboard</h2>
        <span className="label-xs">{challengeId}</span>
      </div>

      {flash && (
        <div className="animate-fade-in pulse mt-4 rounded-md border border-primary/60 bg-primary/10 px-4 py-3 text-sm text-primary">
          ⚡ New world record — {flash.username} just found {flash.bits} leading zero bits!
        </div>
      )}

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading records…</p>}

      {!isLoading && rows.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No verified records yet. Start searching — the first one could be yours.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="label-xs">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Input</th>
                <th className="py-2 pr-3">Hash</th>
                <th className="py-2 pr-3">Bits</th>
                <th className="py-2 pr-3">Attempts</th>
                <th className="py-2 pr-3">Rate</th>
                <th className="py-2 pr-3">Miner</th>
                <th className="py-2">Date</th>
                <th className="py-2 pl-3 text-right">Post</th>
              </tr>
            </thead>
            <tbody className="hash-text">
              {rows.map((row, i) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="max-w-40 truncate py-2 pr-3 text-foreground" title={row.input}>
                    <Link to="/verify" search={{ input: row.input }} className="hover:text-primary">
                      {row.input}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-primary">{shortHash(row.hash, 22)}</td>
                  <td className="py-2 pr-3 text-accent">{row.leading_zero_bits}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatNumber(row.attempts)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatHashRate(row.hash_rate)}</td>
                  <td className="py-2 pr-3">
                    {row.username}
                    <Badges bits={row.leading_zero_bits} engine={row.engine} input={row.input} />
                    {row.engine && (
                      <span className="ml-1 rounded bg-surface-2 px-1 text-[10px] uppercase text-muted-foreground">
                        {row.engine}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(row.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <button
                      type="button"
                      aria-label={`Copy X post for ${row.username}'s record`}
                      title="Copy ready X post"
                      className="rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      onClick={() => void shareRow(row)}
                    >
                      𝕏
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="label-xs mt-3">All entries verified server-side ✓</p>
        </div>
      )}
    </section>
  );
}
