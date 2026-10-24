import sanitize from "sanitize-html";
import { z } from "zod";
import { db } from "@/lib/db";
const safeUrl = z.url().refine((s) => s.startsWith("https://"));
const plain = (v: unknown) =>
  sanitize(String(v ?? ""), { allowedTags: [], allowedAttributes: {} }).slice(
    0,
    30000,
  );
const date = (v: unknown) => {
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.valueOf()) ? null : d;
};
export type NormalJob = {
  externalId: string;
  title: string;
  company: string;
  location: string;
  country: string;
  arrangement: string;
  employmentType: string;
  seniority: string;
  salary: string;
  description: string;
  url: string;
  source: string;
  postedAt: Date | null;
};
const rawSchema = z.record(z.string(), z.unknown());
export function normalize(
  kind: string,
  source: string,
  payload: unknown,
): NormalJob[] {
  const root = rawSchema.safeParse(payload);
  const rows = z
    .array(rawSchema)
    .parse(kind === "lever" ? payload : root.success ? root.data.jobs : []);
  return rows.flatMap((r) => {
    const cat = rawSchema.safeParse(r.categories).data ?? {},
      loc = rawSchema.safeParse(r.location).data ?? {};
    const link = String(r.absolute_url ?? r.hostedUrl ?? r.url ?? "");
    if (!safeUrl.safeParse(link).success) return [];
    return [
      {
        externalId: String(r.id),
        title: plain(r.title ?? r.text),
        company: plain(r.company_name ?? source),
        location: plain(
          loc.name ?? cat.location ?? r.candidate_required_location,
        ),
        country: "",
        arrangement: kind === "remotive" ? "Remote" : plain(r.workplaceType),
        employmentType: plain(cat.commitment ?? r.job_type),
        seniority: "",
        salary: plain(r.salary),
        description: plain(r.content ?? r.descriptionPlain ?? r.description),
        url: link,
        source: kind === "remotive" ? "Remotive" : `${kind}: ${source}`,
        postedAt: date(r.publication_date ?? r.createdAt),
      },
    ];
  });
}
async function fetchProvider(kind: string, source: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(source))
    throw new Error("Invalid provider source");
  const endpoint =
    kind === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${source}/jobs?content=true`
      : kind === "lever"
        ? `https://api.lever.co/v0/postings/${source}?mode=json`
        : kind === "remotive"
          ? "https://remotive.com/api/remote-jobs"
          : null;
  if (!endpoint) throw new Error("Unsupported provider");
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) return normalize(kind, source, await res.json());
    if (res.status < 500 || attempt === 2)
      throw new Error(`Provider returned HTTP ${res.status}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error("Provider unavailable");
}
export async function syncProvider(id: string) {
  const p = await db.jobProvider.findUniqueOrThrow({ where: { id } });
  if (!p.active) throw new Error("Provider disabled");
  const minimum = p.kind === "remotive" ? 6 : 1;
  if (p.lastSyncAt && Date.now() - p.lastSyncAt.getTime() < minimum * 3600000)
    throw new Error(`Wait at least ${minimum} hours between requests.`);
  const now = new Date();
  const claim = await db.jobProvider.updateMany({
    where: { id, OR: [{ syncingUntil: null }, { syncingUntil: { lt: now } }] },
    data: { syncingUntil: new Date(Date.now() + 120000) },
  });
  if (!claim.count) throw new Error("Sync already running");
  try {
    const rows = await fetchProvider(p.kind, p.source);
    await db.$transaction(
      async (tx) => {
        for (const row of rows)
          await tx.job.upsert({
            where: {
              providerId_externalId: {
                providerId: id,
                externalId: row.externalId,
              },
            },
            create: { ...row, providerId: id, syncedAt: now },
            update: { ...row, active: true, syncedAt: now },
          });
        await tx.job.updateMany({
          where: { providerId: id, syncedAt: { lt: now } },
          data: { active: false },
        });
        await tx.jobProvider.update({
          where: { id },
          data: { lastSyncAt: now, lastError: null, syncingUntil: null },
        });
        await tx.systemEvent.create({
          data: {
            kind: "JOB_SYNC",
            status: "OK",
            message: `${p.kind}: ${rows.length} listings`,
          },
        });
      },
      { timeout: 60000 },
    );
    return rows.length;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await db.jobProvider.update({
      where: { id },
      data: { lastError: message, syncingUntil: null },
    });
    await db.systemEvent.create({
      data: { kind: "JOB_SYNC", status: "ERROR", message },
    });
    throw e;
  }
}
