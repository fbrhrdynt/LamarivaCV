import test from "node:test";
import assert from "node:assert/strict";
import {
  documentSchema,
  emptyProfile,
  generateLetter,
  quality,
  profileSchema,
} from "../src/lib/model";
import { normalize } from "../src/providers/jobs";
import { exportPDF, exportDOCX } from "../src/lib/export";
import { writeFile, mkdir } from "node:fs/promises";
test("letter uses supplied facts without inventing employment", () => {
  const p = emptyProfile("Test Applicant", "applicant@example.test");
  p.sections[2].entries.push({
    id: "skill",
    title: "Siemens PLC",
    organization: "",
    location: "",
    start: "",
    end: "",
    current: false,
    description: "",
  });
  const d = documentSchema.parse({
    profile: p,
    company: "Test Company",
    jobTitle: "Maintenance Technician",
    language: "en",
  });
  const letter = generateLetter(d);
  assert.match(letter, /Test Company/);
  assert.match(letter, /Maintenance Technician/);
  assert.match(letter, /Siemens PLC/);
  assert.doesNotMatch(letter, /years|certified|Bachelor/i);
});
test("validation rejects unsafe links and excessive content", () => {
  assert.equal(
    profileSchema.safeParse({
      ...emptyProfile(),
      website: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ ...emptyProfile(), summary: "x".repeat(13000) })
      .success,
    false,
  );
});
test("quality feedback identifies missing contact and dates", () => {
  const p = emptyProfile();
  p.sections[0].entries.push({
    id: "work",
    title: "Technician",
    organization: "Test",
    location: "",
    start: "",
    end: "",
    current: false,
    description: "",
  });
  const q = quality(p, "PLC troubleshooting");
  assert.ok(q.issues.some((i) => i.includes("tanggal")));
  assert.deepEqual(q.missing, ["troubleshooting"]);
});
test("provider normalization uses real fields, strips HTML, rejects non HTTPS", () => {
  const rows = normalize("lever", "test-board", [
    {
      id: "1",
      text: "Technician",
      hostedUrl: "https://jobs.lever.co/test/1",
      categories: { location: "Jakarta" },
      descriptionPlain: "<script>bad()</script>Maintain equipment",
    },
    { id: "2", hostedUrl: "javascript:alert(1)" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].location, "Jakarta");
  assert.equal(rows[0].salary, "");
  assert.equal(rows[0].description, "Maintain equipment");
});
test("PDF and DOCX render selectable structured documents", async () => {
  const p = emptyProfile("QA Test Applicant", "qa@example.test");
  p.summary = "Maintenance and troubleshooting of industrial equipment.";
  for (let i = 0; i < 18; i++)
    p.sections[0].entries.push({
      id: String(i),
      title: `Test role ${i}`,
      organization: "QA Fixture",
      location: "Jakarta",
      start: "2020-01",
      end: "2026-01",
      current: false,
      description:
        "Performed preventive maintenance.\n- Completed 12 equipment inspections.",
    });
  const d = documentSchema.parse({ profile: p, language: "en" });
  const pdf = await exportPDF(d, "CV", "ats-standard");
  const docx = await exportDOCX(d, "CV", "ats-standard");
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.equal(docx.subarray(0, 2).toString(), "PK");
  await mkdir("test-results/artifacts", { recursive: true });
  await writeFile("test-results/artifacts/cv.pdf", pdf);
  await writeFile("test-results/artifacts/cv.docx", docx);
});
