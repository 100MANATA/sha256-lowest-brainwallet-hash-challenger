import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HashBitGrid } from "@/components/HashBitGrid";
import { sha256Hex } from "@/lib/sha256";
import { leadingZeroBitsHex, formatNumber } from "@/lib/hash-utils";
import { getRecordByHash } from "@/lib/leaderboard.functions";

export const Route = createFileRoute("/verify")({
  validateSearch: (s) => z.object({ input: z.string().max(512).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Verify a SHA-256 record — sha256 lowest brainwallet hash challenger" },
      { name: "description", content: "Recompute SHA-256 of any input live in your browser and check it against the verified leaderboard." },
      { property: "og:title", content: "Verify a SHA-256 record" },
      { property: "og:description", content: "One click: recompute the hash and confirm the leading zero bits yourself." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { input } = Route.useSearch();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(input ?? "");
  const hash = input ? sha256Hex(input) : null;
  const bits = hash ? leadingZeroBitsHex(hash) : 0;
  const lookup = useServerFn(getRecordByHash);
  const { data: record, isLoading } = useQuery({
    queryKey: ["verify", hash],
    queryFn: () => lookup({ data: { hash: hash! } }),
    enabled: !!hash,
  });

  return (
    <main className="grid-lines min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Link to="/" className="label-xs hover:text-primary">← back to the challenge</Link>
        <h1 className="mt-4 text-2xl font-bold lowercase sm:text-4xl">verify a <span className="text-primary">sha-256</span> record</h1>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/verify", search: { input: draft } });
          }}
        >
          <Input className="hash-text" value={draft} maxLength={512} onChange={(e) => setDraft(e.target.value)} placeholder="input string" />
          <Button type="submit" className="hash-text">Verify</Button>
        </form>

        {hash && (
          <section className="panel mt-6 space-y-3 p-5">
            <p className="label-xs">SHA256(input) — computed now in your browser</p>
            <p className="hash-text break-all text-primary">{hash}</p>
            <p className="hash-text text-sm text-accent">{bits} leading zero bits · difficulty ≈ 2^{bits}</p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Checking leaderboard…</p>
            ) : record ? (
              <p className="text-sm">
                ✓ Verified leaderboard record by <span className="text-primary">{record.username}</span> on{" "}
                {record.created_at.slice(0, 10)} · {formatNumber(record.attempts)} attempts · {record.challenge_id}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">This hash is valid but is not on the leaderboard.</p>
            )}
            <HashBitGrid hash={hash} />
          </section>
        )}
      </div>
    </main>
  );
}
