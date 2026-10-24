"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp, api, useLoad, State, Empty, Field, Notice } from "./context";
import { createDocument } from "./documents";
import { statuses } from "@/lib/model";
export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  arrangement: string;
  employmentType: string;
  seniority: string;
  salary: string;
  description: string;
  url: string;
  source: string;
  postedAt: string | null;
  syncedAt: string;
  active: boolean;
  expiresAt: string | null;
};
export function Jobs({ id, saved = false }: { id?: string; saved?: boolean }) {
  const { t, user, lang } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState(""),
    [location, setLocation] = useState(""),
    [arrangement, setArrangement] = useState(""),
    [source, setSource] = useState(""),
    [days, setDays] = useState(""),
    [page, setPage] = useState(1),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const list = useLoad<{ items: Job[]; total: number }>(
    `jobs?q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&arrangement=${arrangement}&source=${source}&days=${days}&page=${page}`,
  );
  const savedList = useLoad<{ id: string; job: Job }[]>(
    saved ? "saved-jobs" : "jobs?__unused=1",
  );
  const detail = useLoad<Job>(id ? `jobs/${id}` : "jobs?__unused=1");
  const save = async (job: Job) => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      await api("saved-jobs", "POST", { jobId: job.id });
      setMessage(t("Lowongan disimpan.", "Job saved."));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (id)
    return (
      <>
        <Link href="/jobs">{t("Kembali ke lowongan", "Back to jobs")}</Link>
        <State loading={detail.loading} error={detail.error}>
          {detail.data && (
            <>
              <div className="job-detail-heading">
                <p className="kicker">{detail.data.company}</p>
                <h1>{detail.data.title}</h1>
                <p>
                  {[
                    detail.data.location,
                    detail.data.arrangement,
                    detail.data.employmentType,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {detail.data.salary && <p>{detail.data.salary}</p>}
                <small>
                  {t("Sumber", "Source")}: {detail.data.source} ·{" "}
                  {t("Diperbarui", "Synced")}{" "}
                  {new Date(detail.data.syncedAt).toLocaleDateString()}
                </small>
              </div>
              <div className="row job-actions">
                <a
                  className="button primary"
                  href={detail.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Buka situs lamaran", "Open application site")}
                </a>
                <button onClick={() => save(detail.data!)}>
                  {t("Simpan lowongan", "Save job")}
                </button>
                {(["CV", "LETTER"] as const).map((kind) => (
                  <button
                    key={kind}
                    onClick={async () => {
                      if (!user) {
                        router.push("/login");
                        return;
                      }
                      try {
                        const doc = await createDocument(
                          kind,
                          lang,
                          detail.data!,
                        );
                        router.push(
                          `/${kind === "CV" ? "cvs" : "letters"}/${doc.id}`,
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {kind === "CV"
                      ? t("Buat CV untuk posisi ini", "Create CV for this role")
                      : t("Buat surat lamaran", "Create cover letter")}
                  </button>
                ))}
                <button
                  onClick={async () => {
                    if (!user) {
                      router.push("/login");
                      return;
                    }
                    try {
                      await api("applications", "POST", {
                        company: detail.data!.company,
                        title: detail.data!.title,
                        url: detail.data!.url,
                        location: detail.data!.location,
                        source: detail.data!.source,
                        status: "Interested",
                      });
                      setMessage(
                        t(
                          "Ditambahkan ke tracker sebagai Interested.",
                          "Added to tracker as Interested.",
                        ),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {t("Catat di tracker", "Add to tracker")}
                </button>
              </div>
              <p className="muted">
                {t(
                  "Membuka situs sumber tidak berarti lamaran sudah terkirim.",
                  "Opening the source does not submit an application.",
                )}
              </p>
              <Notice text={message} />
              <Notice text={error} error />
              <article className="job-description">
                {detail.data.description}
              </article>
            </>
          )}
        </State>
      </>
    );
  const items = saved ? savedList.data?.map((s) => s.job) : list.data?.items;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {saved
              ? t("Lowongan tersimpan", "Saved jobs")
              : t("Lowongan kerja", "Job opportunities")}
          </h1>
          <p>
            {t(
              "Periksa detail dan kirim lamaran melalui situs sumber.",
              "Review the details and apply through the source website.",
            )}
          </p>
        </div>
      </div>
      {!saved && (
        <div className="job-filters">
          <Field label={t("Posisi atau perusahaan", "Role or company")}>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label={t("Lokasi", "Location")}>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <Field label={t("Pola kerja", "Work arrangement")}>
            <select
              value={arrangement}
              onChange={(e) => setArrangement(e.target.value)}
            >
              <option value="">{t("Semua", "All")}</option>
              <option>Remote</option>
              <option>Hybrid</option>
              <option>On-site</option>
            </select>
          </Field>
          <Field label={t("Sumber", "Source")}>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">{t("Semua", "All")}</option>
              {["greenhouse", "lever", "Remotive", "Manual"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label={t("Tanggal publikasi", "Published")}>
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="">{t("Semua tanggal", "Any time")}</option>
              <option value="7">7 {t("hari", "days")}</option>
              <option value="30">30 {t("hari", "days")}</option>
            </select>
          </Field>
        </div>
      )}
      <Notice text={message} />
      <Notice text={error} error />
      <State
        loading={saved ? savedList.loading : list.loading}
        error={saved ? savedList.error : list.error}
      >
        {items?.length ? (
          <div className="job-list">
            {items.map((job) => (
              <article key={job.id}>
                <div>
                  <small>{job.company}</small>
                  <h2>
                    <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                  </h2>
                  <p>
                    {[job.location, job.arrangement, job.employmentType]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <small>
                    {job.source}
                    {job.postedAt
                      ? ` · ${new Date(job.postedAt).toLocaleDateString()}`
                      : ""}
                    {!job.active ? ` · ${t("Tidak aktif", "Inactive")}` : ""}
                  </small>
                </div>
                {saved ? (
                  <button
                    onClick={async () => {
                      try {
                        await api(`saved-jobs/${job.id}`, "DELETE");
                        savedList.reload();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {t("Hapus simpanan", "Unsave")}
                  </button>
                ) : (
                  <button onClick={() => save(job)}>
                    {t("Simpan", "Save")}
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={t("Belum ada lowongan yang cocok", "No matching jobs yet")}
            description={t(
              "Coba filter lain. Lowongan akan muncul setelah sumber diaktifkan dan disinkronkan oleh admin.",
              "Try other filters. Jobs appear after an administrator enables and synchronizes a source.",
            )}
          />
        )}{" "}
        {!saved && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((n) => n - 1)}>
              {t("Sebelumnya", "Previous")}
            </button>
            <span>{page}</span>
            <button
              disabled={page * 30 >= (list.data?.total ?? 0)}
              onClick={() => setPage((n) => n + 1)}
            >
              {t("Berikutnya", "Next")}
            </button>
          </div>
        )}
      </State>
    </>
  );
}
type Application = {
  id?: string;
  company: string;
  title: string;
  status: (typeof statuses)[number];
  location: string;
  url: string;
  source: string;
  cvId: string | null;
  letterId: string | null;
  appliedDate: string;
  followUpDate: string;
  notes: string;
};
const blank: Application = {
  company: "",
  title: "",
  status: "Interested",
  location: "",
  url: "",
  source: "",
  cvId: null,
  letterId: null,
  appliedDate: "",
  followUpDate: "",
  notes: "",
};
export function Tracker() {
  const { t } = useApp();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [view, setView] = useState("table"),
    [editing, setEditing] = useState<Application | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const l = useLoad<{ items: Application[]; total: number }>(
    `applications?q=${encodeURIComponent(query)}`,
  );
  const cvs = useLoad<{ items: { id: string; title: string }[] }>(
      "documents?kind=CV",
    ),
    letters = useLoad<{ items: { id: string; title: string }[] }>(
      "documents?kind=LETTER",
    );
  const rows =
    l.data?.items.filter((a) => !status || a.status === status) ?? [];
  const change = async (a: Application, next: string) => {
    try {
      await api(`applications/${a.id}`, "PUT", { ...a, status: next });
      l.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Tracker lamaran", "Application tracker")}</h1>
          <p>
            {t(
              "Catat status, dokumen, dan tindak lanjut lamaran Anda.",
              "Track status, documents, and follow-ups.",
            )}
          </p>
        </div>
        <button className="primary" onClick={() => setEditing({ ...blank })}>
          {t("Tambah lamaran", "Add application")}
        </button>
      </div>
      <div className="row filters">
        <Field label={t("Cari", "Search")}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("Semua", "All")}</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <div className="row">
          <button
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            {t("Tabel", "Table")}
          </button>
          <button
            aria-pressed={view === "kanban"}
            onClick={() => setView("kanban")}
          >
            Kanban
          </button>
        </div>
      </div>
      <Notice text={error} error />
      {editing && (
        <section
          className="panel"
          aria-label={t("Form lamaran", "Application form")}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  editing.id ? `applications/${editing.id}` : "applications",
                  editing.id ? "PUT" : "POST",
                  editing,
                );
                setEditing(null);
                l.reload();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>
              {editing.id
                ? t("Edit lamaran", "Edit application")
                : t("Lamaran baru", "New application")}
            </h2>
            <div className="form-grid">
              {(
                [
                  "company",
                  "title",
                  "location",
                  "url",
                  "source",
                  "appliedDate",
                  "followUpDate",
                ] as const
              ).map((k, i) => (
                <Field
                  key={k}
                  label={t(
                    [
                      "Perusahaan *",
                      "Posisi *",
                      "Lokasi",
                      "URL lamaran",
                      "Sumber",
                      "Tanggal melamar",
                      "Tindak lanjut",
                    ][i],
                    [
                      "Company *",
                      "Role *",
                      "Location",
                      "Application URL",
                      "Source",
                      "Applied date",
                      "Follow-up date",
                    ][i],
                  )}
                >
                  <input
                    required={k === "company" || k === "title"}
                    type={k.endsWith("Date") ? "date" : "text"}
                    value={editing[k]}
                    onChange={(e) =>
                      setEditing({ ...editing, [k]: e.target.value })
                    }
                  />
                </Field>
              ))}
              <Field label="Status">
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as Application["status"],
                    })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="CV">
                <select
                  value={editing.cvId ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, cvId: e.target.value || null })
                  }
                >
                  <option value="">{t("Tanpa dokumen", "No document")}</option>
                  {cvs.data?.items.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Surat lamaran", "Cover letter")}>
                <select
                  value={editing.letterId ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, letterId: e.target.value || null })
                  }
                >
                  <option value="">{t("Tanpa dokumen", "No document")}</option>
                  {letters.data?.items.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("Catatan", "Notes")}>
              <textarea
                value={editing.notes}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </Field>
            <div className="row">
              <button className="primary" disabled={busy}>
                {busy
                  ? t("Menyimpan…", "Saving…")
                  : t("Simpan lamaran", "Save application")}
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                {t("Batal", "Cancel")}
              </button>
            </div>
          </form>
        </section>
      )}
      <State loading={l.loading} error={l.error}>
        {rows.length ? (
          view === "table" ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Perusahaan / posisi", "Company / role")}</th>
                    <th>Status</th>
                    <th>{t("Tindak lanjut", "Follow-up")}</th>
                    <th>{t("Tindakan", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.company}</strong>
                        <br />
                        {a.title}
                      </td>
                      <td>
                        <select
                          aria-label={`${a.company} status`}
                          value={a.status}
                          onChange={(e) => change(a, e.target.value)}
                        >
                          {statuses.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {a.followUpDate ||
                          t("Belum dijadwalkan", "Not scheduled")}
                      </td>
                      <td>
                        <div className="row">
                          <button onClick={() => setEditing(a)}>Edit</button>
                          <button
                            className="text-danger"
                            onClick={async () => {
                              if (
                                confirm(
                                  t(
                                    "Hapus catatan lamaran ini?",
                                    "Delete this application?",
                                  ),
                                )
                              )
                                try {
                                  await api(`applications/${a.id}`, "DELETE");
                                  l.reload();
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                            }}
                          >
                            {t("Hapus", "Delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="kanban">
              {statuses
                .filter((s) => !status || status === s)
                .map((s) => (
                  <section key={s}>
                    <h2>
                      {s}{" "}
                      <span>{rows.filter((a) => a.status === s).length}</span>
                    </h2>
                    {rows
                      .filter((a) => a.status === s)
                      .map((a) => (
                        <article key={a.id}>
                          <strong>{a.company}</strong>
                          <p>{a.title}</p>
                          <select
                            aria-label={`${a.company} status`}
                            value={a.status}
                            onChange={(e) => change(a, e.target.value)}
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                          <button onClick={() => setEditing(a)}>
                            {t("Edit detail", "Edit details")}
                          </button>
                        </article>
                      ))}
                  </section>
                ))}
            </div>
          )
        ) : (
          <Empty
            title={t("Belum ada lamaran", "No applications yet")}
            description={t(
              "Tambahkan lamaran manual atau dari detail lowongan.",
              "Add an application manually or from a job listing.",
            )}
          />
        )}
      </State>
    </>
  );
}
