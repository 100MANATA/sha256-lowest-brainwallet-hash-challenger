<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Bulk hashing uses the synchronous JS SHA-256 in `src/lib/sha256.ts` inside Web
  Workers (`src/workers/miner.worker.ts`); Web Crypto is async and too slow for
  millions of hashes per second.
- Winners are decided by the full 256-bit digest compared as an unsigned integer
  (`compareHash`/`compareHex` in `src/lib/hash-utils.ts`); leading zero bits are a
  display metric only.
- Leaderboard writes go only through `submitRecord` in
  `src/lib/leaderboard.functions.ts`, which re-hashes the input server-side before
  inserting with the admin client; the `records` table grants no client inserts so
  forged hashes cannot be published.
- No sign-in: miners are identified only by display name; `records.user_id` is legacy (no longer written). One competition only, challenge_id `global-v1`.
- GPU search uses a WebGPU WGSL shader (`src/lib/gpu/`) that returns candidate inputs only; every candidate is re-hashed with JS SHA-256 before it counts, so shader bugs can't produce fake records.
- Vanity pattern hits are a side channel: CPU workers post them as a separate `vanity`
  message and they never enter the record race, so the lowest-hash rule stays intact.
- Badge labels are derived, not stored: `src/lib/badges.ts` computes them from a record's
  bits/engine/input, so no schema change is needed to add or retune a badge.
