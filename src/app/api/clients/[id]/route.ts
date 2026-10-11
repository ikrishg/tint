import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { requireTherapist } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function ownedClient(therapistId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.therapistId, therapistId)))
    .limit(1);
  return row ?? null;
}

export async function GET(_request: Request, { params }: Params) {
  const session = await requireTherapist();
  if (!session?.therapistId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const client = await ownedClient(session.therapistId, id);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  let linked = null;
  if (client.linkedClientId) {
    const [partner] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, client.linkedClientId))
      .limit(1);
    linked = partner ?? null;
  }

  return NextResponse.json({ client, linked });
}

const patchSchema = z.object({
  linkedClientId: z.string().uuid().nullable().optional(),
  pseudonym: z.string().min(1).optional(),
  relationshipType: z.enum(["cis_het", "queer", "trans"]).optional(),
  createLinked: z
    .object({
      pseudonym: z.string().min(1),
      relationshipType: z.enum(["cis_het", "queer", "trans"]),
    })
    .optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireTherapist();
  if (!session?.therapistId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const client = await ownedClient(session.therapistId, id);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const db = getDb();

  if (parsed.data.createLinked) {
    const [partner] = await db
      .insert(clients)
      .values({
        therapistId: session.therapistId,
        pseudonym: parsed.data.createLinked.pseudonym.trim(),
        relationshipType: parsed.data.createLinked.relationshipType,
        linkedClientId: id,
      })
      .returning();

    await db
      .update(clients)
      .set({ linkedClientId: partner.id })
      .where(eq(clients.id, id));

    const { getEligibleCardsForClient } = await import("@/lib/questions");
    const { shuffleIds } = await import("@/lib/shuffle");
    const eligible = await getEligibleCardsForClient(
      session.therapistId,
      partner.id,
    );
    const { assessments } = await import("@/db/schema");
    await db.insert(assessments).values({
      clientId: partner.id,
      status: "cards",
      cardOrder: shuffleIds(eligible.map((c) => c.id)),
    });

    return NextResponse.json({
      client: { ...client, linkedClientId: partner.id },
      linked: partner,
    });
  }

  if (parsed.data.linkedClientId !== undefined) {
    const linkId = parsed.data.linkedClientId;
    if (linkId) {
      const partner = await ownedClient(session.therapistId, linkId);
      if (!partner) {
        return NextResponse.json({ error: "Partner not found" }, { status: 404 });
      }
      await db.update(clients).set({ linkedClientId: linkId }).where(eq(clients.id, id));
      await db.update(clients).set({ linkedClientId: id }).where(eq(clients.id, linkId));
    } else if (client.linkedClientId) {
      await db
        .update(clients)
        .set({ linkedClientId: null })
        .where(eq(clients.id, client.linkedClientId));
      await db.update(clients).set({ linkedClientId: null }).where(eq(clients.id, id));
    }
  }

  const updates: Partial<typeof clients.$inferInsert> = {};
  if (parsed.data.pseudonym) updates.pseudonym = parsed.data.pseudonym.trim();
  if (parsed.data.relationshipType) {
    updates.relationshipType = parsed.data.relationshipType;
  }
  if (Object.keys(updates).length) {
    await db.update(clients).set(updates).where(eq(clients.id, id));
  }

  const [fresh] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return NextResponse.json({ client: fresh });
}
