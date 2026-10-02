"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Card, SwipeValue } from "@/lib/types";
import { DIMENSION_LABELS } from "@/lib/content";

type Props = {
  card: Card;
  index: number;
  total: number;
  canUndo: boolean;
  onSwipe: (value: SwipeValue) => void;
  onUndo: () => void;
  /** Optional strip above the progress row (e.g. therapist shortcut hint). */
  topNote?: ReactNode;
};

const EXIT = 420;

export function SwipeDeck({
  card,
  index,
  total,
  canUndo,
  onSwipe,
  onUndo,
  topNote,
}: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hint, setHint] = useState<SwipeValue | null>(null);
  const [exiting, setExiting] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    locked.current = false;
    setExiting(false);
    setOffset({ x: 0, y: 0 });
    setHint(null);
    start.current = null;
  }, [card.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (locked.current) return;
      if (e.key === "ArrowLeft") commit("dislike");
      if (e.key === "ArrowUp") commit("love");
      if (e.key === "ArrowRight") commit("like");
      if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey) && canUndo) {
        e.preventDefault();
        onUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function decide(dx: number, dy: number): SwipeValue | null {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 60 && absY < 60) return null;
    if (absY > absX && dy < 0) return "love";
    if (dx < 0) return "dislike";
    return "like";
  }

  function exitOffset(value: SwipeValue) {
    if (value === "dislike") return { x: -EXIT, y: 0 };
    if (value === "like") return { x: EXIT, y: 0 };
    return { x: 0, y: -EXIT };
  }

  function commit(value: SwipeValue) {
    if (locked.current) return;
    locked.current = true;
    setExiting(true);
    setHint(value);
    setOffset(exitOffset(value));
    window.setTimeout(() => {
      onSwipe(value);
    }, 220);
  }

  return (
    <div className="mx-auto flex h-dvh w-[96vw] max-w-[96vw] flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5">
      {topNote ? <div className="shrink-0 pb-2">{topNote}</div> : null}

      <div className="flex shrink-0 items-center justify-between text-sm text-[var(--ink-muted)]">
        <span>
          {index + 1} / {total}
        </span>
        <span>{DIMENSION_LABELS[card.dimension]}</span>
      </div>

      <div
        className={`relative mt-3 mb-3 min-h-0 flex-1 touch-none select-none overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl sm:p-8 ${
          exiting
            ? "transition-transform duration-200 ease-out"
            : "transition-transform duration-150 ease-out"
        }`}
        style={{
          width: "100%",
          transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x / 40}deg)`,
        }}
        onPointerDown={(e) => {
          if (locked.current) return;
          start.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!start.current || locked.current) return;
          const dx = e.clientX - start.current.x;
          const dy = e.clientY - start.current.y;
          setOffset({ x: dx, y: dy });
          setHint(decide(dx, dy));
        }}
        onPointerUp={() => {
          if (!start.current || locked.current) return;
          const value = decide(offset.x, offset.y);
          start.current = null;
          if (value) {
            commit(value);
            return;
          }
          setOffset({ x: 0, y: 0 });
          setHint(null);
        }}
        onPointerCancel={() => {
          if (locked.current) return;
          start.current = null;
          setOffset({ x: 0, y: 0 });
          setHint(null);
        }}
      >
        {hint && (
          <p className="absolute top-4 left-1/2 z-10 -translate-x-1/2 text-xs tracking-[0.2em] uppercase text-[var(--accent-text)]">
            {hint === "dislike" ? "Dislike" : hint === "like" ? "Like" : "Love"}
          </p>
        )}
        <div className="flex h-full flex-col justify-center">
          <h2 className="text-[clamp(1.5rem,4.5vw,2.25rem)] leading-tight text-[var(--ink)]">
            {card.title}
          </h2>
          <p className="mt-4 text-[clamp(1rem,3.2vw,1.25rem)] leading-relaxed text-[var(--ink-muted)]">
            {card.prompt}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-sm sm:gap-3">
        <button
          type="button"
          disabled={exiting}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-3 font-medium text-[var(--dislike)] disabled:opacity-40 sm:px-3"
          onClick={() => commit("dislike")}
        >
          ← Dislike
        </button>
        <button
          type="button"
          disabled={exiting}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-3 font-medium text-[var(--love)] disabled:opacity-40 sm:px-3"
          onClick={() => commit("love")}
        >
          ↑ Love
        </button>
        <button
          type="button"
          disabled={exiting}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-3 font-medium text-[var(--like)] disabled:opacity-40 sm:px-3"
          onClick={() => commit("like")}
        >
          Like →
        </button>
      </div>

      <button
        type="button"
        disabled={!canUndo || exiting}
        onClick={onUndo}
        className="mt-2 shrink-0 py-1 text-sm text-[var(--ink-muted)] disabled:opacity-30"
      >
        Undo last swipe
      </button>
    </div>
  );
}
