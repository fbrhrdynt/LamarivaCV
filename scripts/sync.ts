import "dotenv/config";
import { db } from "../src/lib/db";
import { syncProvider } from "../src/providers/jobs";
async function main() {
  if (process.env.JOB_SYNC_ENABLED !== "true") return;
  const providers = await db.jobProvider.findMany({ where: { active: true } });
  for (const p of providers)
    if (
      !p.lastSyncAt ||
      Date.now() - p.lastSyncAt.getTime() >= p.intervalHours * 3600000
    ) {
      try {
        await syncProvider(p.id);
      } catch {
        console.error(`Sync failed: ${p.id}. See admin events.`);
      }
    }
  await db.job.updateMany({
    where: { expiresAt: { lt: new Date() } },
    data: { active: false },
  });
  await db.recoveryToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
main().finally(() => db.$disconnect());
