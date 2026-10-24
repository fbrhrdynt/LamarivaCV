import { auth } from "./auth";
import { db } from "./db";
import { verifyPassword } from "better-auth/crypto";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser(req: Request) {
  const s = await auth.api.getSession({ headers: req.headers });
  if (!s) throw new HttpError(401, "Silakan masuk terlebih dahulu.");
  const user = await db.user.findUnique({ where: { id: s.user.id } });
  if (!user || user.suspended)
    throw new HttpError(403, "Akses akun tidak tersedia.");
  return user;
}
export async function adminUser(
  req: Request,
  permission: string,
  critical = false,
) {
  const user = await currentUser(req);
  if (
    user.role !== "SUPER_ADMIN" &&
    (user.role !== "ADMIN" || !user.permissions.includes(permission))
  )
    throw new HttpError(403, "Akses administrator diperlukan.");
  if (critical) {
    limit(`admin-confirm:${user.id}`, 10, 60000);
    const account = await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    const password = req.headers.get("x-admin-password") ?? "";
    if (
      !account?.password ||
      !(await verifyPassword({ hash: account.password, password }))
    )
      throw new HttpError(
        403,
        "Konfirmasi kata sandi administrator diperlukan.",
      );
  }
  return user;
}
export function sameOrigin(req: Request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const expected = new URL(process.env.APP_URL ?? "http://localhost:3035")
      .origin;
    if (req.headers.get("origin") !== expected)
      throw new HttpError(403, "Request origin is not allowed.");
  }
}
const buckets = new Map<string, { count: number; reset: number }>();
export function limit(key: string, max = 20, windowMs = 60000) {
  const now = Date.now();
  if (buckets.size > 10000)
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  if (++b.count > max)
    throw new HttpError(429, "Terlalu banyak permintaan. Coba lagi sebentar.");
}
export const ipKey = (req: Request) => req.headers.get("x-real-ip") ?? "local";
