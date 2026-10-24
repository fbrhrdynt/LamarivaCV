import { test, expect } from "@playwright/test";
test("desktop and mobile user journeys, navigation, themes and editor", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Satu profil",
  );
  await page.getByRole("link", { name: "Template CV", exact: true }).click();
  await expect(page.getByText("ATS Standard", { exact: true })).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("qa-user@example.test");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill("QA-only-Password-2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByText("Dokumen terbaru", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "CV saya", exact: true }).click();
  await page.getByRole("link", { name: /QA CV/ }).first().click();
  await expect(page.getByLabel("Judul dokumen")).toBeVisible();
  await page.getByLabel("Judul dokumen").fill("QA browser edited CV");
  await expect(
    page.getByRole("status").filter({ hasText: "Tersimpan" }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByLabel("Nama lengkap", { exact: true })
    .fill("QA Browser Applicant");
  await expect(
    page.getByRole("status").filter({ hasText: "Tersimpan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect(page.locator('iframe[title="PDF preview"]')).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await page
    .getByRole("link", { name: "Tracker lamaran", exact: true })
    .click();
  await page.getByRole("button", { name: "Tambah lamaran" }).click();
  await page
    .getByLabel("Perusahaan *", { exact: true })
    .fill("QA Browser Company");
  await page.getByLabel("Posisi *", { exact: true }).fill("QA Browser Role");
  await page.getByRole("button", { name: "Simpan lamaran" }).click();
  await expect(
    page.getByText("QA Browser Company", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  await expect(page.locator(".kanban")).toBeVisible();
  await page.goto("/dashboard");
  await page.screenshot({
    path: "test-results/desktop-light.png",
    fullPage: true,
  });
  await page
    .locator(".sidebar .preferences select")
    .last()
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/desktop-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Buka navigasi" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await page
    .getByRole("link", { name: "Profil profesional", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Profil profesional" }),
  ).toBeVisible();
  await page
    .locator(".mobile-top .preferences select")
    .last()
    .selectOption("light");
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mobile-profile.png",
    fullPage: true,
  });
  await page.goto("/cvs");
  await page.getByRole("link", { name: /QA browser edited CV/ }).click();
  await page.getByRole("tab", { name: "Pratinjau" }).click();
  await expect(page.locator(".paper")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-editor.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.context().clearCookies();
  await page.setViewportSize({width:1280,height:900});
  for (const route of [
    "about",
    "features",
    "faq",
    "help",
    "contact",
    "privacy",
    "terms",
    "cover-letter",
    "jobs",
  ]) {
    await page.goto("/" + route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("qa-owner@example.test");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill("QA-only-Password-2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/admin/templates");
  await page
    .getByLabel("Konfirmasi kata sandi admin untuk perubahan")
    .fill("QA-only-Password-2026!");
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.getByLabel("Nama template", { exact: true }).fill("ATS Standard");
  await page.getByRole("button", { name: "Simpan versi template" }).click();
  await expect(
    page.getByText("Perubahan berhasil diproses.", { exact: true }),
  ).toBeVisible();
  for (const section of [
    "users",
    "providers",
    "jobs",
    "settings",
    "support",
    "audit",
    "operations",
  ]) {
    await page.goto("/admin/" + section);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".loading")).toHaveCount(0);
    await expect(page.locator(".notice.error")).toHaveCount(0);
  }
  await page.goto("/admin");
  await expect(page.getByRole("heading", {name:"Kesehatan aplikasi"})).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-overview.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
