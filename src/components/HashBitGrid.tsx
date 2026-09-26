import { useEffect, useState } from "react";
import { hashBitGrid, hashBitRows } from "@/lib/hash-utils";

export function HashBitGrid({ hash }: { hash: string | null }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!hash) return;
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 950);
    return () => window.clearTimeout(id);
  }, [hash]);

  const grid = hashBitGrid(hash ?? "0".repeat(64));
  const rows = hashBitRows(hash ?? "0".repeat(64));

  return (
    <div className="space-y-4">
      <div
        className={`panel mx-auto grid w-fit grid-cols-16 gap-[3px] p-3 ${pulse ? "animate-record-pulse" : ""}`}
        style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
        aria-label="256-bit hash visualisation"
      >
        {grid.flat().map((bit, i) => (
          <span
            key={i}
            className={`size-[11px] rounded-[2px] transition-colors sm:size-[14px] ${
              bit ? "bg-grid-on shadow-glow" : "bg-grid-off"
            }`}
          />
        ))}
      </div>
      <pre className="hash-text overflow-x-auto text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
        {rows.join("\n")}
      </pre>
    </div>
  );
}
