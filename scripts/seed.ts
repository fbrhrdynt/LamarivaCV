import "dotenv/config";
import { db } from "../src/lib/db";
import { templates } from "../src/lib/model";
import { settingsSchema } from "../src/lib/settings";
async function main() {
  for (const [i, t] of templates.entries())
    await db.template.upsert({
      where: { id: t.id },
      create: { ...t, position: i, isDefault: i === 0 },
      update: {},
    });
  await db.setting.upsert({
    where: { key: "site" },
    create: { key: "site", value: settingsSchema.parse({}) },
    update: {},
  });
  console.log(
    "Templates and settings initialized. No demo users or jobs created.",
  );
}
main().finally(() => db.$disconnect());
