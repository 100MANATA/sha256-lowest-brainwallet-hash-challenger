# Global leaderboard: live refresh + top 10 only

## Current state (verified)
- `src/components/Leaderboard.tsx` already subscribes to database changes on the `records` table and re-fetches when a new record is inserted — live updates exist today.
- Database realtime is enabled for `public.records` (confirmed by querying the realtime publication), so the live channel is active.
- The query currently requests `limit: 20`, so the table shows 20 rows.

## Changes

1. **Top 10 only** — in `src/components/Leaderboard.tsx`, change the fetch from `limit: 20` to `limit: 10`. The server function already accepts any limit up to 100, so no backend change is needed.

2. **Guaranteed refresh** — add a periodic refresh (every 15 seconds) to the leaderboard query as a fallback alongside the existing realtime channel, so the table stays current even if a realtime event is missed (e.g. flaky mobile connection). The realtime subscription stays in place for instant updates.

## Verification
- Playwright check of the dashboard: leaderboard renders at most 10 rows.
- Confirm the table updates when a new record is submitted (realtime path) without reloading.
