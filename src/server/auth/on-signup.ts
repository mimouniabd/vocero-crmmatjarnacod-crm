import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";

/** Etapas sembradas del pipeline (US2). */
const SEED_STAGES: { name: string; kind: "open" | "won" | "lost" }[] = [
  { name: "Nuevo", kind: "open" },
  { name: "En conversación", kind: "open" },
  { name: "Interesado", kind: "open" },
  { name: "Cliente", kind: "won" },
  { name: "Perdido", kind: "lost" },
];

/**
 * Crea un espacio de trabajo independiente para cada registro público.
 * Las altas internas de miembros del equipo pasan createOrganization=false:
 * su membresía se añade explícitamente a la organización de quien los invitó.
 */
export async function onUserCreated(
  userId: string,
  userName: string,
  createOrganization = true
) {
  if (!createOrganization) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    // Serialize retries for this identity. A repeated post-create hook must
    // not create a second workspace for the same user.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${userId}))`
    );
    const existingMembership = await tx
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.userId, userId))
      .limit(1);
    if (existingMembership.length > 0) return;

    const orgId = newId("organization");
    await tx.insert(schema.organization).values({
      id: orgId,
      name: userName ? `Negocio de ${userName}` : "Mi negocio",
      slug: orgId,
    });
    await tx.insert(schema.member).values({
      id: newId("member"),
      organizationId: orgId,
      userId,
      role: "owner",
    });
    await tx.insert(schema.pipelineStage).values(
      SEED_STAGES.map((s, i) => ({
        id: newId("stage"),
        organizationId: orgId,
        name: s.name,
        position: i,
        kind: s.kind,
      }))
    );
    await tx.insert(schema.agentProfile).values({
      id: newId("agentProfile"),
      organizationId: orgId,
    });
  });
}

/** Organización activa de un usuario (su primera membresía). */
export async function resolveActiveOrganizationId(
  userId: string
): Promise<string | null> {
  return (await resolveMembership(userId))?.organizationId ?? null;
}

export async function resolveMembership(
  userId: string,
  organizationId?: string | null
): Promise<{ organizationId: string; role: string } | null> {
  const db = getDb();
  const rows = await db
    .select({
      organizationId: schema.member.organizationId,
      role: schema.member.role,
    })
    .from(schema.member)
    .where(
      organizationId
        ? and(
            eq(schema.member.userId, userId),
            eq(schema.member.organizationId, organizationId)
          )
        : eq(schema.member.userId, userId)
    )
    .limit(1);
  return rows[0] ?? null;
}
