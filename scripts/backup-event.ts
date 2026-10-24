import "dotenv/config";
import { db } from "../src/lib/db";
import { sendMail } from "../src/lib/mail";
const status = process.argv[2] === "OK" ? "OK" : "ERROR";
try {
  await db.systemEvent.create({
    data: {
      kind: "BACKUP",
      status,
      message:
        status === "OK"
          ? "Encrypted backup created. Restore verification is separate."
          : "Backup failed. Inspect restricted server logs.",
    },
  });
  if (status === "ERROR" && process.env.BACKUP_NOTIFY_EMAIL)
    await sendMail(
      process.env.BACKUP_NOTIFY_EMAIL,
      "Lamariva backup failed",
      "A scheduled backup failed. Inspect the backup job on the VPS.",
    );
} finally {
  await db.$disconnect();
}
