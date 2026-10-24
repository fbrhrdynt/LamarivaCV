import nodemailer from "nodemailer";
import { db } from "./db";
import { settings } from "./settings";
export const smtpReady = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
export async function sendMail(to: string, subject: string, body: string) {
  if (!smtpReady()) throw new Error("SMTP is not configured");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    const footer = (await settings()).emailFooter;
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text: body + (footer ? "\n\n" + footer : ""),
    });
    await db.systemEvent.create({
      data: { kind: "EMAIL", status: "OK", message: subject },
    });
  } catch (error) {
    await db.systemEvent.create({
      data: {
        kind: "EMAIL",
        status: "ERROR",
        message:
          "SMTP delivery failed. Check credentials, network and sender settings.",
      },
    });
    throw error;
  }
}
