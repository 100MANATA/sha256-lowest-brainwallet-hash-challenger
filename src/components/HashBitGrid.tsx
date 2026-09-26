import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { hashBitGrid, hashBitRows } from "@/lib/hash-utils";

export function HashBitGrid({ hash }: { hash: string | null }) {
  const [pulse, setPulse] = useState(false);
  const [zoom, setZoom] = useState(false);

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
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-fit">
          <DialogTitle className="label-xs">256-bit hash pattern</DialogTitle>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
            {grid.flat().map((bit, i) => (
              <span key={i} className={`size-[4.5vw] max-h-6 max-w-6 rounded-[2px] ${bit ? "bg-grid-on shadow-glow" : "bg-grid-off"}`} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <div
        role="button"
        tabIndex={0}
        title="Tap to enlarge"
        onClick={() => setZoom(true)}
        onKeyDown={(e) => e.key === "Enter" && setZoom(true)}
        className={`panel mx-auto grid cursor-zoom-in w-fit grid-cols-16 gap-[3px] p-3 ${pulse ? "animate-record-pulse" : ""}`}
        style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
        aria-label="256-bit hash visualisation"
      >
        {grid.flat().map((bit, i) => (
          <span
            key={i}
            className={`size-[14px] rounded-[2px] transition-colors sm:size-[16px] ${
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
