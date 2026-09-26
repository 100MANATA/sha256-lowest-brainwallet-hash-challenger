import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchPanel } from "@/components/SearchPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { HashBitGrid } from "@/components/HashBitGrid";
import { HistoryPanel } from "@/components/HistoryPanel";
import { BenchmarkPanel } from "@/components/BenchmarkPanel";
import { useMiner, type FoundRecord } from "@/hooks/useMiner";
import { getGlobalStats, submitRecord } from "@/lib/leaderboard.functions";
import {
  expectedWork,
  formatDuration,
  formatHashRate,
  formatNumber,
  leadingZeroBitsHex,
} from "@/lib/hash-utils";
import { CHALLENGES, challengeId, type ChallengeMode } from "@/lib/miner-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHA256 Lowest Hash Challenge — Find the smallest SHA-256 hash" },
      {
        name: "description",
        content:
          "A public SHA-256 competition. Search billions of inputs in your browser with Web Workers and claim the lowest 256-bit hash ever found.",
      },
      { property: "og:title", content: "SHA256 Lowest Hash Challenge" },
      {
        property: "og:description",
        content:
          "Search billions of inputs. Find the smallest SHA-256 hash. Server-verified global leaderboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className={`hash-text mt-1 text-sm ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Dashboard() {
  const [mode, setMode] = useState<ChallengeMode>("global");
  const [username, setUsername] = useState("Anonymous");
  const [challenge, setChallenge] = useState(() => challengeId("global", ""));
  const queryClient = useQueryClient();

  const fetchStats = useServerFn(getGlobalStats);
  const submit = useServerFn(submitRecord);

  useEffect(() => {
    const saved = localStorage.getItem("sha256-username");
    if (saved) setUsername(saved);
  }, []);

  useEffect(() => {
    setChallenge(challengeId(mode, "custom"));
  }, [mode]);

  const onRecord = useCallback(
    async (record: FoundRecord) => {
      if (record.bits < 16) return;
      try {
        const result = await submit({
          data: {
            challengeId: challenge,
            input: record.input,
            hash: record.hash,
            attempts: record.attempts,
            hashRate: record.hashRate,
            username: username.trim() || "Anonymous",
          },
        });
        if (result.accepted) {
          toast.success(`New world record — ${result.bits} leading zero bits`);
          queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
          queryClient.invalidateQueries({ queryKey: ["global-stats"] });
        }
      } catch {
        /* submission failures must never interrupt the local search */
      }
    },
    [challenge, queryClient, submit, username],
  );

  const miner = useMiner(onRecord);

  const { data: stats } = useQuery({
    queryKey: ["global-stats"],
    queryFn: () => fetchStats({}),
    refetchInterval: 15_000,
  });

  const worldBest = stats?.best ?? null;
  const worldBits = worldBest ? leadingZeroBitsHex(worldBest.hash) : 0;
  const displayHash = miner.best?.hash ?? worldBest?.hash ?? null;

  function handleUsername(value: string) {
    setUsername(value);
    localStorage.setItem("sha256-username", value.slice(0, 32));
  }

  return (
    <main className="grid-lines min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="text-center">
          <p className="label-xs">SHA-256 · 256-bit unsigned integer race</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            SHA256 <span className="text-primary">LOWEST BRAINWALLET HASH</span> CHALLENGER
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Search billions of inputs. Find the smallest SHA-256 hash.
          </p>
        </header>

        <section className="panel mt-8 p-5 sm:p-7">
          <p className="label-xs">Current world record</p>
          <p className="hash-text mt-3 text-base text-primary sm:text-2xl">
            {worldBest?.hash ?? "—".repeat(3)}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Leading zero bits" value={worldBest ? String(worldBits) : "0"} accent />
            <Stat label="Expected attempts" value={worldBest ? `2^${worldBits} ≈ ${expectedWork(worldBits)}` : "—"} />
            <Stat label="Found by" value={worldBest?.username ?? "Nobody yet"} />
            <Stat label="Verified records" value={formatNumber(stats?.totalRecords ?? 0)} />
          </dl>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div className="w-full max-w-56">
              <Label className="label-xs" htmlFor="username">
                Miner name
              </Label>
              <Input
                id="username"
                className="hash-text mt-2"
                maxLength={32}
                value={username}
                onChange={(e) => handleUsername(e.target.value)}
              />
            </div>
            <Button
              size="lg"
              className="hash-text"
              onClick={() =>
                document.getElementById("search")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              Start search
            </Button>
          </div>
        </section>

        <section className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(CHALLENGES) as ChallengeMode[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={mode === key ? "default" : "secondary"}
              className="hash-text"
              onClick={() => setMode(key)}
              title={CHALLENGES[key].description}
            >
              {CHALLENGES[key].label}
            </Button>
          ))}
        </section>

        <div id="search" className="mt-6 grid gap-6 lg:grid-cols-2">
          <SearchPanel
            status={miner.status}
            onStart={miner.start}
            onPause={miner.pause}
            onResume={miner.resume}
            onStop={miner.stop}
          />

          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="label-xs">Your search</h2>
              <span className="hash-text text-xs text-accent uppercase">{miner.status}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <Stat label="Hash rate" value={formatHashRate(miner.stats.hashRate)} accent />
              <Stat label="Attempts" value={formatNumber(miner.stats.hashes)} />
              <Stat label="Elapsed" value={formatDuration(miner.stats.elapsedMs)} />
              <Stat label="Workers" value={String(miner.stats.threads)} />
            </dl>

            <div className="mt-5 space-y-2">
              <p className="label-xs">Your best</p>
              <p className="hash-text text-sm break-all text-primary">{miner.best?.hash ?? "not found yet"}</p>
              {miner.best && (
                <>
                  <p className="hash-text text-xs text-muted-foreground">input: {miner.best.input}</p>
                  <p className="hash-text text-xs text-accent">
                    {miner.best.bits} leading zero bits · difficulty ≈ 2^{miner.best.bits}
                  </p>
                </>
              )}
            </div>
            <Button variant="secondary" size="sm" className="hash-text mt-4" onClick={miner.resetBest}>
              Reset local best
            </Button>
          </section>
        </div>

        <section className="panel mt-6 p-5">
          <h2 className="label-xs">256-bit hash pattern</h2>
          <div className="mt-4">
            <HashBitGrid hash={displayHash} />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <HistoryPanel history={miner.history} />
          <BenchmarkPanel />
        </div>

        <div className="mt-6">
          <Leaderboard challengeId={challenge} />
        </div>

        <footer className="mt-10 space-y-1 text-center">
          <p className="label-xs">
            Winner rule: uint256(hash_A) &lt; uint256(hash_B) — leading zeros are a secondary metric
          </p>
          <p className="label-xs">
            input = UTF-8 string · hash = SHA256(input) · every submission re-hashed on the server
          </p>
        </footer>
      </div>
    </main>
  );
}
