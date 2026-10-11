"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

type ClientOption = { id: string; pseudonym: string };
type Tag = { id: string; name: string };

export default function NewClientPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>();
  const [pseudonym, setPseudonym] = useState("");
  const [relationshipType, setRelationshipType] = useState<
    "cis_het" | "queer" | "trans"
  >("cis_het");
  const [linkedClientId, setLinkedClientId] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [createShareLink, setCreateShareLink] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (!me.isLoggedIn) {
        router.replace("/login");
        return;
      }
      setUsername(me.username);
      const [data, tagData] = await Promise.all([
        fetch("/api/clients").then((r) => r.json()),
        fetch("/api/tags").then((r) => r.json()),
      ]);
      setOptions(
        (data.clients as { id: string; pseudonym: string }[]).map((c) => ({
          id: c.id,
          pseudonym: c.pseudonym,
        })),
      );
      setTags(tagData.tags || []);
    }
    void load();
  }, [router]);

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pseudonym,
        relationshipType,
        linkedClientId: linkedClientId || null,
        tagIds,
        createShareLink,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create client");
      return;
    }
    const data = await res.json();
    if (data.shareUrl) {
      const absolute =
        typeof window !== "undefined"
          ? `${window.location.origin}${data.shareUrl}`
          : data.shareUrl;
      setShareUrl(absolute);
      setCreatedId(data.client.id);
      return;
    }
    router.push(`/clients/${data.client.id}`);
  }

  return (
    <AppShell username={username}>
      <h1 className="text-3xl sm:text-4xl">New client</h1>
      {shareUrl ? (
        <div className="mt-8 max-w-lg space-y-4">
          <p className="text-[var(--ink-muted)]">
            Client created. Share this swipe link (cards only):
          </p>
          <input
            readOnly
            value={shareUrl}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
          />
          <button
            type="button"
            className="rounded-full btn-primary px-5 py-2 text-sm"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
          >
            Copy link
          </button>
          <button
            type="button"
            className="ml-2 rounded-full border border-[var(--border)] px-5 py-2 text-sm"
            onClick={() => router.push(createdId ? `/clients/${createdId}` : "/clients")}
          >
            Open client
          </button>
          <p>
            <Link href="/clients" className="text-sm text-[var(--accent-text)]">
              Go to clients
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 max-w-lg space-y-4">
          <label className="block space-y-2 text-sm">
            <span>Pseudonym</span>
            <input
              required
              value={pseudonym}
              onChange={(e) => setPseudonym(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Type of relationship</span>
            <select
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(
                  e.target.value as "cis_het" | "queer" | "trans",
                )
              }
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <option value="cis_het">Cis-het</option>
              <option value="queer">Queer</option>
              <option value="trans">Trans</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>Link to existing client (optional)</span>
            <select
              value={linkedClientId}
              onChange={(e) => setLinkedClientId(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <option value="">None</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.pseudonym}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend>Tags (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <p className="text-[var(--ink-muted)]">
                  No tags yet — add some in Settings.
                </p>
              ) : (
                tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={`rounded-full border px-3 py-1.5 ${
                      tagIds.includes(t.id)
                        ? "border-[var(--espresso)] bg-[var(--espresso)] text-[var(--warm-white)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {t.name}
                  </button>
                ))
              )}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createShareLink}
              onChange={(e) => setCreateShareLink(e.target.checked)}
            />
            Create shareable swipe link
          </label>
          {error && <p className="text-sm text-[var(--accent-text)]">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full btn-primary px-6 py-3"
          >
            {pending ? "Creating…" : "Create client"}
          </button>
        </form>
      )}
    </AppShell>
  );
}
