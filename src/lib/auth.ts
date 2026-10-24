import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "./db";
import { sendMail } from "./mail";
import { settings } from "./settings";
export const auth = betterAuth({
  appName: "Lamariva",
  baseURL: process.env.APP_URL ?? "http://localhost:3035",
  secret: process.env.AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: {
    database: { generateId: "uuid" },
    useSecureCookies: process.env.APP_URL?.startsWith("https://"),
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    autoSignIn: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: 3600,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail(
        user.email,
        (await settings()).verificationSubject,
        `Verifikasi alamat email Anda:\n${url}\n\nAbaikan jika Anda tidak mendaftar.`,
      );
    },
  },
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            requireEmailVerification: true,
          },
        }
      : {},
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [],
      disableImplicitLinking: true,
      allowDifferentEmails: false,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "USER", input: false },
      suspended: { type: "boolean", defaultValue: false, input: false },
    },
    deleteUser: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 50,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 4 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && ctx.body?.consent !== true)
        throw new APIError("BAD_REQUEST", {
          message: "Persetujuan Terms dan Privacy diperlukan.",
        });
      if (
        ctx.path === "/sign-in/social" &&
        ctx.body?.provider === "google" &&
        !(await settings()).google
      )
        throw new APIError("FORBIDDEN", {
          message: "Google login is disabled.",
        });
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await settings()).registrations)
            throw new APIError("FORBIDDEN", {
              message: "Registration is closed.",
            });
          return { data: { ...user, consentAt: new Date() } };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const u = await db.user.findUnique({ where: { id: session.userId } });
          if (u?.suspended)
            throw new APIError("FORBIDDEN", { message: "Account suspended." });
          return { data: session };
        },
      },
    },
  },
});
