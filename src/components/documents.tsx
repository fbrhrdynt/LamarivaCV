"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, useApp, useLoad, State, Empty, Notice, Field } from "./context";
import {
  DocumentData,
  sectionTitle,
  documentSchema,
  Profile,
  quality,
  templates,
  completion,
} from "@/lib/model";
import { ProfileForm } from "./profile-form";
import { WritingAssistant } from "./writing-assistant";
type Doc = {
  id: string;
  title: string;
  kind: "CV" | "LETTER";
  templateId: string;
  data: DocumentData;
  revision: number;
  updatedAt: string;
};
export type Template = {
  id: string;
  name: string;
  ats: boolean;
  active: boolean;
  isDefault: boolean;
  position: number;
  version: number;
  config: { font: string; accent: string; header: string };
};
export async function createDocument(
  kind: "CV" | "LETTER",
  language: string,
  job?: { id: string; title: string; company: string; description: string },
  templateId?: string,
) {
  const profile = await api<Profile>("profile");
  const all = await api<Template[]>("templates");
  const preference = await api<{ defaultTemplateId?: string }>("me");
  const template =
    templateId ??
    all.find((t) => t.id === preference.defaultTemplateId)?.id ??
    all.find((t) => t.isDefault)?.id ??
    "ats-standard";
  const data = documentSchema.parse({
    profile,
    language,
    ...(job
      ? {
          company: job.company,
          jobTitle: job.title,
          jobDescription: job.description,
          jobId: job.id,
        }
      : {}),
    letterDate: new Date().toISOString().slice(0, 10),
  });
  return api<Doc>("documents", "POST", {
    title: job
      ? `${job.title} · ${job.company}`
      : kind === "CV"
        ? "CV baru"
        : "Surat lamaran baru",
    kind,
    templateId: template,
    data,
  });
}
export function NewDocument({
  kind = "CV",
  templateId,
}: {
  kind?: "CV" | "LETTER";
  templateId?: string;
}) {
  const { t, lang, user } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          if (!user) {
            router.push("/register");
            return;
          }
          setBusy(true);
          try {
            const d = await createDocument(kind, lang, undefined, templateId);
            router.push(`/${kind === "CV" ? "cvs" : "letters"}/${d.id}`);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy
          ? t("Membuat…", "Creating…")
          : kind === "CV"
            ? t("Buat CV", "Create CV")
            : t("Buat surat lamaran", "Create cover letter")}
      </button>
      <Notice text={error} error />
    </>
  );
}
export function Dashboard() {
  const { t, user } = useApp();
  const l = useLoad<{
    cvs: number;
    letters: number;
    saved: number;
    applications: number;
    recent: Doc[];
    profile: Profile;
    followups: {
      id: string;
      title: string;
      company: string;
      followUpDate: string;
    }[];
  }>("dashboard");
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="kicker">
            {t("Ruang lamaran Anda", "Your application workspace")}
          </p>
          <h1>
            {t("Selamat datang", "Welcome")}, {user?.name.split(" ")[0]}.
          </h1>
        </div>
        <NewDocument />
      </div>
      <State loading={l.loading} error={l.error}>
        {l.data && (
          <>
            <div className="stat-strip">
              {[
                [l.data.cvs, "CV", "CV", "/cvs"],
                [l.data.letters, "Surat lamaran", "Cover letters", "/letters"],
                [
                  l.data.saved,
                  "Lowongan tersimpan",
                  "Saved jobs",
                  "/saved-jobs",
                ],
                [
                  l.data.applications,
                  "Lamaran dicatat",
                  "Applications tracked",
                  "/applications",
                ],
              ].map(([v, id, en, href]) => (
                <Link href={String(href)} key={String(href)}>
                  <strong>{v}</strong>
                  <span>{t(String(id), String(en))}</span>
                </Link>
              ))}
            </div>
            <div className="dashboard-columns">
              <section>
                <div className="section-heading">
                  <h2>{t("Dokumen terbaru", "Recent documents")}</h2>
                  <Link href="/cvs">{t("Semua CV", "All CVs")}</Link>
                </div>
                {l.data.recent.length ? (
                  <div className="file-list">
                    {l.data.recent.map((d, i) => (
                      <Link
                        className="file-row"
                        href={`/${d.kind === "CV" ? "cvs" : "letters"}/${d.id}`}
                        key={d.id}
                      >
                        <span className="file-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{d.title}</strong>
                          <small>
                            {d.kind === "CV"
                              ? "CV"
                              : t("Surat lamaran", "Cover letter")}{" "}
                            · {new Date(d.updatedAt).toLocaleDateString()}
                          </small>
                        </div>
                        <span>{t("Buka", "Open")}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={t("Belum ada dokumen", "No documents yet")}
                    description={t(
                      "Lengkapi profil agar CV pertama Anda terisi dari informasi yang sama.",
                      "Complete your profile to reuse your information in your first CV.",
                    )}
                  >
                    <Link className="button" href="/profile">
                      {t("Lengkapi profil", "Complete profile")}
                    </Link>
                  </Empty>
                )}
                <div className="letter-prompt">
                  <div>
                    <h2>
                      {t(
                        "Surat untuk posisi berikutnya",
                        "A letter for your next role",
                      )}
                    </h2>
                    <p>
                      {t(
                        "Gunakan profil atau CV Anda, lalu sesuaikan perusahaan dan posisi tujuan.",
                        "Use your profile or CV, then choose a company and role.",
                      )}
                    </p>
                  </div>
                  <NewDocument kind="LETTER" />
                </div>
              </section>
              <aside className="profile-check">
                <h2>{t("Profil Anda", "Your profile")}</h2>
                <p className="completion">
                  {completion(l.data.profile)}
                  <span>%</span>
                </p>
                <progress
                  value={completion(l.data.profile)}
                  max={100}
                  aria-label={t("Kelengkapan profil", "Profile completion")}
                />
                <ul className="checklist">
                  {[
                    [
                      Boolean(l.data.profile.name && l.data.profile.email),
                      "Informasi pribadi",
                      "Personal information",
                    ],
                    [
                      Boolean(
                        l.data.profile.sections.find(
                          (s) => s.type === "education",
                        )?.entries.length,
                      ),
                      "Pendidikan",
                      "Education",
                    ],
                    [
                      Boolean(
                        l.data.profile.sections.find(
                          (s) => s.type === "experience",
                        )?.entries.length,
                      ),
                      "Pengalaman kerja",
                      "Work experience",
                    ],
                    [
                      Boolean(
                        l.data.profile.sections.find((s) => s.type === "skills")
                          ?.entries.length,
                      ),
                      "Keahlian",
                      "Skills",
                    ],
                  ].map(([done, id, en]) => (
                    <li key={String(id)}>
                      <span aria-label={done ? "complete" : "incomplete"}>
                        {done ? "✓" : "○"}
                      </span>
                      {t(String(id), String(en))}
                    </li>
                  ))}
                </ul>
                <Link href="/profile">{t("Edit profil", "Edit profile")}</Link>
                <p className="muted">
                  {t(
                    "Pengalaman kerja boleh kosong untuk lulusan baru.",
                    "Work experience is optional for new graduates.",
                  )}
                </p>
              </aside>
            </div>
            {l.data.followups.length > 0 && (
              <section className="panel">
                <h2>{t("Perlu ditindaklanjuti", "Follow-up due")}</h2>
                {l.data.followups.map((a) => (
                  <p key={a.id}>
                    <Link href="/applications">
                      {a.company}: {a.title}
                    </Link>{" "}
                    · {a.followUpDate}
                  </p>
                ))}
              </section>
            )}
          </>
        )}
      </State>
    </>
  );
}
export function DocumentList({ kind }: { kind: "CV" | "LETTER" }) {
  const { t } = useApp();
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  const l = useLoad<{ items: Doc[]; total: number }>(
    `documents?kind=${kind}&q=${encodeURIComponent(query)}&page=${page}`,
  );
  const router = useRouter();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {kind === "CV"
              ? t("CV saya", "My CVs")
              : t("Surat lamaran", "Cover letters")}
          </h1>
          <p>
            {t(
              "Simpan versi berbeda untuk setiap tujuan lamaran.",
              "Keep different versions for each application.",
            )}
          </p>
        </div>
        <NewDocument kind={kind} />
      </div>
      <Field label={t("Cari dokumen", "Search documents")}>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </Field>
      <Notice text={error} error />
      <State loading={l.loading} error={l.error}>
        {l.data?.items.length ? (
          <div className="file-list">
            {l.data.items.map((d, i) => (
              <div className="file-row" key={d.id}>
                <span className="file-number">
                  {String((page - 1) * 30 + i + 1).padStart(2, "0")}
                </span>
                <Link
                  className="file-info"
                  href={`/${kind === "CV" ? "cvs" : "letters"}/${d.id}`}
                >
                  <strong>{d.title}</strong>
                  <small>
                    {templates.find((t) => t.id === d.templateId)?.name} ·{" "}
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </small>
                </Link>
                <div className="row">
                  <button
                    onClick={async () => {
                      try {
                        const copy = await api<Doc>(
                          `documents/${d.id}/duplicate`,
                          "POST",
                        );
                        router.push(
                          `/${kind === "CV" ? "cvs" : "letters"}/${copy.id}`,
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {t("Salin", "Duplicate")}
                  </button>
                  <button
                    className="text-danger"
                    onClick={async () => {
                      if (
                        confirm(
                          t(`Hapus “${d.title}”?`, `Delete “${d.title}”?`),
                        )
                      )
                        try {
                          await api(`documents/${d.id}`, "DELETE");
                          l.reload();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                    }}
                  >
                    {t("Hapus", "Delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={t("Belum ada dokumen di sini", "No documents here yet")}
            description={t(
              "Buat dokumen baru atau ubah kata pencarian.",
              "Create a new document or change your search.",
            )}
          />
        )}
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            {t("Sebelumnya", "Previous")}
          </button>
          <span>{page}</span>
          <button
            disabled={page * 30 >= (l.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("Berikutnya", "Next")}
          </button>
        </div>
      </State>
    </>
  );
}
export function TemplateList() {
  const { t } = useApp();
  const l = useLoad<Template[]>("templates");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Pilih bentuk CV Anda", "Choose your CV format")}</h1>
          <p>
            {t(
              "ATS Standard menjadi pilihan awal. Semua template tetap dapat diedit.",
              "ATS Standard is the default. Every template remains editable.",
            )}
          </p>
        </div>
      </div>
      <State loading={l.loading} error={l.error}>
        <div className="templates">
          {l.data?.map((temp, i) => (
            <article key={temp.id}>
              <div
                className={`template-paper ${temp.config.header === "center" ? "center" : ""}`}
                style={{
                  color: temp.config.accent,
                  fontFamily:
                    temp.config.font === "Times-Roman"
                      ? "Georgia,serif"
                      : "Arial,sans-serif",
                }}
              >
                <span className="sample-label">
                  {t("Pratinjau struktur", "Layout preview")}
                </span>
                <strong>{t("Nama Anda", "Your name")}</strong>
                <p>{t("Jabatan profesional", "Professional headline")}</p>
                <hr />
                <h3>{t("Ringkasan", "Summary")}</h3>
                <p>
                  {t(
                    "Ringkasan pengalaman dan keahlian Anda.",
                    "Your experience and skills summary.",
                  )}
                </p>
                <h3>{t("Pengalaman kerja", "Experience")}</h3>
                <p>{t("Jabatan · Perusahaan", "Role · Company")}</p>
                <h3>{t("Pendidikan", "Education")}</h3>
                <p>{t("Gelar · Institusi", "Degree · Institution")}</p>
              </div>
              <div className="section-heading">
                <h2>{temp.name}</h2>
                <span className="muted">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <p>
                {temp.ats
                  ? t(
                      "Satu kolom, berorientasi ATS.",
                      "Single column, ATS-oriented.",
                    )
                  : t(
                      "Gaya visual; kompatibilitas ATS dapat berbeda.",
                      "Visual styling; ATS compatibility may vary.",
                    )}
              </p>
              <NewDocument templateId={temp.id} />
            </article>
          ))}
        </div>
      </State>
    </>
  );
}
function PaperPreview({
  d,
  templateId,
}: {
  d: DocumentData;
  templateId: string;
}) {
  const c =
    templates.find((t) => t.id === templateId)?.config ?? templates[0].config;
  return (
    <article
      className={`paper ${c.header === "center" ? "center-header" : ""}`}
      style={{
        fontFamily:
          c.font === "Times-Roman" ? "Georgia,serif" : "Arial,sans-serif",
      }}
    >
      <header style={{ color: c.accent }}>
        <h2>{d.profile.name || "Nama / Name"}</h2>
        <p>{d.profile.headline}</p>
        <small>
          {[d.profile.email, d.profile.phone, d.profile.location]
            .filter(Boolean)
            .join(" | ")}
        </small>
      </header>
      {d.body ? (
        <>
          <p>{d.letterDate}</p>
          <div className="letter-body">{d.body}</div>
        </>
      ) : (
        <>
          {d.profile.summary && (
            <section>
              <h3>
                {d.language === "id"
                  ? "Ringkasan profesional"
                  : "Professional summary"}
              </h3>
              <p>{d.profile.summary}</p>
            </section>
          )}
          {d.profile.sections
            .filter((s) => s.visible && s.entries.length > 0)
            .map((s) => (
              <section key={s.id}>
                <h3 style={{ color: c.accent }}>
                  {sectionTitle(s, d.language)}
                </h3>
                {s.entries.map((e) => (
                  <div key={e.id} className="paper-entry">
                    <strong>
                      {[e.title, e.organization].filter(Boolean).join(" | ")}
                    </strong>
                    <small>
                      {[e.start, e.current ? "Present" : e.end, e.location]
                        .filter(Boolean)
                        .join(" | ")}
                    </small>
                    <p>{e.description}</p>
                  </div>
                ))}
              </section>
            ))}
        </>
      )}
    </article>
  );
}
export function DocumentEditor({ id }: { id: string }) {
  const { t } = useApp();
  const load = useLoad<Doc>(`documents/${id}`),
    templateLoad = useLoad<Template[]>("templates");
  const [doc, setDoc] = useState<Doc | null>(null),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [tab, setTab] = useState<"form" | "preview">("form"),
    [preview, setPreview] = useState<"live" | "pdf">("live"),
    [versions, setVersions] = useState<
      { id: string; revision: number; title: string; createdAt: string }[]
    >([]),
    [source, setSource] = useState("profile"),
    [sourceCVs, setSourceCVs] = useState<Doc[]>([]);
  const current = useRef<Doc | null>(null),
    saved = useRef(""),
    saving = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (load.data) {
      setDoc(load.data);
      current.current = load.data;
      saved.current = JSON.stringify(load.data);
      setStatus(t("Tersimpan", "Saved"));
    }
  }, [load.data]);
  // Keep the latest draft separate from requests so slow saves cannot overwrite newer keystrokes.
  const update = (next: Doc) => {
    current.current = next;
    setDoc(next);
    setStatus(t("Belum tersimpan", "Unsaved"));
  };
  const save = useCallback(async () => {
    if (saving.current) {
      await saving.current;
      return;
    }
    const snapshot = current.current;
    if (!snapshot || JSON.stringify(snapshot) === saved.current) return;
    setStatus("Menyimpan / Saving…");
    setError("");
    const task = (async () => {
      try {
        const result = await api<Doc>(`documents/${id}`, "PUT", snapshot);
        const stillSame =
          current.current &&
          JSON.stringify(current.current) === JSON.stringify(snapshot);
        saved.current = JSON.stringify(result);
        if (stillSame) {
          current.current = result;
          setDoc(result);
          setStatus("Tersimpan / Saved");
        } else if (current.current) {
          current.current = { ...current.current, revision: result.revision };
          setDoc(current.current);
          setStatus("Belum tersimpan / Unsaved");
        }
      } catch (e) {
        setError((e as Error).message);
        setStatus("Gagal menyimpan / Save failed");
        throw e;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = task;
    await task;
  }, [id]);
  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [doc, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        current.current &&
        JSON.stringify(current.current) !== saved.current
      ) {
        e.preventDefault();
      }
    };
    const guard = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest("a[href]") &&
        current.current &&
        JSON.stringify(current.current) !== saved.current &&
        !confirm(
          "Perubahan belum tersimpan. Tetap tinggalkan halaman? / Leave with unsaved changes?",
        )
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, []);
  useEffect(() => {
    api<{ items: Doc[] }>("documents?kind=CV")
      .then((v) => setSourceCVs(v.items))
      .catch(() => {});
  }, []);
  if (load.loading || load.error || !doc)
    return (
      <State loading={load.loading} error={load.error}>
        <p>Dokumen tidak ditemukan.</p>
      </State>
    );
  const edit = (key: keyof DocumentData, value: unknown) =>
    update({ ...doc, data: { ...doc.data, [key]: value } });
  const exportFile = async (format: string) => {
    try {
      await save();
      await save();
      const response = await fetch(
        `/api/documents/${id}/export?format=${format}`,
      );
      if (!response.ok) {
        const x = await response.json();
        throw new Error(x.error);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.title.replace(/[^a-zA-Z0-9 -]/g, "") || "Lamariva"}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const feedback = quality(doc.data.profile, doc.data.jobDescription);
  return (
    <>
      <div className="editor-toolbar">
        <div>
          <Link href={doc.kind === "CV" ? "/cvs" : "/letters"}>
            {t("Dokumen saya", "My documents")}
          </Link>
          <input
            className="title-input"
            aria-label={t("Judul dokumen", "Document title")}
            value={doc.title}
            onChange={(e) => update({ ...doc, title: e.target.value })}
          />
          <small role="status">{status}</small>
        </div>
        <div className="row">
          <button onClick={() => void save().catch(() => {})}>
            {t("Simpan", "Save")}
          </button>
          <button onClick={() => exportFile("docx")}>DOCX</button>
          <button className="primary" onClick={() => exportFile("pdf")}>
            {t("Unduh PDF", "Download PDF")}
          </button>
        </div>
      </div>
      <Notice text={error} error />
      <div className="mobile-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "form"}
          onClick={() => setTab("form")}
        >
          {t("Edit isi", "Edit content")}
        </button>
        <button
          role="tab"
          aria-selected={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          {t("Pratinjau", "Preview")}
        </button>
      </div>
      <div className={`editor-layout show-${tab}`}>
        <section className="editor-form">
          <div className="form-grid">
            <Field label="Template">
              <select
                value={doc.templateId}
                onChange={(e) => update({ ...doc, templateId: e.target.value })}
              >
                {templateLoad.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Bahasa dokumen", "Document language")}>
              <select
                value={doc.data.language}
                onChange={(e) => edit("language", e.target.value)}
              >
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label={t("Ukuran kertas", "Paper size")}>
              <select
                value={doc.data.paper}
                onChange={(e) => edit("paper", e.target.value)}
              >
                <option>A4</option>
                <option>LETTER</option>
              </select>
            </Field>
            <Field label={t("Ukuran font PDF", "PDF font size")}>
              <select
                value={doc.data.fontSize}
                onChange={(e) => edit("fontSize", Number(e.target.value))}
              >
                {[9, 10, 11, 12, 13].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
          </div>
          {doc.kind === "LETTER" && (
            <details open>
              <summary>{t("Tujuan lamaran", "Application details")}</summary>
              <Field
                label={t("Ambil informasi dari", "Import information from")}
              >
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="profile">
                    {t("Profil profesional", "Professional profile")}
                  </option>
                  {sourceCVs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                onClick={async () => {
                  if (
                    confirm(
                      t(
                        "Ganti data profil dalam surat ini?",
                        "Replace the profile in this letter?",
                      ),
                    )
                  )
                    try {
                      const p =
                        source === "profile"
                          ? await api<Profile>("profile")
                          : (await api<Doc>(`documents/${source}`)).data
                              .profile;
                      edit("profile", p);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                }}
              >
                {t("Ambil data", "Import data")}
              </button>
              <div className="form-grid">
                {(
                  [
                    "company",
                    "jobTitle",
                    "manager",
                    "address",
                    "letterDate",
                    "motivation",
                  ] as const
                ).map((key, i) => (
                  <Field
                    key={key}
                    label={t(
                      [
                        "Perusahaan *",
                        "Posisi *",
                        "Nama penerima",
                        "Alamat perusahaan",
                        "Tanggal surat",
                        "Motivasi melamar",
                      ][i],
                      [
                        "Company *",
                        "Job title *",
                        "Hiring manager",
                        "Company address",
                        "Letter date",
                        "Motivation",
                      ][i],
                    )}
                  >
                    <input
                      type={key === "letterDate" ? "date" : "text"}
                      value={doc.data[key]}
                      onChange={(e) => edit(key, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <Field label={t("Gaya bahasa", "Tone")}>
                <select
                  value={doc.data.tone}
                  onChange={(e) => edit("tone", e.target.value)}
                >
                  {[
                    "Professional",
                    "Formal",
                    "Concise",
                    "Confident",
                    "Entry-level",
                    "Executive",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <button
                className="primary"
                onClick={async () => {
                  if (
                    doc.data.body &&
                    !confirm(
                      t(
                        "Ganti draf surat saat ini?",
                        "Replace the current letter?",
                      ),
                    )
                  )
                    return;
                  try {
                    const result = await api<{ body: string }>(
                      "generate-letter",
                      "POST",
                      doc.data,
                    );
                    edit("body", result.body);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {t("Susun draf surat", "Draft cover letter")}
              </button>
              <p className="muted">
                {t(
                  "Generator standar memakai informasi Anda. Tinjau isinya sebelum dikirim.",
                  "The standard generator uses your information. Review before sending.",
                )}
              </p>
              <Field label={t("Isi surat", "Letter content")}>
                <textarea
                  rows={18}
                  value={doc.data.body}
                  onChange={(e) => edit("body", e.target.value)}
                />
              </Field>
            </details>
          )}
          <ProfileForm
            value={doc.data.profile}
            onChange={(p) => edit("profile", p)}
          />
          <WritingAssistant
            data={doc.data}
            onApply={(value) =>
              doc.kind === "LETTER"
                ? edit("body", value)
                : edit("profile", { ...doc.data.profile, summary: value })
            }
          />
          <details>
            <summary>{t("Periksa isi CV", "Review CV content")}</summary>
            <Field
              label={t(
                "Deskripsi pekerjaan untuk pemeriksaan kata kunci",
                "Job description for keyword review",
              )}
            >
              <textarea
                rows={5}
                value={doc.data.jobDescription}
                onChange={(e) => edit("jobDescription", e.target.value)}
              />
            </Field>
            <p>
              {t(
                "Pemeriksaan berbasis aturan, bukan nilai kelulusan ATS.",
                "Rule-based review, not an ATS pass score.",
              )}
            </p>
            {feedback.issues.length ? (
              <ul>
                {feedback.issues.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <p>
                {t(
                  "Tidak ada masalah dasar yang terdeteksi.",
                  "No basic issues detected.",
                )}
              </p>
            )}
            {feedback.matched.length > 0 && (
              <p>
                {t("Ditemukan", "Found")}: {feedback.matched.join(", ")}
              </p>
            )}
            {feedback.missing.length > 0 && (
              <p>
                {t(
                  "Belum ditemukan; tambahkan hanya jika sesuai pengalaman",
                  "Not found; add only when supported by your experience",
                )}
                : {feedback.missing.join(", ")}
              </p>
            )}
          </details>
          <details>
            <summary>
              {t("Versi dan sinkronisasi", "Versions and synchronization")}
            </summary>
            <div className="row">
              <button
                onClick={async () => {
                  try {
                    await save();
                    setVersions(await api(`documents/${id}/versions`));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {t("Lihat versi tersimpan", "View saved versions")}
              </button>
              <button
                onClick={async () => {
                  if (
                    confirm(
                      t(
                        "Ganti data CV ini dengan profil terbaru?",
                        "Replace this document’s profile with the latest master profile?",
                      ),
                    )
                  )
                    try {
                      edit("profile", await api<Profile>("profile"));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                }}
              >
                {t("Sinkronkan profil", "Sync profile")}
              </button>
            </div>
            {versions.map((v) => (
              <div className="version-row" key={v.id}>
                <span>
                  v{v.revision} · {new Date(v.createdAt).toLocaleString()}
                </span>
                <button
                  onClick={async () => {
                    if (
                      confirm(t("Pulihkan versi ini?", "Restore this version?"))
                    )
                      try {
                        await save();
                        const restored = await api<Doc>(
                          `documents/${id}/restore`,
                          "POST",
                          {
                            versionId: v.id,
                            revision: current.current?.revision,
                          },
                        );
                        current.current = restored;
                        saved.current = JSON.stringify(restored);
                        setDoc(restored);
                        setStatus(t("Versi dipulihkan", "Version restored"));
                      } catch (e) {
                        setError((e as Error).message);
                      }
                  }}
                >
                  {t("Pulihkan", "Restore")}
                </button>
              </div>
            ))}
          </details>
        </section>
        <section className="preview-area">
          <div className="preview-controls">
            <span>{t("Pratinjau dokumen", "Document preview")}</span>
            <div className="row">
              <button
                aria-pressed={preview === "live"}
                onClick={() => setPreview("live")}
              >
                {t("Langsung", "Live")}
              </button>
              <button
                aria-pressed={preview === "pdf"}
                onClick={async () => {
                  try {
                    await save();
                    await save();
                    setPreview("pdf");
                  } catch {}
                }}
              >
                PDF
              </button>
            </div>
          </div>
          {preview === "live" ? (
            <>
              <PaperPreview
                d={{
                  ...doc.data,
                  body: doc.kind === "CV" ? "" : doc.data.body,
                }}
                templateId={doc.templateId}
              />
              <p className="preview-note">
                {t(
                  "Preview langsung untuk isi. Tab PDF menampilkan tata letak unduhan dan pemisahan halaman.",
                  "Live preview shows content. The PDF tab shows exact download layout and page breaks.",
                )}
              </p>
            </>
          ) : (
            <iframe
              title="PDF preview"
              className="pdf-frame"
              src={`/api/documents/${id}/export?preview=1&revision=${doc.revision}`}
            />
          )}
        </section>
      </div>
    </>
  );
}
