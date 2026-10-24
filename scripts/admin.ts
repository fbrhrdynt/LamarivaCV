import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { z } from "zod";
async function main() {
  const email = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
  const password = z
    .string()
    .min(16)
    .max(128)
    .parse(process.env.ADMIN_PASSWORD);
  const name = z
    .string()
    .min(1)
    .parse(process.env.ADMIN_NAME ?? "Owner");
  if (await db.user.findUnique({ where: { email } }))
    throw new Error(
      "Account already exists. This command never overwrites existing accounts.",
    );
  const id = randomUUID();
  const hash = await hashPassword(password);
  await db.$transaction([
    db.user.create({
      data: {
        id,
        name,
        email,
        emailVerified: true,
        role: "SUPER_ADMIN",
        consentAt: new Date(),
      },
    }),
    db.account.create({
      data: {
        userId: id,
        providerId: "credential",
        accountId: id,
        password: hash,
      },
    }),
    db.auditLog.create({
      data: {
        actorId: id,
        action: "OWNER_BOOTSTRAP",
        target: id,
        reason: "Server-side owner bootstrap",
      },
    }),
  ]);
  console.log(
    "Super Admin created. Clear ADMIN_PASSWORD from the environment.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
