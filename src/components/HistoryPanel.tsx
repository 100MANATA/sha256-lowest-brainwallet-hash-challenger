import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FoundRecord } from "@/hooks/useMiner";
import { shortHash } from "@/lib/hash-utils";

export function HistoryPanel({ history }: { history: FoundRecord[] }) {
  const chartData = [...history]
    .reverse()
    .map((r, i) => ({ index: i + 1, bits: r.bits, time: new Date(r.at).toLocaleTimeString() }));

  return (
    <section className="panel p-5">
      <h2 className="label-xs">Hash history</h2>

      {history.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Personal records appear here as your search improves.
        </p>
      ) : (
        <>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="index"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(v) => `Record #${v}`}
                />
                <Line
                  type="stepAfter"
                  dataKey="bits"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "var(--color-primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="label-xs">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Hash</th>
                  <th className="py-2">Bits</th>
                </tr>
              </thead>
              <tbody className="hash-text">
                {history.slice(0, 12).map((r) => (
                  <tr key={r.hash} className="border-t border-border/60">
                    <td className="py-2 pr-3 text-muted-foreground">
                      {new Date(r.at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-3 text-primary">{shortHash(r.hash, 20)}</td>
                    <td className="py-2 text-accent">{r.bits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
