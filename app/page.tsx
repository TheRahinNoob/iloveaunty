"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";

/* =========================
   Helpers
========================= */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* =========================
   Slot Reel (casino vibe)
========================= */
function SlotReel({
  label,
  value,
  spinning,
}: {
  label: string;
  value: string;
  spinning: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-[11px] font-medium text-white/70">{label}</div>
        <div className={cn("text-[11px] text-white/50", spinning && "animate-pulse")}>
          {spinning ? "spinning…" : "locked"}
        </div>
      </div>

      <div className="relative px-3 pb-3">
        <div className="relative h-12 overflow-hidden rounded-xl border border-white/10 bg-black/25">
          {/* glow (must NOT block input anywhere else) */}
          <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_55%)]" />

          <AnimatePresence mode="popLayout">
            <motion.div
              key={value + (spinning ? "-spin" : "-lock")}
              initial={{ y: -18, opacity: 0, filter: "blur(6px)" }}
              animate={{
                y: 0,
                opacity: 1,
                filter: spinning ? "blur(2px)" : "blur(0px)",
              }}
              exit={{ y: 18, opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center px-3 text-sm font-semibold tracking-wide text-white"
            >
              {value}
            </motion.div>
          </AnimatePresence>

          {/* scanline */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.20)_1px,transparent_1px)] [background-size:100%_10px]" />
        </div>
      </div>
    </div>
  );
}

