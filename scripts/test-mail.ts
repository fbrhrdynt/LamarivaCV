import { SMTPServer } from "smtp-server";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("storage/test-mail", { recursive: true });
const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, session, callback) {
    let message = "";
    stream.on("data", (d) => {
      message += d.toString();
    });
    stream.on("end", () => {
      writeFile(
        `storage/test-mail/${Date.now()}-${Math.random().toString(36).slice(2)}.eml`,
        message,
      )
        .then(() => callback())
        .catch(callback);
    });
  },
});
server.listen(2525, "127.0.0.1", () =>
  console.log("Local test mailbox on port 2525"),
);
