import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRecords } from "@/lib/leaderboard.functions";
import { shortHash } from "@/lib/hash-utils";

export function MyRecords() {
  const fetchMine = useServerFn(getMyRecords);
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard", "mine"], queryFn: () => fetchMine() });
  const rows = data ?? [];
  return (
    <section className="panel p-5">
      <h2 className="label-xs">My verified records (synced to your account)</h2>
      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">None yet — records you set while signed in appear here on every device.</p>
      )}
      <ul className="hash-text mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap gap-x-3 border-t border-border/60 pt-2">
            <span className="text-accent">{r.leading_zero_bits}b</span>
            <span className="text-primary">{shortHash(r.hash, 16)}</span>
            <Link to="/verify" search={{ input: r.input }} className="max-w-48 truncate hover:text-primary">{r.input}</Link>
            <span className="text-muted-foreground">{r.created_at.slice(0, 10)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
