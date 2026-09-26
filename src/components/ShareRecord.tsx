import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  hash: string;
  input: string;
  bits: number;
  username: string;
  at: number;
}

function verifyUrl(input: string) {
  return `${window.location.origin}/verify?input=${encodeURIComponent(input)}`;
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawCard(p: Props): string {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const g = c.getContext("2d")!;
  const bg = cssVar("--background", "#05080a");
  const primary = cssVar("--primary", "#39ff88");
  const accent = cssVar("--accent", "#00e5ff");
  const fg = cssVar("--foreground", "#e6f1ef");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1200, 630);
  g.strokeStyle = primary;
  g.lineWidth = 4;
  g.strokeRect(24, 24, 1152, 582);
  const mono = "'JetBrains Mono', monospace";
  g.fillStyle = accent;
  g.font = `500 26px ${mono}`;
  g.fillText("sha256 lowest brainwallet hash challenger", 64, 90);
  g.fillStyle = primary;
  g.font = `700 72px ${mono}`;
  g.fillText(`${p.bits} leading zero bits`, 64, 190);
  g.font = `500 28px ${mono}`;
  g.fillText(p.hash.slice(0, 32), 64, 280);
  g.fillText(p.hash.slice(32), 64, 320);
  g.fillStyle = fg;
  g.font = `400 26px ${mono}`;
  const input = p.input.length > 60 ? p.input.slice(0, 57) + "…" : p.input;
  g.fillText(`input: ${input}`, 64, 400);
  g.fillText(`miner: ${p.username}`, 64, 450);
  g.fillText(`date:  ${new Date(p.at).toISOString().slice(0, 10)}`, 64, 500);
  g.fillStyle = accent;
  g.font = `400 20px ${mono}`;
  g.fillText("verify: SHA256(input) — anyone can check it", 64, 570);
  return c.toDataURL("image/png");
}

export function ShareRecord(props: Props) {
  const text = `I found a SHA-256 hash with ${props.bits} leading zero bits! Verify it:`;

  function open(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const url = () => verifyUrl(props.input);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        className="hash-text"
        onClick={() => {
          const a = document.createElement("a");
          a.href = drawCard(props);
          a.download = `sha256-record-${props.bits}bits.png`;
          a.click();
        }}
      >
        Download card
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="hash-text"
        onClick={() =>
          open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`)
        }
      >
        X
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="hash-text"
        onClick={() => open(`https://t.me/share/url?url=${encodeURIComponent(url())}&text=${encodeURIComponent(text)}`)}
      >
        Telegram
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="hash-text"
        onClick={() =>
          open(`https://www.reddit.com/submit?url=${encodeURIComponent(url())}&title=${encodeURIComponent(text)}`)
        }
      >
        Reddit
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="hash-text"
        onClick={async () => {
          await navigator.clipboard.writeText(url());
          toast.success("Verify link copied");
        }}
      >
        Copy link
      </Button>
    </div>
  );
}
