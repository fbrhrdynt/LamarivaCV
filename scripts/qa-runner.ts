import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { SMTPServer } from "smtp-server";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const env = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres:test@127.0.0.1:55435/template1",
  APP_URL: "http://127.0.0.1:3035",
  AUTH_SECRET: randomBytes(32).toString("hex"),
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "2525",
  SMTP_SECURE: "false",
  SMTP_FROM: "Lamariva <test@example.test>",
  QA_MODE: "true",
};
await rm("test-results/mail", { recursive: true, force: true });
await mkdir("test-results/mail", { recursive: true });
const database = new PGlite();
await database.waitReady;
for (const entry of (
  await readdir("prisma/migrations", { withFileTypes: true })
)
  .filter((e) => e.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  await database.exec(
    await readFile(`prisma/migrations/${entry.name}/migration.sql`, "utf8"),
  );
}
const server = new PGLiteSocketServer({
  db: database,
  host: "127.0.0.1",
  port: 55435,
  maxConnections: 20,
});
await server.start();
const mail = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, session, cb) {
    let raw = "";
    stream.on("data", (d) => (raw += d.toString()));
    stream.on("end", () => {
      writeFile(
        `test-results/mail/${Date.now()}-${randomBytes(4).toString("hex")}.eml`,
        raw,
      )
        .then(() => cb())
        .catch(cb);
    });
  },
});
await new Promise<void>((resolve) => mail.listen(2525, "127.0.0.1", resolve));
const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn(process.execPath, args, { stdio: "inherit", env });
    p.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Command exited ${code}: ${args.join(" ")}`)),
    );
  });
let next: ReturnType<typeof spawn> | undefined;
try {
  await run(["--import", "tsx", "scripts/seed.ts"]);
  next = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      "3035",
    ],
    { stdio: ["ignore", "pipe", "pipe"], env },
  );
  let logs = "";
  next.stdout?.on("data", (d) => {
    logs += d.toString();
  });
  next.stderr?.on("data", (d) => {
    logs += d.toString();
  });
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch("http://127.0.0.1:3035/api/health");
      if (res.ok) break;
    } catch {}
    if (i === 59) throw new Error("Server not ready: " + logs);
    await new Promise((r) => setTimeout(r, 500));
  }
  try {
    await run([
      "--import",
      "tsx",
      "--test",
      "tests/model.test.ts",
      "tests/integration.test.ts",
    ]);
    await run(["node_modules/@playwright/test/cli.js", "test"]);
  } finally {
    await writeFile("test-results/server.log", logs);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  next?.kill("SIGTERM");
  mail.close();
  await server.stop();
  await database.close();
}
