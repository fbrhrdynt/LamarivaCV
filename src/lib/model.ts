import { z } from "zod";
export const text = z.string().trim().max(12000);
const short = z.string().trim().max(240);
export const url = z.union([
  z.literal(""),
  z.url().refine((v) => v.startsWith("https://"), "Use an HTTPS URL"),
]);
export const entrySchema = z.object({
  id: z.string().max(100),
  title: short.default(""),
  organization: short.default(""),
  location: short.default(""),
  start: short.default(""),
  end: short.default(""),
  current: z.boolean().default(false),
  description: text.default(""),
});
export const sectionSchema = z.object({
  id: z.string().max(100),
  type: z.enum([
    "experience",
    "education",
    "skills",
    "certifications",
    "projects",
    "languages",
    "training",
    "awards",
    "publications",
    "volunteer",
    "memberships",
    "references",
    "custom",
  ]),
  title: short,
  visible: z.boolean().default(true),
  entries: z.array(entrySchema).max(100),
});
export const profileSchema = z.object({
  name: short.default(""),
  headline: short.default(""),
  email: z.union([z.literal(""), z.email()]).default(""),
  phone: short.default(""),
  location: short.default(""),
  linkedin: url.default(""),
  website: url.default(""),
  github: url.default(""),
  summary: text.default(""),
  targetTitle: short.default(""),
  targetIndustry: short.default(""),
  sections: z.array(sectionSchema).max(30).default([]),
});
export type Profile = z.infer<typeof profileSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Section = z.infer<typeof sectionSchema>;
export function sectionTitle(section: Section, language: string) {
  const labels: Record<string, [string, string]> = {
    experience: ["Pengalaman kerja", "Work experience"],
    education: ["Pendidikan", "Education"],
    skills: ["Keahlian", "Skills"],
    certifications: ["Sertifikasi", "Certifications"],
    projects: ["Proyek", "Projects"],
    languages: ["Bahasa", "Languages"],
    training: ["Pelatihan", "Training"],
    awards: ["Penghargaan", "Awards"],
    publications: ["Publikasi", "Publications"],
    volunteer: ["Relawan", "Volunteering"],
    memberships: ["Keanggotaan", "Memberships"],
    references: ["Referensi", "References"],
  };
  const pair = labels[section.type];
  return pair?.includes(section.title)
    ? pair[language === "en" ? 1 : 0]
    : section.title;
}
export const documentSchema = z.object({
  profile: profileSchema,
  language: z.enum(["id", "en"]).default("id"),
  paper: z.enum(["A4", "LETTER"]).default("A4"),
  fontSize: z.number().min(9).max(13).default(10),
  company: short.default(""),
  jobTitle: short.default(""),
  manager: short.default(""),
  address: short.default(""),
  jobDescription: text.default(""),
  motivation: text.default(""),
  tone: z
    .enum([
      "Professional",
      "Formal",
      "Concise",
      "Confident",
      "Entry-level",
      "Executive",
    ])
    .default("Professional"),
  letterDate: short.default(""),
  body: text.default(""),
  jobId: short.default(""),
});
export type DocumentData = z.infer<typeof documentSchema>;
export const statuses = [
  "Interested",
  "Saved",
  "Applied",
  "Screening",
  "Interview",
  "Assessment",
  "Offer",
  "Hired",
  "Rejected",
  "Withdrawn",
] as const;
export const applicationSchema = z.object({
  company: short.min(1),
  title: short.min(1),
  status: z.enum(statuses),
  location: short.default(""),
  url: url.default(""),
  source: short.default(""),
  cvId: z.string().nullable().default(null),
  letterId: z.string().nullable().default(null),
  appliedDate: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/)
    .default(""),
  followUpDate: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/)
    .default(""),
  notes: text.default(""),
});
export const templates = [
  {
    id: "ats-standard",
    name: "ATS Standard",
    ats: true,
    config: { font: "Helvetica", accent: "#182c3e", header: "left" },
  },
  {
    id: "ats-modern",
    name: "ATS Modern",
    ats: true,
    config: { font: "Helvetica", accent: "#245775", header: "left" },
  },
  {
    id: "executive",
    name: "Executive",
    ats: false,
    config: { font: "Times-Roman", accent: "#202020", header: "center" },
  },
  {
    id: "minimalist",
    name: "Minimalist",
    ats: true,
    config: { font: "Helvetica", accent: "#333333", header: "left" },
  },
  {
    id: "professional-blue",
    name: "Professional Blue",
    ats: false,
    config: { font: "Helvetica", accent: "#155b87", header: "left" },
  },
  {
    id: "corporate",
    name: "Corporate",
    ats: false,
    config: { font: "Helvetica", accent: "#283e50", header: "center" },
  },
  {
    id: "academic",
    name: "Academic",
    ats: true,
    config: { font: "Times-Roman", accent: "#232323", header: "left" },
  },
  {
    id: "creative",
    name: "Creative",
    ats: false,
    config: { font: "Helvetica", accent: "#23686e", header: "left" },
  },
];
export const emptyProfile = (name = "", email = ""): Profile => ({
  name,
  email,
  headline: "",
  phone: "",
  location: "",
  linkedin: "",
  website: "",
  github: "",
  summary: "",
  targetTitle: "",
  targetIndustry: "",
  sections: [
    {
      id: "experience",
      type: "experience",
      title: "Pengalaman kerja",
      visible: true,
      entries: [],
    },
    {
      id: "education",
      type: "education",
      title: "Pendidikan",
      visible: true,
      entries: [],
    },
    {
      id: "skills",
      type: "skills",
      title: "Keahlian",
      visible: true,
      entries: [],
    },
  ],
});
export function completion(p: Profile) {
  return Math.round(
    ([
      p.name,
      p.email,
      p.phone,
      p.headline,
      p.summary,
      p.sections.find((s) => s.type === "experience")?.entries.length,
      p.sections.find((s) => s.type === "education")?.entries.length,
      p.sections.find((s) => s.type === "skills")?.entries.length,
    ].filter(Boolean).length /
      8) *
      100,
  );
}
export function quality(p: Profile, jd = "") {
  const issues: string[] = [];
  if (!p.email && !p.phone)
    issues.push(
      "Tambahkan email atau nomor telepon agar perekrut dapat menghubungi Anda.",
    );
  if (!p.summary)
    issues.push("Tambahkan ringkasan profesional yang sesuai posisi tujuan.");
  for (const s of p.sections.filter((s) => s.visible))
    for (const e of s.entries) {
      if (["experience", "education"].includes(s.type) && !e.start)
        issues.push(`${e.title || s.title}: tanggal mulai belum diisi.`);
      if (s.type === "experience" && !e.description)
        issues.push(`${e.title}: jelaskan tanggung jawab atau pencapaian.`);
      if (s.type === "experience" && e.description && !/\d/.test(e.description))
        issues.push(`${e.title}: tambahkan hasil terukur jika memang ada.`);
      if (e.start && e.end && e.end < e.start)
        issues.push(`${e.title}: tanggal akhir lebih awal dari tanggal mulai.`);
    }
  const lines = p.sections
    .flatMap((s) => s.entries.map((e) => e.description.trim()))
    .filter(Boolean);
  if (new Set(lines).size < lines.length)
    issues.push("Ada deskripsi berulang; periksa relevansinya.");
  if (JSON.stringify(p).length > 16000)
    issues.push(
      "Konten cukup panjang. Periksa jumlah halaman dan ringkas yang tidak relevan.",
    );
  const content = JSON.stringify(p).toLowerCase();
  const keywords = [
    ...new Set(jd.toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g) ?? []),
  ]
    .filter(
      (w) =>
        ![
          "with",
          "that",
          "this",
          "will",
          "your",
          "have",
          "from",
          "yang",
          "untuk",
          "dengan",
          "atau",
          "dalam",
          "kami",
          "anda",
        ].includes(w),
    )
    .slice(0, 40);
  return {
    issues,
    matched: keywords.filter((k) => content.includes(k)),
    missing: keywords.filter((k) => !content.includes(k)),
  };
}
export function generateLetter(
  d: DocumentData,
  template?: { opening: string; closing: string },
): string {
  const p = d.profile;
  const skills = p.sections
    .filter((s) => s.type === "skills")
    .flatMap((s) => s.entries.map((e) => e.title))
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
  const work = p.sections.find((s) => s.type === "experience")?.entries[0];
  const id = d.language === "id";
  const greeting = id
    ? `Yth. ${d.manager || "Tim Rekrutmen"}\n${d.company}`
    : `Dear ${d.manager || "Hiring Team"},`;
  const defaultOpening = id
    ? `Saya mengajukan lamaran untuk posisi ${d.jobTitle} di ${d.company}.`
    : `I am applying for the ${d.jobTitle} position at ${d.company}.`;
  const fact = work
    ? id
      ? `Pengalaman saya sebagai ${work.title}${work.organization ? ` di ${work.organization}` : ""}. ${work.description}`
      : `My experience includes working as ${work.title}${work.organization ? ` at ${work.organization}` : ""}. ${work.description}`
    : p.summary;
  const skill = skills
    ? id
      ? `Keahlian yang dapat saya bawa untuk posisi ini mencakup ${skills}.`
      : `Skills I can bring to this role include ${skills}.`
    : "";
  const defaultClose = id
    ? "Saya terbuka untuk mendiskusikan kesesuaian pengalaman saya dengan kebutuhan tim. Terima kasih atas waktu dan pertimbangannya."
    : "I would welcome a conversation about how my experience fits your team’s needs. Thank you for your time and consideration.";
  const fill = (v: string) =>
    v.replace(/\{(company|jobTitle|name)\}/g, (_, key: string) =>
      key === "name" ? p.name : key === "company" ? d.company : d.jobTitle,
    );
  const opening = template ? fill(template.opening) : defaultOpening;
  const close = template ? fill(template.closing) : defaultClose;
  const tone =
    d.tone === "Formal"
      ? id
        ? "Dengan hormat,"
        : "Please accept my application for your consideration."
      : d.tone === "Confident"
        ? id
          ? "Saya siap menjelaskan kontribusi yang dapat saya berikan dalam wawancara."
          : "I look forward to discussing the contribution I can make in an interview."
        : d.tone === "Entry-level"
          ? id
            ? "Saya siap belajar dan mengembangkan kemampuan melalui pekerjaan ini."
            : "I am ready to learn and develop my skills in this role."
          : d.tone === "Executive"
            ? id
              ? "Saya berharap dapat mendiskusikan prioritas posisi ini dan kebutuhan organisasi."
              : "I would appreciate discussing the priorities of this position and the organization."
            : "";
  return [
    greeting,
    d.address,
    opening,
    tone,
    d.tone === "Concise" ? fact.slice(0, 900) : fact,
    skill,
    d.motivation,
    close,
    id ? `Hormat saya,\n${p.name}` : `Sincerely,\n${p.name}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
