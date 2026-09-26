const MUTE_KEY = "sha256-sound-muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;

function ping() {
  if (isMuted()) return;
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* audio unavailable */
  }
}

let lastCelebration = 0;

/** Confetti + ping for a new personal best (throttled so early rapid records don't spam). */
export async function celebrate(big = false) {
  const now = Date.now();
  if (now - lastCelebration < 1500) return;
  lastCelebration = now;
  ping();
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#39ff88", "#00e5ff", "#ffffff"];
  confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 65, origin: { y: 0.3 }, colors, disableForReducedMotion: true });
}
