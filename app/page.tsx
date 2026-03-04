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
        "relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.06] backdrop-blur-2xl",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_90px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {/* overlays never capture input */}
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[26px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function MiniChip({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-2xl border px-3 py-2 text-left transition",
        active ? "border-white/25 bg-white/10" : "border-white/10 bg-white/[0.05] hover:bg-white/10"
      )}
    >
      <div className="text-[10px] text-white/50">{subtitle}</div>
      <div className={cn("mt-0.5 text-[12px] font-medium", title ? "text-white/90" : "text-white/35")}>
        {title || "Empty"}
      </div>
    </button>
  );
}

function SlotCard({
  title,
  role,
  names,
  spinning,
}: {
  title: string;
  role: string;
  names: string[];
  spinning: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-white/85">{title}</div>
        <div className={cn("text-[11px] text-white/55", spinning && "animate-pulse")}>{role}</div>
      </div>
      <div className="mt-2 space-y-2">
        {names.map((n, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2"
          >
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_60%)]" />
            <motion.div
              key={n + (spinning ? "-spin" : "-lock")}
              initial={{ y: -10, opacity: 0, filter: "blur(6px)" }}
              animate={{ y: 0, opacity: 1, filter: spinning ? "blur(2px)" : "blur(0px)" }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="relative z-10 text-[13px] font-semibold text-white"
            >
              {n || "—"}
            </motion.div>
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

  const [names, setNames] = useState<string[]>(Array(6).fill(""));
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState("");

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

  // IMPORTANT: clean timers
  function cleanupTimers() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }

  useEffect(() => cleanupTimers, []);

  function setCurrentValue(v: string) {
    setNames((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    setError("");
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

  function startShuffle() {
    if (spinning) return;
    cleanupTimers();

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

    const final = shuffle(trimmed);
    const finalTeamA = final.slice(0, 3);
    const finalTeamB = final.slice(3, 6);
    const finalGov: "A" | "B" = Math.random() < 0.5 ? "A" : "B";

    setPreview({ teamA: finalTeamA, teamB: finalTeamB, govTeam: finalGov });

    intervalRef.current = window.setInterval(() => {
      const s = shuffle(trimmed);
      setPreview({
        teamA: s.slice(0, 3),
        teamB: s.slice(3, 6),
        govTeam: Math.random() < 0.5 ? "A" : "B",
      });
    }, 70);

    timeoutRef.current = window.setTimeout(() => {
      cleanupTimers();
      setPreview({ teamA: finalTeamA, teamB: finalTeamB, govTeam: finalGov });
      setSpinning(false);
      setPhase("result");
    }, 1400);
  }

  function reroll() {
    if (spinning) return;
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

  const govNames = preview ? (preview.govTeam === "A" ? preview.teamA : preview.teamB) : [];
  const oppNames = preview ? (preview.govTeam === "A" ? preview.teamB : preview.teamA) : [];

  return (
    // ✅ NO vertical scroll app. Always fits.
    <main className="isolate h-[100svh] w-full overflow-hidden bg-[#07060D] text-white">
      {/* Background (non-interactive) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.18),transparent_60%)]" />
        <div className="absolute -left-28 top-20 h-[300px] w-[300px] rounded-full bg-fuchsia-500/18 blur-3xl" />
        <div className="absolute -right-28 bottom-10 h-[340px] w-[340px] rounded-full bg-indigo-500/18 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.20)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.20)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      {/* ✅ safe area padding for notch phones */}
      <div className="relative mx-auto flex h-full w-full max-w-xl flex-col px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(12px+env(safe-area-inset-bottom))]">
        {/* Header (compressed on short height) */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/80 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-fuchsia-300/80 shadow-[0_0_18px_rgba(217,70,239,0.45)]" />
            AP Randomizer
          </div>

          <button
            onClick={reset}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 backdrop-blur-xl hover:bg-white/10 active:scale-[0.99]"
          >
            Reset
          </button>
        </div>

        {/* Title (auto-collapses on short height) */}
        <div className="mt-3 [@media(max-height:720px)]:mt-2">
          <h1 className="text-[20px] font-semibold tracking-tight [@media(max-height:720px)]:text-[18px]">
            Futuristic Debate Team Generator
          </h1>
          <p className="mt-1 text-[12px] text-white/65 [@media(max-height:720px)]:hidden">
            No vertical scroll • Always fits
          </p>
        </div>

        {/* Main panel uses remaining height */}
        <div className="mt-4 flex-1 min-h-0 [@media(max-height:720px)]:mt-3">
          <GlassPanel className="h-full p-4 [@media(max-height:720px)]:p-3">
            <AnimatePresence mode="wait">
              {phase === "entry" ? (
                <motion.div
                  key="entry"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full min-h-0 flex-col"
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white/90">
                      Debater {idx + 1}/6
                    </div>
                    <div className="text-[11px] text-white/60">{filledCount}/6</div>
                  </div>

                  {/* progress (small) */}
                  <div className="mt-2 flex items-center gap-2">
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

                  {/* ✅ Name preview becomes HORIZONTAL strip (never increases height) */}
                  <div className="mt-3">
                    <div className="mb-2 text-[12px] text-white/65 [@media(max-height:720px)]:mb-1">
                      Entered
                    </div>
                    <div
                      className={cn(
                        "flex gap-2 overflow-x-auto pb-1",
                        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      )}
                    >
                      {names.map((n, i) => (
                        <MiniChip
                          key={i}
                          active={i === idx}
                          subtitle={`#${i + 1}`}
                          title={n.trim() ? (n.length > 14 ? n.slice(0, 14) + "…" : n) : ""}
                          onClick={() => setIdx(i)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Input */}
                  <div className="mt-3 relative z-50">
                    <div className="mb-2 text-[12px] text-white/70 [@media(max-height:720px)]:mb-1">
                      Name
                    </div>
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
                        "focus:border-white/25 focus:bg-white/[0.08]",
                        "[@media(max-height:720px)]:py-3"
                      )}
                    />

                    <div className="mt-2 text-[11px] text-white/50 [@media(max-height:720px)]:hidden">
                      Tip: no duplicates — each name must be unique.
                    </div>

                    {isDuplicateAt(idx) ? (
                      <div className="mt-2 text-[12px] text-white/80">
                        ⚠️ This name is already used.
                      </div>
                    ) : null}

                    {error ? (
                      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
                        ⚠️ {error}
                      </div>
                    ) : null}
                  </div>

                  {/* Buttons (only set, no duplicate bottom bar) */}
                  <div className="mt-auto pt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={goPrev}
                        disabled={idx === 0}
                        className={cn(
                          "w-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm",
                          "backdrop-blur-xl hover:bg-white/10 active:scale-[0.99]",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          "[@media(max-height:720px)]:py-2.5"
                        )}
                      >
                        Back
                      </button>

                      {idx < 5 ? (
                        <button
                          onClick={goNext}
                          className={cn(
                            "flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium",
                            "backdrop-blur-xl hover:bg-white/15 active:scale-[0.99]",
                            "[@media(max-height:720px)]:py-2.5"
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
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                            "[@media(max-height:720px)]:py-2.5"
                          )}
                        >
                          Start Shuffle
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full min-h-0 flex-col"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white/90">
                      {phase === "shuffle" ? "Shuffling…" : "Results"}
                    </div>
                    <div className="text-[11px] text-white/60">{spinning ? "casino mode" : "locked"}</div>
                  </div>

                  <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3">
                    <SlotCard
                      title="Team A"
                      role={preview?.govTeam === "A" ? "Government" : "Opposition"}
                      names={preview?.teamA ?? ["—", "—", "—"]}
                      spinning={spinning}
                    />
                    <SlotCard
                      title="Team B"
                      role={preview?.govTeam === "B" ? "Government" : "Opposition"}
                      names={preview?.teamB ?? ["—", "—", "—"]}
                      spinning={spinning}
                    />

                    {/* On short height hide the extra summary pills automatically */}
                    {phase === "result" ? (
                      <div className="grid grid-cols-2 gap-2 [@media(max-height:720px)]:hidden">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="text-[11px] font-semibold text-white/75">Government</div>
                          <div className="mt-2 space-y-1.5">
                            {govNames.map((n, i) => (
                              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white/85">
                                {n}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="text-[11px] font-semibold text-white/75">Opposition</div>
                          <div className="mt-2 space-y-1.5">
                            {oppNames.map((n, i) => (
                              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white/85">
                                {n}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-auto pt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={reroll}
                        disabled={spinning}
                        className={cn(
                          "flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium",
                          "backdrop-blur-xl hover:bg-white/10 active:scale-[0.99]",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          "[@media(max-height:720px)]:py-2.5"
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
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          "[@media(max-height:720px)]:py-2.5"
                        )}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassPanel>
        </div>
      </div>
    </main>
  );
}
