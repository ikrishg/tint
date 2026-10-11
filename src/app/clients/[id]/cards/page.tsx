"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SwipeDeck } from "@/components/SwipeDeck";
import type { Answers, Card, SwipeValue } from "@/lib/types";

export default function CardsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [history, setHistory] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [filling, setFilling] = useState(false);
  const fillingRef = useRef(false);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (!me.isLoggedIn) {
        router.replace("/login");
        return;
      }
      const res = await fetch(`/api/clients/${id}/assessment`);
      const data = await res.json();
      const assessment = data.assessment;
      if (assessment.status !== "cards") {
        router.replace(
          assessment.status === "complete"
            ? `/clients/${id}/summary`
            : `/clients/${id}/${assessment.status}`,
        );
        return;
      }
      setOrder(assessment.cardOrder as string[]);
      setCards((data.cards as Card[]) || []);
      setAnswers((assessment.answers as Answers) || {});
      const answered = (assessment.cardOrder as string[]).filter(
        (cid: string) => assessment.answers?.[cid],
      );
      setHistory(answered);
      setReady(true);
    }
    void load();
  }, [id, router]);

  const cardsById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const index = history.length;
  const card = order[index] ? cardsById.get(order[index]!) : undefined;

  async function persist(nextAnswers: Answers, fillRandom = false) {
    const res = await fetch(`/api/clients/${id}/assessment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        fillRandom ? { fillRandom: true } : { answers: nextAnswers },
      ),
    });
    const data = await res.json();
    if (data.assessment?.status === "review") {
      router.push(`/clients/${id}/review`);
    }
  }

  async function skipRandom() {
    if (fillingRef.current) return;
    fillingRef.current = true;
    setFilling(true);
    try {
      await persist({}, true);
    } finally {
      fillingRef.current = false;
      setFilling(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Use e.code — on macOS Option+K changes e.key to ˚, so key === "k" never matches.
      if (e.code === "KeyK" && e.ctrlKey && e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void skipRandom();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  function onSwipe(value: SwipeValue) {
    if (!card) return;
    const next = { ...answers, [card.id]: value };
    const hist = [...history, card.id];
    setAnswers(next);
    setHistory(hist);
    void persist(next);
  }

  function onUndo() {
    if (!history.length) return;
    const hist = history.slice(0, -1);
    const last = history[history.length - 1]!;
    const next = { ...answers };
    delete next[last];
    setHistory(hist);
    setAnswers(next);
    void persist(next);
  }

  if (!ready) {
    return (
      <main className="flex h-dvh items-center justify-center px-4 text-[var(--ink-muted)]">
        Loading cards…
      </main>
    );
  }

  if (!card) {
    return (
      <main className="flex h-dvh items-center justify-center px-4 text-[var(--ink-muted)]">
        Finishing…
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden">
      <SwipeDeck
        key={card.id}
        card={card}
        index={index}
        total={order.length}
        canUndo={history.length > 0}
        onSwipe={onSwipe}
        onUndo={onUndo}
        topNote={
          <p className="text-center text-[10px] leading-tight text-[var(--ink-muted)] sm:text-xs">
            {filling
              ? "Filling remaining cards…"
              : "Therapist shortcut: Ctrl+Option+K fills remaining cards randomly."}
          </p>
        }
      />
    </main>
  );
}