/* =========================
   UI bits
========================= */
function GlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // IMPORTANT: relative + overflow-hidden so inner glows don't escape,
        // and input remains interactive due to pointer-events-none overlays.
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-2xl",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_90px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {/* overlays must never capture pointer events */}
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />

      {/* make sure content sits above overlays */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function Pill({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] font-semibold text-white/75">{title}</div>
      <div className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white/85"
          >
            {it}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   Main App
========================= */
type Phase = "entry" | "shuffle" | "result";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("entry");

  // Wizard entry (tiny-screen friendly, no scroll)
  const [names, setNames] = useState<string[]>(Array(6).fill(""));
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string>("");

  // Slot animation timers
  const [spinning, setSpinning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [preview, setPreview] = useState<{
    teamA: string[];
    teamB: string[];
    govTeam: "A" | "B";
  } | null>(null);

  const filledCount = useMemo(() => names.filter((n) => n.trim()).length, [names]);
  const canStart = filledCount === 6 && !spinning;

  const currentValue = names[idx] ?? "";

  function setCurrentValue(v: string) {
    setNames((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    setError("");
  }

  function goPrev() {
    setIdx((p) => clamp(p - 1, 0, 5));
    setError("");
  }

  function goNext() {
    const v = currentValue.trim();
    if (!v) {
      setError("Type a name to continue.");
      return;
    }
    setError("");
    setIdx((p) => clamp(p + 1, 0, 5));
  }

  function validateAll() {
    const trimmed = names.map((n) => n.trim());
    if (trimmed.some((n) => !n)) return "Please fill all 6 names.";
    const lower = trimmed.map((n) => n.toLowerCase());
    if (new Set(lower).size !== 6) return "No duplicate names (each must be unique).";
    return "";
  }

  function isDuplicateAt(index: number) {
    const v = names[index]?.trim().toLowerCase();
    if (!v) return false;
    return names.some((n, i) => i !== index && n.trim().toLowerCase() === v);
  }

  function cleanupTimers() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }

  function startShuffle() {
    if (spinning) return; // block double start
    cleanupTimers(); // kill any old timers first

    const err = validateAll();
    if (err) {
      setError(err);
      setPhase("entry");
      return;
    }

    setError("");
    setPhase("shuffle");
    setSpinning(true);

    const trimmed = names.map((n) => n.trim());

    // Decide final once
    const finalShuffled = shuffle(trimmed);
    const finalTeamA = finalShuffled.slice(0, 3);
    const finalTeamB = finalShuffled.slice(3, 6);
    const finalGov: "A" | "B" = Math.random() < 0.5 ? "A" : "B";

    // show immediately (no blank)
    setPreview({ teamA: finalTeamA, teamB: finalTeamB, govTeam: finalGov });

    // spin
    intervalRef.current = window.setInterval(() => {
      const s = shuffle(trimmed);
      setPreview({
        teamA: s.slice(0, 3),
        teamB: s.slice(3, 6),
        govTeam: Math.random() < 0.5 ? "A" : "B",
      });
    }, 70);

    // stop + reveal
    timeoutRef.current = window.setTimeout(() => {
      cleanupTimers();
      setPreview({ teamA: finalTeamA, teamB: finalTeamB, govTeam: finalGov });
      setSpinning(false);
      setPhase("result");
    }, 1700);
  }

  function reroll() {
    if (spinning) return;
    cleanupTimers();
    startShuffle();
  }

  function reset() {
    cleanupTimers();
    setSpinning(false);
    setPreview(null);
    setNames(Array(6).fill(""));
    setIdx(0);
    setError("");
    setPhase("entry");
  }

  function copyResult() {
    if (!preview || phase !== "result") return;
    const gov = preview.govTeam === "A" ? preview.teamA : preview.teamB;
    const opp = preview.govTeam === "A" ? preview.teamB : preview.teamA;

    const text =
      `AP Debate Randomizer\n\n` +
      `Government:\n- ${gov.join("\n- ")}\n\n` +
      `Opposition:\n- ${opp.join("\n- ")}\n`;

    navigator.clipboard.writeText(text);
  }

  useEffect(() => {
    return () => cleanupTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const govNames =
    preview && (preview.govTeam === "A" ? preview.teamA : preview.teamB);
  const oppNames =
    preview && (preview.govTeam === "A" ? preview.teamB : preview.teamA);

  return (
    // isolate: prevents weird stacking bugs that can block input interaction
    <main className="isolate h-dvh w-full overflow-hidden bg-[#07060D] text-white">
      {/* Background: MUST be pointer-events-none */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.25),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.22),transparent_60%)]" />
        <div className="absolute -left-32 top-20 h-[360px] w-[360px] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-[420px] w-[420px] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.20)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.20)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_40%)]" />
      </div>

      {/* Single-screen app shell */}
      <div className="relative mx-auto flex h-dvh w-full max-w-xl flex-col px-4 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/80 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-fuchsia-300/80 shadow-[0_0_18px_rgba(217,70,239,0.45)]" />
            AP Randomizer • Mobile-first
          </div>

          <button
            onClick={reset}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 backdrop-blur-xl hover:bg-white/10 active:scale-[0.99]"
          >
            Reset
          </button>
        </div>

        {/* Title */}
        <div className="mt-3">
          <h1 className="text-[20px] font-semibold tracking-tight">
            Futuristic Debate Team Generator
          </h1>
          <p className="mt-1 text-[12px] text-white/65">
            Zero scroll • Tiny-screen friendly • Slot-style shuffle
          </p>
        </div>

        {/* Main content */}
        <div className="mt-4 flex flex-1 flex-col gap-3">
          <GlassPanel className="flex-1">
            <AnimatePresence mode="wait">
              {phase === "entry" ? (
                <motion.div
                  key="entry"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full flex-col"
                >
                  {/* Progress */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white/90">
                      Enter debater {idx + 1} of 6
                    </div>
                    <div className="text-[11px] text-white/60">{filledCount}/6 filled</div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          i <= idx ? "bg-white/30" : "bg-white/10"
                        )}
                      />
                    ))}
                  </div>

                  {/* Entered preview (tap to edit) */}
                  <div className="mt-4">
                    <div className="mb-2 text-[12px] text-white/65">Entered</div>
                    <div className="grid grid-cols-3 gap-2">
                      {names.map((n, i) => {
                        const filled = n.trim().length > 0;
                        return (
                          <button
                            key={i}
                            onClick={() => setIdx(i)}
                            className={cn(
                              "rounded-2xl border px-3 py-2 text-left text-[12px] backdrop-blur-xl transition",
                              i === idx
                                ? "border-white/25 bg-white/10"
                                : "border-white/10 bg-white/[0.06] hover:bg-white/10"
                            )}
                          >
                            <div className="text-[10px] text-white/50">#{i + 1}</div>
                            <div
                              className={cn(
                                "mt-0.5 font-medium",
                                filled ? "text-white/90" : "text-white/35"
                              )}
                            >
                              {filled ? (n.length > 12 ? n.slice(0, 12) + "…" : n) : "Empty"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Input */}
                  <div className="mt-5">
                    <div className="mb-2 text-[12px] text-white/70">Name</div>
                    <input
                      value={currentValue}
                      onChange={(e) => setCurrentValue(e.target.value)}
                      placeholder="Type a debater name"
                      autoCapitalize="words"
                      autoCorrect="off"
                      spellCheck={false}
                      className={cn(
                        "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-[15px]",
                        "outline-none backdrop-blur-xl placeholder:text-white/30",
                        "focus:border-white/25 focus:bg-white/[0.08]"
                      )}
                    />

                    <div className="mt-2 text-[11px] text-white/50">
                      Tip: no duplicates — each name must be unique.
                    </div>

                    {isDuplicateAt(idx) ? (
                      <div className="mt-2 text-[12px] text-white/80">
                        ⚠️ This name is already used. Pick a different one.
                      </div>
                    ) : null}

                    <AnimatePresence>
                      {error ? (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80"
                        >
                          ⚠️ {error}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {/* Wizard buttons */}
                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <button
                      onClick={goPrev}
                      disabled={idx === 0}
                      className={cn(
                        "w-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm",
                        "backdrop-blur-xl hover:bg-white/10 active:scale-[0.99]",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    >
                      Back
                    </button>

                    {idx < 5 ? (
                      <button
                        onClick={goNext}
                        className={cn(
                          "flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium",
                          "backdrop-blur-xl hover:bg-white/15 active:scale-[0.99]"
                        )}
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        onClick={startShuffle}
                        disabled={!canStart}
                        className={cn(
                          "flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold",
                          "backdrop-blur-xl hover:bg-white/15 active:scale-[0.99]",
                          "disabled:opacity-40 disabled:cursor-not-allowed"
                        )}
                      >
                        Start Shuffle
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="slots"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full flex-col"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white/90">
                      {phase === "shuffle" ? "Shuffling teams…" : "Results"}
                    </div>
                    <div className="text-[11px] text-white/60">
                      {phase === "shuffle" ? "casino mode" : "locked"}
                    </div>
                  </div>

                  {/* Slot grid */}
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[12px] font-semibold text-white/85">
                          Team A
                        </div>
                        <div className="text-[11px] text-white/55">
                          {preview?.govTeam === "A" ? "Government" : "Opposition"}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <SlotReel label="A1" value={preview?.teamA?.[0] ?? "—"} spinning={spinning} />
                        <SlotReel label="A2" value={preview?.teamA?.[1] ?? "—"} spinning={spinning} />
                        <SlotReel label="A3" value={preview?.teamA?.[2] ?? "—"} spinning={spinning} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[12px] font-semibold text-white/85">
                          Team B
                        </div>
                        <div className="text-[11px] text-white/55">
                          {preview?.govTeam === "B" ? "Government" : "Opposition"}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <SlotReel label="B1" value={preview?.teamB?.[0] ?? "—"} spinning={spinning} />
                        <SlotReel label="B2" value={preview?.teamB?.[1] ?? "—"} spinning={spinning} />
                        <SlotReel label="B3" value={preview?.teamB?.[2] ?? "—"} spinning={spinning} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-4">
                    <div className="flex gap-2">
                      <button
                        onClick={reroll}
                        disabled={spinning}
                        className={cn(
                          "flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium",
                          "backdrop-blur-xl hover:bg-white/10 active:scale-[0.99]",
                          "disabled:opacity-40 disabled:cursor-not-allowed"
                        )}
                      >
                        Re-roll
                      </button>

                      <button
                        onClick={copyResult}
                        disabled={phase !== "result"}
                        className={cn(
                          "flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold",
                          "backdrop-blur-xl hover:bg-white/15 active:scale-[0.99]",
                          "disabled:opacity-40 disabled:cursor-not-allowed"
                        )}
                      >
                        Copy
                      </button>
                    </div>

                    {phase === "result" && preview ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Pill title="Government" items={govNames ?? []} />
                        <Pill title="Opposition" items={oppNames ?? []} />
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassPanel>

          {/* Bottom Start bar */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-white/70">
                {phase === "entry"
                  ? "Complete all 6 names to shuffle."
                  : phase === "shuffle"
                    ? "Spinning…"
                    : "Tap Re-roll for another random."}
              </div>

              <button
                onClick={startShuffle}
                disabled={!canStart}
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                  "border border-white/10 bg-white/10 hover:bg-white/15 active:scale-[0.99]",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                Start
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}