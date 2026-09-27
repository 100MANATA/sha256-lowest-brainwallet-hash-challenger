# How it works: explainer section on the dashboard

## Current state (verified)
- `src/routes/index.tsx` has: header with a one-line tagline, "Current world record" panel, search grid, leaderboard, and a footer with the technical winner rule. There is no section that explains to a newcomer what is actually being hashed or why it is hard.

## Change

Add a "How it works" panel in `src/routes/index.tsx`, placed between the header and the "Current world record" panel so it is the first thing a new visitor reads.

Content — plain English, 4 short numbered points, styled with the existing panel/label classes (no new components or files):

1. **Pick an input** — any text: a word, a passphrase, random characters, or dictionary words. The search modes in the panel below (words, random, dynamic) generate these for you.
2. **SHA-256 turns it into a 256-bit number** — every unique input produces a fixed 256-digit binary fingerprint that is unpredictable: change one letter and the whole hash changes.
3. **Goal: the smallest hash** — the winner is the input whose SHA-256 value, read as an unsigned 256-bit integer, is lower than anyone else's. In practice you hunt for hashes starting with the most zeros — each extra zero bit is twice as hard.
4. **Verified, not trusted** — your browser does the hashing (CPU + GPU). When you find a good one it is submitted and the server re-computes the hash before it can appear on the leaderboard.

Keep the section compact (roughly 3–4 lines on desktop) so it does not push the world record panel out of view.

## Verification
- Playwright: the dashboard renders the new section between the header and the world-record panel; text is readable at mobile width (375px).
