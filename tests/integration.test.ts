import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { hashPassword } from "better-auth/crypto";
import { createHash, randomUUID } from "node:crypto";
import { emptyProfile, documentSchema } from "../src/lib/model";
import { readdir, readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:3035";
const pass = "QA-only-Password-2026!";
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  extra: Record<string, string> = {},
) {
  return fetch(`${origin}/api/${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
      "x-real-ip": `10.20.1.${Math.floor(Math.random() * 250) + 1}`,
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function makeUser(email: string, role = "USER") {
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name: "QA Test User",
      email,
      emailVerified: true,
      role,
      consentAt: new Date(),
      accounts: {
        create: {
          accountId: id,
          providerId: "credential",
          password: await hashPassword(pass),
        },
      },
    },
  });
  return id;
}
async function login(email: string, password = pass) {
  const r = await call("auth/sign-in/email", "POST", { email, password });
  assert.equal(r.status, 200, await r.clone().text());
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
test(
  "end-to-end APIs: auth, ownership, documents, exports, tracker and RBAC",
  { timeout: 120000 },
  async () => {
    const id = await makeUser("qa-user@example.test");
    await makeUser("qa-other@example.test");
    const owner = await makeUser("qa-owner@example.test", "SUPER_ADMIN");
    const a = await login("qa-user@example.test"),
      b = await login("qa-other@example.test"),
      admin = await login("qa-owner@example.test");
    assert.equal((await call("admin/users", "GET", undefined, a)).status, 403);
    assert.equal((await call("profile", "GET")).status, 401);
    assert.equal(
      (await call("profile", "PUT", {}, a, { Origin: "https://evil.example" }))
        .status,
      403,
    );
    const profile = emptyProfile("QA Test User", "qa-user@example.test");
    profile.headline = "Maintenance Technician";
    profile.phone = "+62 800 TEST";
    profile.summary =
      "QA test fixture. Industrial maintenance and PLC troubleshooting.";
    profile.sections[0].entries.push({
      id: "e1",
      title: "Maintenance Technician",
      organization: "QA Fixture Company",
      location: "Jakarta",
      start: "2020-01",
      end: "2026-01",
      current: false,
      description: "- Inspected 12 test devices.",
    });
    assert.equal((await call("profile", "PUT", profile, a)).status, 200);
    const create = await call(
      "documents",
      "POST",
      {
        title: "QA CV",
        kind: "CV",
        templateId: "ats-standard",
        data: documentSchema.parse({ profile, language: "en" }),
      },
      a,
    );
    assert.equal(create.status, 201, await create.clone().text());
    const doc = await create.json();
    for (const path of [
      `documents/${doc.id}`,
      `documents/${doc.id}/export`,
      `documents/${doc.id}/versions`,
    ])
      assert.equal((await call(path, "GET", undefined, b)).status, 404);
    assert.equal(
      (await call(`documents/${doc.id}`, "PUT", doc, b)).status,
      404,
    );
    const saved = await call(
      `documents/${doc.id}`,
      "PUT",
      { ...doc, title: "QA CV revised" },
      a,
    );
    assert.equal(saved.status, 200, await saved.clone().text());
    const next = await saved.json();
    assert.equal(next.revision, 2);
    assert.equal(
      (await call(`documents/${doc.id}`, "PUT", doc, a)).status,
      409,
    );
    const versions = await (
      await call(`documents/${doc.id}/versions`, "GET", undefined, a)
    ).json();
    assert.equal(versions.length, 1);
    assert.equal(
      (
        await call(
          `documents/${doc.id}/restore`,
          "POST",
          { versionId: versions[0].id, revision: 2 },
          a,
        )
      ).status,
      200,
    );
    const pdf = await call(`documents/${doc.id}/export`, "GET", undefined, a);
    assert.equal(pdf.status, 200, await pdf.clone().text());
    assert.match(pdf.headers.get("content-type") ?? "", /pdf/);
    const word = await call(
      `documents/${doc.id}/export?format=docx`,
      "GET",
      undefined,
      a,
    );
    assert.equal(word.status, 200);
    assert.equal(
      Buffer.from(await word.arrayBuffer())
        .subarray(0, 2)
        .toString(),
      "PK",
    );
    const duplicate = await (
      await call(`documents/${doc.id}/duplicate`, "POST", {}, a)
    ).json();
    assert.notEqual(duplicate.id, doc.id);
    assert.equal(
      (await call(`documents/${duplicate.id}`, "DELETE", undefined, a)).status,
      200,
    );
    const letterData = documentSchema.parse({
      profile,
      company: "QA Employer",
      jobTitle: "Field Technician",
      language: "en",
    });
    const generated = await (
      await call("generate-letter", "POST", letterData, a)
    ).json();
    assert.match(generated.body, /QA Employer/);
    const letter = await (
      await call(
        "documents",
        "POST",
        {
          title: "QA Letter",
          kind: "LETTER",
          templateId: "ats-standard",
          data: { ...letterData, body: generated.body },
        },
        a,
      )
    ).json();
    assert.ok(letter.id);
    const app = await (
      await call(
        "applications",
        "POST",
        {
          company: "QA Employer",
          title: "Field Technician",
          status: "Interested",
          cvId: doc.id,
          letterId: letter.id,
        },
        a,
      )
    ).json();
    assert.ok(app.id);
    assert.equal(
      (
        await call(
          `applications/${app.id}`,
          "PUT",
          { ...app, status: "Interview" },
          a,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          `applications/${app.id}`,
          "PUT",
          { ...app, status: "Hired" },
          b,
        )
      ).status,
      400,
    );
    const protectedEdit = await call(
      "admin/users",
      "PATCH",
      {
        id,
        role: "ADMIN",
        permissions: ["overview"],
        suspended: false,
        reason: "QA permission test",
      },
      admin,
    );
    assert.equal(protectedEdit.status, 403);
    const change = await call(
      "admin/users",
      "PATCH",
      {
        id,
        role: "ADMIN",
        permissions: ["overview"],
        suspended: false,
        reason: "QA permission test",
      },
      admin,
      { "x-admin-password": pass },
    );
    assert.equal(change.status, 200, await change.clone().text());
    assert.equal((await call("me", "GET", undefined, a)).status, 401);
    const again = await login("qa-user@example.test");
    assert.equal(
      (await call("admin/overview", "GET", undefined, again)).status,
      200,
    );
    assert.equal(
      (await call("admin/users", "GET", undefined, again)).status,
      403,
    );
    const last = await call(
      "admin/users",
      "PATCH",
      {
        id: owner,
        role: "USER",
        permissions: [],
        suspended: false,
        reason: "QA last owner test",
      },
      admin,
      { "x-admin-password": pass },
    );
    assert.equal(last.status, 409, await last.clone().text());
    assert.ok(await db.auditLog.count({ where: { action: "USER_UPDATE" } }));
    // Leave a standard account and document available to the browser acceptance suite.
    await db.user.update({
      where: { id },
      data: { role: "USER", permissions: [] },
    });
  },
);
test(
  "email registration and hashed single-use recovery",
  { timeout: 60000 },
  async () => {
    const email = "qa-register@example.test";
    const r = await call("auth/sign-up/email", "POST", {
      name: "QA Registration",
      email,
      password: pass,
      consent: true,
      callbackURL: "/login",
    });
    assert.equal(r.status, 200, await r.clone().text());
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    assert.equal(user.emailVerified, false);
    const files = await readdir("test-results/mail");
    let link = "";
    for (const file of files) {
      const text = (await readFile(`test-results/mail/${file}`, "utf8"))
        .replace(/=\r?\n/g, "")
        .replace(/=3D/g, "=");
      if (text.includes(email) && text.includes("verify-email"))
        link = text.match(/http[^\s]+verify-email[^\s]+/)?.[0] ?? "";
    }
    assert.ok(link, "verification email should contain a link");
    const verify = await fetch(link, { redirect: "manual" });
    assert.ok([200, 302].includes(verify.status), await verify.text());
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { email } })).emailVerified,
      true,
    );
    const cookie = await login(email);
    await call("recovery", "POST", { email });
    let tokenRow = null;
    for (let i = 0; i < 40; i++) {
      tokenRow = await db.recoveryToken.findFirst({
        where: { userId: user.id },
      });
      if (tokenRow) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(tokenRow);
    assert.equal(tokenRow.hash.length, 64);
    let token = "";
    for (let attempt = 0; attempt < 40 && !token; attempt++) {
      for (const file of await readdir("test-results/mail")) {
        const text = (await readFile(`test-results/mail/${file}`, "utf8"))
          .replace(/=\r?\n/g, "")
          .replace(/=3D/g, "=");
        if (text.includes(email)) {
          const candidate = text.match(
            /reset-password\?token=([a-f0-9]{64})/,
          )?.[1];
          if (
            candidate &&
            createHash("sha256").update(candidate).digest("hex") ===
              tokenRow.hash
          )
            token = candidate;
        }
      }
      if (!token) await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(token, "mail must contain the current stored reset token");
    assert.equal(
      createHash("sha256").update(token).digest("hex"),
      tokenRow.hash,
    );
    const reset = await call("reset-password", "POST", {
      token,
      password: pass + "new",
    });
    assert.equal(reset.status, 200, await reset.clone().text());
    assert.equal(
      (await call("reset-password", "POST", { token, password: pass + "new" }))
        .status,
      400,
    );
    assert.equal((await call("me", "GET", undefined, cookie)).status, 401);
    const expired = "a".repeat(64);
    await db.recoveryToken.create({
      data: {
        userId: user.id,
        kind: "RESET",
        hash: createHash("sha256").update(expired).digest("hex"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    assert.equal(
      (await call("reset-password", "POST", { token: expired, password: pass }))
        .status,
      400,
    );
    const known = await (await call("recovery", "POST", { email })).json(),
      unknown = await (
        await call("recovery", "POST", { email: "does-not-exist@example.test" })
      ).json();
    assert.equal(known.message, unknown.message);
  },
);
test.after(async () => {
  await db.$disconnect();
});
