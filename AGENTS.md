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
- Records link to accounts via nullable `records.user_id`, set only server-side in `submitRecord` from a verified bearer token; anonymous mining stays allowed.
