# Move Words-mode fields to the front of the search panel

## Goal
When the **Words** mode is selected in the search panel, its controls should appear at the very top of the settings grid so they are immediately visible, instead of appearing after the Prefix field and the other mode-specific blocks.

## Change
`src/components/SearchPanel.tsx` only — no logic changes:

- Move the `{config.mode === "words" && (...)}` block (Min words, Max words, Separator buttons) from its current position (after Dynamic's block) to the first position inside the `grid gap-4 sm:grid-cols-2` settings grid — before the Prefix field and all other conditional blocks.
- Everything else stays exactly as is: Prefix, Starting nonce, Nonce length, Dynamic's length/alphabet controls, Custom's suffix/charset, Batch size, Threads, and the Start/Stop buttons keep their current order and behavior.

## Verification
- Typecheck and build pass.
- Check in the preview: select **Words** — Min words / Max words / Separator appear first in the grid; other modes still show their own fields in the previous order.
