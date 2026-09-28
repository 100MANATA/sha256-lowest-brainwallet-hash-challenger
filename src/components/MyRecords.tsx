import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRecordsByUsername } from "@/lib/leaderboard.functions";
import { shortHash } from "@/lib/hash-utils";
import { Badges } from "@/components/Badges";

export function MyRecords({ username }: { username: string }) {
  const fetchMine = useServerFn(getRecordsByUsername);
  const name = username.trim();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", "mine", name.toLowerCase()],
    queryFn: () => fetchMine({ data: { username: name } }),
    enabled: name.length > 0,
  });
  const rows = data ?? [];
  return (
    <section className="panel p-5">
      <h2 className="label-xs">My records — {name || "enter a miner name"}</h2>
      {name && isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      {name && !isLoading && rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">None yet — records submitted under this name appear here on every device.</p>
      )}
      <ul className="hash-text mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap gap-x-3 border-t border-border/60 pt-2">
            <span className="text-accent">
              {r.leading_zero_bits}b
              <Badges bits={r.leading_zero_bits} engine={r.engine} input={r.input} />
            </span>
            <span className="text-primary">{shortHash(r.hash, 16)}</span>
            <Link to="/verify" search={{ input: r.input }} className="max-w-48 truncate hover:text-primary">{r.input}</Link>
            <span className="text-muted-foreground">{r.created_at.slice(0, 10)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
