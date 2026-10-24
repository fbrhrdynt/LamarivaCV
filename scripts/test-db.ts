import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const db = new PGlite("./.test-pg");
await db.waitReady;
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 55435 });
await server.start();
console.log(
  "Disposable PostgreSQL-compatible test database ready on 127.0.0.1:55435",
);
process.on("SIGTERM", async () => {
  await server.stop();
  await db.close();
  process.exit();
});
