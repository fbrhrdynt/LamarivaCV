import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  currentUser,
  adminUser,
  HttpError,
  sameOrigin,
  limit,
  ipKey,
} from "@/lib/security";
import {
  profileSchema,
  documentSchema,
  emptyProfile,
  applicationSchema,
  generateLetter,
  quality,
  url as urlSchema,
} from "@/lib/model";
import { settings, settingsSchema, audit } from "@/lib/settings";
import { requestReset, consumeReset } from "@/lib/recovery";
import { sendMail, smtpReady } from "@/lib/mail";
import { exportPDF, exportDOCX, RenderConfig } from "@/lib/export";
import { syncProvider } from "@/providers/jobs";
import { auth } from "@/lib/auth";
import { aiAvailable, writingProvider } from "@/providers/ai";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const obj = (v: unknown) => v as Prisma.InputJsonValue;
const docInput = z.object({
  title: z.string().trim().min(1).max(160),
  kind: z.enum(["CV", "LETTER"]),
  templateId: z.string().max(100),
  data: documentSchema,
  revision: z.number().int().positive().optional(),
});
const jobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().max(200).default(""),
  country: z.string().max(120).default(""),
  arrangement: z.string().max(80).default(""),
  employmentType: z.string().max(80).default(""),
  seniority: z.string().max(80).default(""),
  salary: z.string().max(120).default(""),
  description: z.string().min(1).max(30000),
  url: urlSchema.refine(Boolean),
  active: z.boolean().default(true),
  expiresAt: z.string().nullable().optional(),
});
async function handle(
  req: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const requestId = randomUUID();
  try {
    sameOrigin(req);
    const path = (await params).path ?? [],
      [resource, id, action] = path;
    const method = req.method;
    const u = new URL(req.url),
      q = u.searchParams.get("q")?.slice(0, 160) ?? "";
    const page = Math.max(
      1,
      Math.min(10000, Number(u.searchParams.get("page")) || 1),
    );
    const take = 30,
      skip = (page - 1) * take;
    const body = async () => {
      if (Number(req.headers.get("content-length") ?? 0) > 250000)
        throw new HttpError(413, "Request too large");
      return req.json() as Promise<unknown>;
    };
    if (resource === "health") {
      await db.$queryRaw`SELECT 1`;
      return json({ status: "ok", version: "1.0.0" });
    }
    if (resource === "config" && method === "GET") {
      const s = await settings();
      return json({
        ...s,
        googleAvailable:
          s.google &&
          Boolean(
            process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
          ),
        smtpAvailable: smtpReady(),
        aiAvailable: s.ai && aiAvailable(),
      });
    }
    if (resource === "templates" && method === "GET")
      return json(
        await db.template.findMany({
          where: { active: true },
          orderBy: { position: "asc" },
        }),
      );
    if (resource === "recovery" && method === "POST") {
      limit(`recovery:${ipKey(req)}`, 5, 15 * 60000);
      const input = z.object({ email: z.email() }).parse(await body());
      void requestReset(input.email).catch(() => {});
      return json({
        message:
          "Jika akun mendukung pemulihan email, instruksi akan dikirim. Periksa juga folder spam.",
      });
    }
    if (resource === "reset-password" && method === "POST") {
      limit(`reset:${ipKey(req)}`, 10, 15 * 60000);
      const b = z
        .object({
          token: z.string().length(64),
          password: z.string().min(12).max(128),
        })
        .parse(await body());
      await consumeReset(b.token, b.password);
      return json({ ok: true });
    }
    if (resource === "jobs" && method === "GET") {
      if (id) {
        const job = await db.job.findFirst({
          where: {
            id,
            active: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        });
        if (!job) throw new HttpError(404, "Lowongan tidak ditemukan.");
        return json(job);
      }
      const where: Prisma.JobWhereInput = {
        active: true,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          q
            ? {
                OR: ["title", "company", "location"].map((k) => ({
                  [k]: { contains: q, mode: "insensitive" },
                })),
              }
            : {},
        ],
      };
      for (const field of [
        "location",
        "country",
        "arrangement",
        "employmentType",
        "seniority",
        "source",
      ] as const) {
        const value = u.searchParams.get(field);
        if (value)
          where[field] = { contains: value.slice(0, 100), mode: "insensitive" };
      }
      const days = Number(u.searchParams.get("days"));
      if (days > 0)
        where.postedAt = {
          gte: new Date(Date.now() - Math.min(days, 365) * 86400000),
        };
      const [items, total] = await Promise.all([
        db.job.findMany({ where, orderBy: { syncedAt: "desc" }, take, skip }),
        db.job.count({ where }),
      ]);
      return json({ items, total, page });
    }
    const user = await currentUser(req);
    limit(`api:${user.id}`, 180);
    const site = await settings();
    if (site.maintenance && user.role !== "SUPER_ADMIN")
      throw new HttpError(503, site.maintenanceMessage);
    if (resource === "me") {
      if (method === "GET")
        return json({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
          permissions: user.permissions,
          locale: user.locale,
          defaultTemplateId: user.defaultTemplateId,
        });
      if (method === "PATCH") {
        const b = z
          .object({
            name: z.string().min(1).max(150),
            locale: z.enum(["id", "en"]),
            defaultTemplateId: z.string().max(100).nullable().optional(),
          })
          .parse(await body());
        if (
          b.defaultTemplateId &&
          !(await db.template.findFirst({
            where: { id: b.defaultTemplateId, active: true },
          }))
        )
          throw new HttpError(400, "Template tidak tersedia.");
        await db.user.update({ where: { id: user.id }, data: b });
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const b = z
          .object({
            password: z.string().min(1),
            confirmation: z.literal("DELETE"),
          })
          .parse(await body());
        const { verifyPassword } = await import("better-auth/crypto");
        const account = await db.account.findFirst({
          where: { userId: user.id, providerId: "credential" },
        });
        if (
          !account?.password ||
          !(await verifyPassword({
            hash: account.password,
            password: b.password,
          }))
        )
          throw new HttpError(
            403,
            "Kata sandi tidak sesuai. Akun Google dapat meminta penghapusan melalui Support.",
          );
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(31035)::text`;
          if (
            user.role === "SUPER_ADMIN" &&
            (await tx.user.count({
              where: { role: "SUPER_ADMIN", suspended: false },
            })) <= 1
          )
            throw new HttpError(
              409,
              "Super Admin terakhir tidak dapat dihapus.",
            );
          await tx.recoveryToken.deleteMany({ where: { userId: user.id } });
          await tx.user.delete({ where: { id: user.id } });
        });
        return json({ ok: true });
      }
    }
    if (resource === "data-export" && method === "GET") {
      const data = {
        user: { name: user.name, email: user.email, createdAt: user.createdAt },
        profile: await db.profile.findUnique({ where: { userId: user.id } }),
        documents: await db.document.findMany({
          where: { userId: user.id },
          include: { versions: true },
        }),
        applications: await db.application.findMany({
          where: { userId: user.id },
        }),
        savedJobs: await db.savedJob.findMany({
          where: { userId: user.id },
          include: { job: true },
        }),
        tickets: await db.supportTicket.findMany({
          where: { userId: user.id },
        }),
      };
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="lamariva-data.json"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (resource === "dashboard" && method === "GET") {
      const [cvs, letters, saved, applications, recent, profile, followups] =
        await Promise.all([
          db.document.count({ where: { userId: user.id, kind: "CV" } }),
          db.document.count({ where: { userId: user.id, kind: "LETTER" } }),
          db.savedJob.count({ where: { userId: user.id } }),
          db.application.count({ where: { userId: user.id } }),
          db.document.findMany({
            where: { userId: user.id },
            select: {
              id: true,
              title: true,
              kind: true,
              updatedAt: true,
              templateId: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 6,
          }),
          db.profile.findUnique({ where: { userId: user.id } }),
          db.application.findMany({
            where: {
              userId: user.id,
              followUpDate: {
                not: "",
                lte: new Date().toISOString().slice(0, 10),
              },
              status: { notIn: ["Hired", "Rejected", "Withdrawn"] },
            },
            take: 10,
          }),
        ]);
      return json({
        cvs,
        letters,
        saved,
        applications,
        recent,
        profile: profile?.data ?? emptyProfile(user.name, user.email),
        followups,
      });
    }
    if (resource === "profile") {
      if (method === "GET")
        return json(
          (await db.profile.findUnique({ where: { userId: user.id } }))?.data ??
            emptyProfile(user.name, user.email),
        );
      if (method === "PUT") {
        const data = obj(profileSchema.parse(await body()));
        await db.profile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, data },
          update: { data },
        });
        return json({ ok: true });
      }
    }
    if (resource === "documents") {
      if (!id && method === "GET") {
        const kind = u.searchParams.get("kind") === "LETTER" ? "LETTER" : "CV";
        const where = {
          userId: user.id,
          kind,
          title: { contains: q, mode: "insensitive" as const },
        };
        return json({
          items: await db.document.findMany({
            where,
            select: {
              id: true,
              title: true,
              kind: true,
              templateId: true,
              revision: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take,
            skip,
          }),
          total: await db.document.count({ where }),
          page,
        });
      }
      if (!id && method === "POST") {
        const b = docInput.parse(await body());
        if ((await db.document.count({ where: { userId: user.id } })) >= 500)
          throw new HttpError(409, "Batas 500 dokumen per akun tercapai.");
        if (
          !(await db.template.findFirst({
            where: { id: b.templateId, active: true },
          }))
        )
          throw new HttpError(400, "Template tidak tersedia.");
        return json(
          await db.document.create({
            data: {
              userId: user.id,
              title: b.title,
              kind: b.kind,
              templateId: b.templateId,
              data: obj(b.data),
            },
          }),
          201,
        );
      }
      const document = await db.document.findFirst({
        where: { id, userId: user.id },
      });
      if (!document) throw new HttpError(404, "Dokumen tidak ditemukan.");
      if (action === "versions" && method === "GET")
        return json(
          await db.documentVersion.findMany({
            where: { documentId: document.id },
            select: { id: true, revision: true, title: true, createdAt: true },
            orderBy: { revision: "desc" },
            take: 30,
          }),
        );
      if (action === "restore" && method === "POST") {
        const b = z
          .object({ versionId: z.string(), revision: z.number().int() })
          .parse(await body());
        const version = await db.documentVersion.findFirst({
          where: { id: b.versionId, documentId: document.id },
        });
        if (!version) throw new HttpError(404, "Versi tidak ditemukan.");
        return json(
          await db.$transaction(async (tx) => {
            const changed = await tx.document.updateMany({
              where: { id: document.id, userId: user.id, revision: b.revision },
              data: {
                title: version.title,
                templateId: version.templateId,
                data: obj(version.data),
                revision: { increment: 1 },
              },
            });
            if (!changed.count)
              throw new HttpError(
                409,
                "Dokumen berubah. Muat ulang sebelum memulihkan.",
              );
            await tx.documentVersion.create({
              data: {
                documentId: document.id,
                revision: document.revision,
                title: document.title,
                templateId: document.templateId,
                data: obj(document.data),
              },
            });
            return tx.document.findUnique({ where: { id: document.id } });
          }),
        );
      }
      if (action === "duplicate" && method === "POST")
        return json(
          await db.document.create({
            data: {
              userId: user.id,
              title: `${document.title} (salinan)`,
              kind: document.kind,
              templateId: document.templateId,
              data: obj(document.data),
            },
          }),
          201,
        );
      if (action === "export" && method === "GET") {
        limit(`export:${user.id}`, 12);
        const format = u.searchParams.get("format") === "docx" ? "docx" : "pdf";
        const data = documentSchema.parse(document.data);
        const template = await db.template.findUnique({
          where: { id: document.templateId },
        });
        const cfg = template?.config as RenderConfig | undefined;
        const buffer =
          format === "pdf"
            ? await exportPDF(data, document.kind, document.templateId, cfg)
            : await exportDOCX(data, document.kind, document.templateId, cfg);
        if (!u.searchParams.has("preview"))
          await db.documentExport.create({
            data: { userId: user.id, documentId: document.id, format },
          });
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              format === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `${u.searchParams.has("preview") ? "inline" : "attachment"}; filename="${document.kind === "CV" ? "CV" : "Cover-Letter"}.${format}"`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (!action && method === "GET") return json(document);
      if (!action && method === "PUT") {
        const b = docInput.parse(await body());
        if (b.kind !== document.kind)
          throw new HttpError(400, "Jenis dokumen tidak dapat diubah.");
        if (
          b.templateId !== document.templateId &&
          !(await db.template.findFirst({
            where: { id: b.templateId, active: true },
          }))
        )
          throw new HttpError(400, "Template tidak tersedia.");
        return json(
          await db.$transaction(async (tx) => {
            const result = await tx.document.updateMany({
              where: {
                id: document.id,
                userId: user.id,
                revision: b.revision ?? 0,
              },
              data: {
                title: b.title,
                templateId: b.templateId,
                data: obj(b.data),
                revision: { increment: 1 },
              },
            });
            if (!result.count)
              throw new HttpError(
                409,
                "Dokumen berubah di tab lain. Salin perubahan Anda, lalu muat ulang.",
              );
            await tx.documentVersion.create({
              data: {
                documentId: document.id,
                revision: document.revision,
                title: document.title,
                templateId: document.templateId,
                data: obj(document.data),
              },
            });
            await tx.documentVersion.deleteMany({
              where: {
                documentId: document.id,
                revision: { lt: Math.max(0, document.revision - 29) },
              },
            });
            return tx.document.findUnique({ where: { id: document.id } });
          }),
        );
      }
      if (!action && method === "DELETE") {
        await db.document.delete({ where: { id: document.id } });
        return json({ ok: true });
      }
    }
    if (resource === "generate-letter" && method === "POST") {
      const data = documentSchema.parse(await body());
      if (!data.company || !data.jobTitle || !data.profile.name)
        throw new HttpError(400, "Isi nama, perusahaan, dan posisi tujuan.");
      return json({
        body: generateLetter(data, {
          opening:
            data.language === "id"
              ? site.letterOpeningId
              : site.letterOpeningEn,
          closing:
            data.language === "id"
              ? site.letterClosingId
              : site.letterClosingEn,
        }),
      });
    }
    if (resource === "writing-assistant" && method === "POST") {
      if (!site.ai || !aiAvailable())
        throw new HttpError(
          503,
          "AI belum tersedia. Gunakan generator standar.",
        );
      limit(`ai:${user.id}`, 5, 3600000);
      const b = z
        .object({
          data: documentSchema,
          task: z.enum(["grammar", "concise", "professional"]),
          consent: z.literal(true),
        })
        .parse(await body());
      const p = b.data.profile;
      const facts = JSON.stringify({
        summary: p.summary,
        headline: p.headline,
        sections: p.sections,
      });
      const instructions = {
        grammar: "Correct grammar without changing facts.",
        concise: "Shorten the text while preserving important facts.",
        professional: "Use a clear professional tone without adding claims.",
      };
      const result = await writingProvider().rewrite({
        text: b.data.body || p.summary,
        facts,
        instruction: instructions[b.task],
        language: b.data.language,
      });
      await db.auditLog.create({
        data: {
          actorId: user.id,
          action: "AI_CONSENT_AND_REQUEST",
          target: b.task,
          reason: "User explicitly consented to share text and profile facts.",
        },
      });
      return json({ text: result });
    }
    if (resource === "quality" && method === "POST") {
      const b = documentSchema.parse(await body());
      return json(quality(b.profile, b.jobDescription));
    }
    if (resource === "saved-jobs") {
      if (method === "GET")
        return json(
          await db.savedJob.findMany({
            where: { userId: user.id },
            include: { job: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        );
      if (method === "POST") {
        const b = z.object({ jobId: z.string() }).parse(await body());
        if (!(await db.job.findFirst({ where: { id: b.jobId, active: true } })))
          throw new HttpError(404, "Lowongan tidak tersedia.");
        return json(
          await db.savedJob.upsert({
            where: { userId_jobId: { userId: user.id, jobId: b.jobId } },
            create: { userId: user.id, jobId: b.jobId },
            update: {},
          }),
        );
      }
      if (method === "DELETE") {
        await db.savedJob.deleteMany({ where: { userId: user.id, jobId: id } });
        return json({ ok: true });
      }
    }
    if (resource === "applications") {
      if (!site.tracker)
        throw new HttpError(403, "Application Tracker dinonaktifkan.");
      if (method === "GET") {
        const where = {
          userId: user.id,
          ...(q
            ? {
                OR: [
                  { company: { contains: q, mode: "insensitive" as const } },
                  { title: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        };
        return json({
          items: await db.application.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            take: 100,
          }),
          total: await db.application.count({ where }),
        });
      }
      if (method === "POST" || method === "PUT") {
        const data = applicationSchema.parse(await body());
        for (const [ref, kind] of [
          [data.cvId, "CV"],
          [data.letterId, "LETTER"],
        ])
          if (
            ref &&
            !(await db.document.findFirst({
              where: { id: ref, userId: user.id, kind: kind! },
            }))
          )
            throw new HttpError(400, "Dokumen terkait tidak valid.");
        if (method === "POST")
          return json(
            await db.application.create({ data: { ...data, userId: user.id } }),
            201,
          );
        const result = await db.application.updateMany({
          where: { id, userId: user.id },
          data,
        });
        if (!result.count) throw new HttpError(404, "Lamaran tidak ditemukan.");
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await db.application.deleteMany({ where: { id, userId: user.id } });
        return json({ ok: true });
      }
    }
    if (resource === "support") {
      if (method === "GET")
        return json(
          await db.supportTicket.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: "desc" },
            take: 50,
          }),
        );
      if (method === "POST") {
        limit(`support:${user.id}`, 5, 3600000);
        const b = z
          .object({
            subject: z.string().min(3).max(160),
            message: z.string().min(10).max(6000),
          })
          .parse(await body());
        return json(
          await db.supportTicket.create({ data: { ...b, userId: user.id } }),
          201,
        );
      }
    }
    if (resource === "admin") {
      const admin = await adminUser(
        req,
        id === "sync" ? "providers" : (id ?? "overview"),
        method !== "GET",
      );
      if (id === "overview" && method === "GET") {
        const [
          users,
          verified,
          cvs,
          letters,
          downloads,
          jobs,
          sessions,
          events,
          providers,
        ] = await Promise.all([
          db.user.count(),
          db.user.count({ where: { emailVerified: true } }),
          db.document.count({ where: { kind: "CV" } }),
          db.document.count({ where: { kind: "LETTER" } }),
          db.documentExport.count(),
          db.job.count({ where: { active: true } }),
          db.session.count({ where: { expiresAt: { gt: new Date() } } }),
          db.systemEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
          db.jobProvider.findMany(),
        ]);
        return json({
          users,
          verified,
          cvs,
          letters,
          downloads,
          jobs,
          sessions,
          events,
          providers,
          smtp: smtpReady(),
          version: "1.0.0",
          uptime: Math.round(process.uptime()),
          memoryMB: Math.round(process.memoryUsage().rss / 1048576),
        });
      }
      if (id === "users") {
        if (method === "GET") {
          const where = q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {};
          return json({
            items: await db.user.findMany({
              where,
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                permissions: true,
                suspended: true,
                emailVerified: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take,
              skip,
            }),
            total: await db.user.count({ where }),
            page,
          });
        }
        if (method === "PATCH") {
          if (admin.role !== "SUPER_ADMIN")
            throw new HttpError(
              403,
              "Hanya Super Admin yang dapat mengubah peran.",
            );
          const b = z
            .object({
              id: z.string(),
              role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
              permissions: z
                .array(
                  z.enum([
                    "overview",
                    "users",
                    "templates",
                    "providers",
                    "jobs",
                    "settings",
                    "audit",
                    "support",
                    "email",
                  ]),
                )
                .max(10),
              suspended: z.boolean(),
              reason: z.string().min(5).max(500),
            })
            .parse(await body());
          await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(31035)::text`;
            const target = await tx.user.findUniqueOrThrow({
              where: { id: b.id },
            });
            if (
              target.role === "SUPER_ADMIN" &&
              (b.role !== "SUPER_ADMIN" || b.suspended) &&
              (await tx.user.count({
                where: { role: "SUPER_ADMIN", suspended: false },
              })) <= 1
            )
              throw new HttpError(
                409,
                "Super Admin terakhir harus tetap aktif.",
              );
            await tx.user.update({
              where: { id: b.id },
              data: {
                role: b.role,
                permissions: b.permissions,
                suspended: b.suspended,
              },
            });
            await tx.session.deleteMany({ where: { userId: b.id } });
            await tx.auditLog.create({
              data: {
                actorId: admin.id,
                action: "USER_UPDATE",
                target: b.id,
                reason: b.reason,
              },
            });
          });
          return json({ ok: true });
        }
        if (method === "POST") {
          const b = z
            .object({
              id: z.string(),
              action: z.enum(["revoke", "reset", "delete"]),
              reason: z.string().min(5).max(500),
            })
            .parse(await body());
          const target = await db.user.findUniqueOrThrow({
            where: { id: b.id },
          });
          if (b.action === "delete") {
            if (admin.role !== "SUPER_ADMIN")
              throw new HttpError(
                403,
                "Hanya Super Admin dapat menghapus akun.",
              );
            await db.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT pg_advisory_xact_lock(31035)::text`;
              if (
                target.role === "SUPER_ADMIN" &&
                (await tx.user.count({
                  where: { role: "SUPER_ADMIN", suspended: false },
                })) <= 1
              )
                throw new HttpError(
                  409,
                  "Super Admin terakhir tidak dapat dihapus.",
                );
              await tx.recoveryToken.deleteMany({
                where: { userId: target.id },
              });
              await tx.user.delete({ where: { id: target.id } });
              await tx.auditLog.create({
                data: {
                  actorId: admin.id,
                  action: "USER_DELETE",
                  target: target.id,
                  reason: b.reason,
                },
              });
            });
            return json({ ok: true });
          }
          if (b.action === "revoke")
            await db.session.deleteMany({ where: { userId: b.id } });
          else await requestReset(target.email);
          await audit(
            admin.id,
            `USER_${b.action.toUpperCase()}`,
            b.id,
            b.reason,
          );
          return json({ ok: true });
        }
      }
      if (id === "templates") {
        if (method === "GET")
          return json(
            await db.template.findMany({ orderBy: { position: "asc" } }),
          );
        if (method === "PUT") {
          const b = z
            .object({
              id: z.string().max(100),
              name: z.string().min(1).max(120),
              active: z.boolean(),
              ats: z.boolean(),
              isDefault: z.boolean(),
              position: z.number().int().min(0),
              config: z.object({
                font: z.enum(["Helvetica", "Times-Roman"]),
                accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
                header: z.enum(["left", "center"]),
              }),
            })
            .parse(await body());
          await db.$transaction(async (tx) => {
            if (b.isDefault && !b.active)
              throw new HttpError(400, "Template default harus aktif.");
            if (b.isDefault)
              await tx.template.updateMany({ data: { isDefault: false } });
            const old = await tx.template.findUniqueOrThrow({
              where: { id: b.id },
            });
            if (old.isDefault && !b.active)
              throw new HttpError(400, "Pilih default lain terlebih dahulu.");
            await tx.template.update({
              where: { id: b.id },
              data: { ...b, version: { increment: 1 } },
            });
            await tx.auditLog.create({
              data: {
                actorId: admin.id,
                action: "TEMPLATE_UPDATE",
                target: b.id,
              },
            });
          });
          return json({ ok: true });
        }
      }
      if (id === "settings") {
        if (method === "GET") return json(site);
        if (method === "PUT") {
          if (admin.role !== "SUPER_ADMIN")
            throw new HttpError(403, "Hanya Super Admin.");
          const b = settingsSchema.parse(await body());
          await db.$transaction([
            db.setting.upsert({
              where: { key: "site" },
              create: { key: "site", value: obj(b) },
              update: { value: obj(b) },
            }),
            db.auditLog.create({
              data: {
                actorId: admin.id,
                action: "SETTINGS_UPDATE",
                target: "site",
              },
            }),
          ]);
          return json({ ok: true });
        }
      }
      if (id === "providers") {
        if (method === "GET")
          return json(
            await db.jobProvider.findMany({ orderBy: { createdAt: "desc" } }),
          );
        if (method === "POST" || method === "PUT") {
          const b = z
            .object({
              id: z.string().optional(),
              kind: z.enum(["greenhouse", "lever", "remotive"]),
              source: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
              active: z.boolean(),
              intervalHours: z.number().int().min(6).max(168),
            })
            .parse(await body());
          const { id: providerId, ...data } = b;
          const result = providerId
            ? await db.jobProvider.update({ where: { id: providerId }, data })
            : await db.jobProvider.create({ data });
          if (!data.active)
            await db.job.updateMany({
              where: { providerId: result.id },
              data: { active: false },
            });
          await audit(admin.id, "PROVIDER_UPDATE", result.id);
          return json(result);
        }
      }
      if (id === "sync" && method === "POST") {
        const b = z.object({ id: z.string() }).parse(await body());
        await audit(admin.id, "PROVIDER_SYNC", b.id);
        const count = await syncProvider(b.id);
        return json({ count });
      }
      if (id === "jobs") {
        if (method === "GET")
          return json({
            items: await db.job.findMany({
              where: q ? { title: { contains: q, mode: "insensitive" } } : {},
              orderBy: { syncedAt: "desc" },
              take,
              skip,
            }),
            total: await db.job.count(),
            page,
          });
        if (method === "POST") {
          const b = jobSchema.parse(await body());
          const row = await db.job.create({
            data: {
              ...b,
              expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
              externalId: randomUUID(),
              source: "Manual",
              postedAt: new Date(),
            },
          });
          await audit(admin.id, "JOB_CREATE", row.id);
          return json(row, 201);
        }
        if (method === "PUT") {
          const raw = z
            .object({ id: z.string(), job: jobSchema })
            .parse(await body());
          const row = await db.job.update({
            where: { id: raw.id },
            data: {
              ...raw.job,
              expiresAt: raw.job.expiresAt ? new Date(raw.job.expiresAt) : null,
            },
          });
          await audit(admin.id, "JOB_UPDATE", row.id);
          return json(row);
        }
      }
      if (id === "audit" && method === "GET")
        return json({
          items: await db.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take,
            skip,
          }),
          total: await db.auditLog.count(),
          page,
        });
      if (id === "support") {
        if (method === "GET")
          return json(
            await db.supportTicket.findMany({
              include: { user: { select: { name: true, email: true } } },
              orderBy: { updatedAt: "desc" },
              take: 100,
            }),
          );
        if (method === "PUT") {
          const b = z
            .object({
              id: z.string(),
              reply: z.string().max(6000),
              status: z.enum(["OPEN", "CLOSED"]),
            })
            .parse(await body());
          await db.supportTicket.update({
            where: { id: b.id },
            data: { reply: b.reply, status: b.status },
          });
          await audit(admin.id, "SUPPORT_REPLY", b.id);
          return json({ ok: true });
        }
      }
      if (id === "email" && method === "POST") {
        await sendMail(
          admin.email,
          "Lamariva SMTP test",
          "Pengiriman SMTP Lamariva berhasil.",
        );
        await audit(admin.id, "SMTP_TEST", "self");
        return json({ ok: true });
      }
    }
    throw new HttpError(404, "Endpoint tidak ditemukan.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
          requestId,
        },
        400,
      );
    if (e instanceof HttpError)
      return json({ error: e.message, requestId }, e.status);
    if (e instanceof Error && e.message === "RENDER_BUSY")
      return json(
        {
          error: "Ekspor lain sedang diproses. Coba lagi sebentar.",
          requestId,
        },
        429,
      );
    console.error(
      JSON.stringify({
        requestId,
        path: new URL(req.url).pathname,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
    );
    return json(
      {
        error: "Permintaan belum berhasil. Coba lagi atau hubungi Support.",
        requestId,
      },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
