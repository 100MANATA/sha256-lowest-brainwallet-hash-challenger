import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_CONFIG,
  randomPrefix,
  randomStartNonce,
  type SearchConfig,
  type SearchMode,
  type WordSeparator,
} from "@/lib/miner-types";
import type { MinerStatus } from "@/hooks/useMiner";

const MODES: { value: SearchMode; label: string }[] = [
  { value: "sequential", label: "Sequential" },
  { value: "random", label: "Random" },
  { value: "dynamic", label: "Dynamic" },
  { value: "words", label: "Words" },
  { value: "custom", label: "Custom" },
];

const SEPARATORS: { value: WordSeparator; label: string }[] = [
  { value: "space", label: "Space" },
  { value: "dash", label: "Dash" },
  { value: "none", label: "Joined" },
];

interface Props {
  status: MinerStatus;
  onStart: (config: SearchConfig, threads: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function SearchPanel({ status, onStart, onPause, onResume, onStop }: Props) {
  const [config, setConfig] = useState<SearchConfig>(DEFAULT_CONFIG);
  const [threads, setThreads] = useState(() =>
    typeof navigator !== "undefined"
      ? Math.min(/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 2 : 4, navigator.hardwareConcurrency ?? 4)
      : 4,
  );

  const set = <K extends keyof SearchConfig>(key: K, value: SearchConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="panel p-5">
      <h2 className="label-xs">Search engine</h2>

      <div className="mt-4 space-y-4">
        <div>
          <Label className="label-xs">Mode</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                key={m.value}
                type="button"
                size="sm"
                variant={config.mode === m.value ? "default" : "secondary"}
                className="hash-text"
                onClick={() =>
                  // Dynamic mode searches the whole input space, so it drops the fixed prefix.
                  setConfig((prev) => ({
                    ...prev,
                    mode: m.value,
                    prefix: m.value === "dynamic" || m.value === "words" ? "" : prev.prefix,
                  }))
                }
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="label-xs" htmlFor="prefix">
              Prefix
            </Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="prefix"
                className="hash-text"
                value={config.prefix}
                onChange={(e) => set("prefix", e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="hash-text shrink-0"
                disabled={status === "running"}
                onClick={() => set("prefix", randomPrefix())}
                title="Generate a random prefix"
              >
                Random
              </Button>
            </div>
          </div>

          {config.mode === "sequential" && (
            <div>
              <Label className="label-xs" htmlFor="nonce">
                Starting nonce
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="nonce"
                  className="hash-text"
                  type="number"
                  min={0}
                  value={config.startNonce}
                  onChange={(e) => set("startNonce", Math.max(0, Number(e.target.value) || 0))}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="hash-text shrink-0"
                  disabled={status === "running"}
                  onClick={() => set("startNonce", randomStartNonce())}
                  title="Pick a random starting point"
                >
                  Random
                </Button>
              </div>
            </div>
          )}

          {(config.mode === "random" || config.mode === "custom") && (
            <div>
              <Label className="label-xs" htmlFor="length">
                Nonce length
              </Label>
              <Input
                id="length"
                className="hash-text mt-2"
                type="number"
                min={1}
                max={64}
                value={config.nonceLength}
                onChange={(e) => set("nonceLength", Math.min(64, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
          )}

          {config.mode === "dynamic" && (
            <>
              <div>
                <Label className="label-xs" htmlFor="minlen">
                  Min length
                </Label>
                <Input
                  id="minlen"
                  className="hash-text mt-2"
                  type="number"
                  min={1}
                  max={128}
                  value={config.minLength}
                  onChange={(e) => set("minLength", Math.min(128, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <Label className="label-xs" htmlFor="maxlen">
                  Max length
                </Label>
                <Input
                  id="maxlen"
                  className="hash-text mt-2"
                  type="number"
                  min={1}
                  max={128}
                  value={config.maxLength}
                  onChange={(e) => set("maxLength", Math.min(128, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="label-xs">Alphabet</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={config.includeSymbols ? "default" : "secondary"}
                    className="hash-text"
                    onClick={() => set("includeSymbols", true)}
                  >
                    Letters + digits + symbols
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={config.includeSymbols ? "secondary" : "default"}
                    className="hash-text"
                    onClick={() => set("includeSymbols", false)}
                  >
                    Letters + digits
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Every attempt uses a fresh random string with a random length between min and max.
                </p>
              </div>
            </>
          )}

          {config.mode === "words" && (
            <>
              <div>
                <Label className="label-xs" htmlFor="minwords">
                  Min words
                </Label>
                <Input
                  id="minwords"
                  className="hash-text mt-2"
                  type="number"
                  min={1}
                  max={20}
                  value={config.minWords}
                  onChange={(e) => set("minWords", Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <Label className="label-xs" htmlFor="maxwords">
                  Max words
                </Label>
                <Input
                  id="maxwords"
                  className="hash-text mt-2"
                  type="number"
                  min={1}
                  max={20}
                  value={config.maxWords}
                  onChange={(e) => set("maxWords", Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="label-xs">Separator</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SEPARATORS.map((s) => (
                    <Button
                      key={s.value}
                      type="button"
                      size="sm"
                      variant={config.wordSeparator === s.value ? "default" : "secondary"}
                      className="hash-text"
                      onClick={() => set("wordSeparator", s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Each attempt is a random passphrase of 1&ndash;20 words from a 2048-word English dictionary.
                </p>
              </div>
            </>
          )}

          {config.mode === "custom" && (
            <>
              <div>
                <Label className="label-xs" htmlFor="suffix">
                  Suffix
                </Label>
                <Input
                  id="suffix"
                  className="hash-text mt-2"
                  value={config.suffix}
                  onChange={(e) => set("suffix", e.target.value)}
                />
              </div>
              <div>
                <Label className="label-xs" htmlFor="charset">
                  Character set
                </Label>
                <Input
                  id="charset"
                  className="hash-text mt-2"
                  value={config.charset}
                  onChange={(e) => set("charset", e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <Label className="label-xs" htmlFor="batch">
              Batch size
            </Label>
            <Input
              id="batch"
              className="hash-text mt-2"
              type="number"
              min={1000}
              step={1000}
              value={config.batchSize}
              onChange={(e) => set("batchSize", Math.max(1000, Number(e.target.value) || 1000))}
            />
          </div>

          <div>
            <Label className="label-xs" htmlFor="threads">
              Threads (workers)
            </Label>
            <Input
              id="threads"
              className="hash-text mt-2"
              type="number"
              min={1}
              max={32}
              value={threads}
              onChange={(e) => setThreads(Math.min(32, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {status === "running" ? (
            <Button className="hash-text" onClick={onPause}>
              Pause
            </Button>
          ) : (
            <Button
              className="hash-text"
              onClick={() => (status === "paused" ? onResume() : onStart(config, threads))}
            >
              {status === "paused" ? "Resume" : "Start"}
            </Button>
          )}
          <Button variant="secondary" className="hash-text" onClick={onStop} disabled={status === "idle"}>
            Stop
          </Button>
        </div>
      </div>
    </section>
  );
}
