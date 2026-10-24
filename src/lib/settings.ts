import { db } from "./db";
import { z } from "zod";
export const settingsSchema = z.object({
  name: z.string().min(1).max(60).default("Lamariva"),
  headline: z
    .string()
    .max(160)
    .default("Satu profil. Lamaran yang lebih terarah."),
  description: z
    .string()
    .max(300)
    .default(
      "Susun CV, tulis surat lamaran, dan catat proses melamar dalam satu tempat.",
    ),
  contact: z.union([z.literal(""), z.email()]).default(""),
  registrations: z.boolean().default(true),
  google: z.boolean().default(true),
  tracker: z.boolean().default(true),
  ai: z.boolean().default(false),
  maintenance: z.boolean().default(false),
  maintenanceMessage: z
    .string()
    .max(300)
    .default(
      "Pemeliharaan sedang berlangsung. Silakan kembali beberapa saat lagi.",
    ),
  announcement: z.string().max(500).default(""),
  defaultLanguage: z.enum(["id", "en"]).default("id"),
  footer: z.string().max(180).default("© 2026 LogiSource Digital"),
  privacy: z.string().max(20000).default(""),
  terms: z.string().max(20000).default(""),
  pages: z
    .partialRecord(
      z.enum(["about", "features", "faq", "help", "contact", "cover-letter"]),
      z.string().max(20000),
    )
    .optional(),
  verificationSubject: z.string().max(140).default("Verifikasi email Lamariva"),
  resetSubject: z.string().max(140).default("Reset kata sandi Lamariva"),
  securitySubject: z.string().max(140).default("Kata sandi telah diubah"),
  emailFooter: z.string().max(1000).default(""),
  letterOpeningId: z
    .string()
    .max(1000)
    .default("Saya mengajukan lamaran untuk posisi {jobTitle} di {company}."),
  letterOpeningEn: z
    .string()
    .max(1000)
    .default("I am applying for the {jobTitle} position at {company}."),
  letterClosingId: z
    .string()
    .max(1000)
    .default(
      "Saya terbuka untuk mendiskusikan kesesuaian pengalaman saya dengan kebutuhan tim. Terima kasih atas waktu dan pertimbangannya.",
    ),
  letterClosingEn: z
    .string()
    .max(1000)
    .default(
      "I would welcome a conversation about how my experience fits your team’s needs. Thank you for your time and consideration.",
    ),
});
export async function settings() {
  const row = await db.setting.findUnique({ where: { key: "site" } });
  return settingsSchema.parse(row?.value ?? {});
}
export async function audit(
  actorId: string,
  action: string,
  target: string,
  reason = "",
) {
  await db.auditLog.create({ data: { actorId, action, target, reason } });
}
