import { recordBadges } from "@/lib/badges";

export function Badges({
  bits,
  engine,
  input,
}: {
  bits: number;
  engine?: string | null;
  input: string;
}) {
  const badges = recordBadges({ bits, engine, input });
  if (badges.length === 0) return null;
  return (
    <span className="ml-1 inline-flex gap-1 align-middle">
      {badges.map((b) => (
        <span key={b.label} title={b.label} aria-label={b.label} className="text-xs">
          {b.icon}
        </span>
      ))}
    </span>
  );
}
