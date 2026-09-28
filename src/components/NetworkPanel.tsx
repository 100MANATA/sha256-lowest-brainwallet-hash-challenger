import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNetworkStats } from "@/lib/network.functions";
import { formatHashRate } from "@/lib/hash-utils";

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className={`hash-text mt-1 text-sm ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function NetworkPanel({ myHashRate }: { myHashRate: number }) {
  const fetchStats = useServerFn(getNetworkStats);
  const { data } = useQuery({
    queryKey: ["network-stats"],
    queryFn: () => fetchStats({}),
    refetchInterval: 15_000,
  });

  const share =
    data && data.totalHashRate > 0 && myHashRate > 0
      ? (myHashRate / data.totalHashRate) * 100
      : null;

  return (
    <section className="panel mt-6 p-5 sm:p-7" aria-label="Network hashrate">
      <h2 className="label-xs">Network hashrate</h2>
      <p className="hash-text mt-3 text-2xl text-primary sm:text-3xl">
        {data ? formatHashRate(data.totalHashRate) : "—"}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Active miners" value={data ? String(data.activeMiners) : "—"} accent />
        <Stat label="CPU power" value={data ? formatHashRate(data.cpuHashRate) : "—"} />
        <Stat label="GPU power" value={data ? formatHashRate(data.gpuHashRate) : "—"} />
        <Stat
          label="Your share"
          value={share !== null ? `${share < 0.1 ? "<0.1" : share.toFixed(1)}%` : "—"}
        />
      </dl>
      <p className="label-xs mt-4">Combined speed of everyone searching right now · updates every 15s</p>
    </section>
  );
}
