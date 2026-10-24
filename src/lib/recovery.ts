import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "./db";
import { sendMail } from "./mail";
import { HttpError } from "./security";
import { settings } from "./settings";
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
export async function requestReset(email: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) return;
  const account = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!account) {
    await sendMail(
      email,
      "Pemulihan akun Lamariva",
      "Akun ini menggunakan Google. Gunakan tombol Google untuk masuk dan pemulihan akun Google bila diperlukan.",
    );
    return;
  }
  const token = randomBytes(32).toString("hex");
  await db.$transaction([
    db.recoveryToken.deleteMany({ where: { userId: user.id, kind: "RESET" } }),
    db.recoveryToken.create({
      data: {
        userId: user.id,
        kind: "RESET",
        hash: digest(token),
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
    }),
  ]);
  await sendMail(
    email,
    (await settings()).resetSubject,
    `Tautan ini berlaku 15 menit dan hanya dapat digunakan sekali:\n${process.env.APP_URL}/reset-password?token=${token}\n\nAbaikan jika Anda tidak meminta perubahan.`,
  );
}
export async function consumeReset(token: string, password: string) {
  const hash = await hashPassword(password);
  await db
    .$transaction(async (tx) => {
      const t = await tx.recoveryToken.findUnique({
        where: { hash: digest(token) },
      });
      if (!t || t.kind !== "RESET" || t.expiresAt < new Date())
        throw new HttpError(
          400,
          "Tautan reset tidak valid atau sudah kedaluwarsa.",
        );
      const deleted = await tx.recoveryToken.deleteMany({
        where: { id: t.id, expiresAt: { gt: new Date() } },
      });
      if (!deleted.count) throw new HttpError(400, "Tautan sudah digunakan.");
      await tx.account.updateMany({
        where: { userId: t.userId, providerId: "credential" },
        data: { password: hash },
      });
      await tx.session.deleteMany({ where: { userId: t.userId } });
      const u = await tx.user.findUniqueOrThrow({ where: { id: t.userId } });
      await tx.systemEvent.create({
        data: {
          kind: "SECURITY",
          status: "OK",
          message: "Password reset completed",
        },
      });
      return u;
    })
    .then(async (u) =>
      sendMail(
        u.email,
        (await settings()).securitySubject,
        "Kata sandi Lamariva Anda telah diubah. Semua sesi telah dikeluarkan.",
      ).catch(() => {}),
    );
}
