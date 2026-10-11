"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SwipeDeck } from "@/components/SwipeDeck";
import type { Answers, Card, SwipeValue } from "@/lib/types";

export default function PublicSwipePage() {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [history, setHistory] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/s/${token}`);
      if (!res.ok) {
        setError("This link is invalid or expired.");
        return;
      }
      const data = await res.json();
      setName(data.client.pseudonym);
      if (data.assessment.status !== "cards") {
        setDone(true);
        setReady(true);
        return;
      }
      setOrder(data.assessment.cardOrder as string[]);
      setCards((data.cards as Card[]) || []);
      setAnswers((data.assessment.answers as Answers) || {});
      const answered = (data.assessment.cardOrder as string[]).filter(
        (cid: string) => data.assessment.answers?.[cid],
      );
      setHistory(answered);
      setReady(true);
    }
    void load();
  }, [token]);

  const cardsById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const index = history.length;
  const card = order[index] ? cardsById.get(order[index]!) : undefined;

  async function persist(nextAnswers: Answers) {
    const res = await fetch(`/api/s/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: nextAnswers }),
    });
    const data = await res.json();
    if (data.assessment?.status === "review") {
      setDone(true);
    }
  }

  function onSwipe(value: SwipeValue) {
    if (!card) return;
    const next = { ...answers, [card.id]: value };
    setAnswers(next);
    setHistory([...history, card.id]);
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

  if (error) {
    return (
      <main className="mx-auto flex h-dvh max-w-lg flex-col justify-center px-4 text-center">
        <p className="text-[var(--accent-text)]">{error}</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex h-dvh items-center justify-center px-4 text-[var(--ink-muted)]">
        Loading…
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex h-dvh max-w-lg flex-col justify-center px-4 text-center">
        <p className="tracking-[0.2em] uppercase text-[var(--accent-text)]">
          tint
        </p>
        <h1 className="mt-4 text-3xl">You’re done, {name}</h1>
        <p className="mt-3 text-[var(--ink-muted)]">
          Hand the device back to your therapist — they’ll continue with the
          house and next steps.
        </p>
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
          <p className="text-center text-[10px] tracking-[0.2em] uppercase text-[var(--accent-text)] sm:text-xs">
            tint · {name}
          </p>
        }
      />
    </main>
  );
}
