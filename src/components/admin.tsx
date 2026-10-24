"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  api,
  useApp,
  useLoad,
  State,
  Field,
  Notice,
  Site,
  Empty,
} from "./context";
import type { Template } from "./documents";
import type { Job } from "./jobs";
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  suspended: boolean;
  emailVerified: boolean;
  createdAt: string;
};
type Provider = {
  id?: string;
  kind: string;
  source: string;
  active: boolean;
  intervalHours: number;
  lastSyncAt?: string;
  lastError?: string;
};
type Event = {
  id: string;
  kind: string;
  status: string;
  message: string;
  createdAt: string;
};
type Overview = {
  users: number;
  verified: number;
  cvs: number;
  letters: number;
  downloads: number;
  jobs: number;
  sessions: number;
  events: Event[];
  providers: Provider[];
  smtp: boolean;
  version: string;
  uptime: number;
  memoryMB: number;
};
const adminSections = [
  ["overview", "Ringkasan", "Overview"],
  ["users", "Pengguna & peran", "Users & roles"],
  ["templates", "Template CV", "CV templates"],
  ["providers", "Sumber lowongan", "Job providers"],
  ["jobs", "Kelola lowongan", "Manage jobs"],
  ["settings", "Konten & pengaturan", "Content & settings"],
  ["support", "Support", "Support"],
  ["audit", "Audit log", "Audit log"],
  ["operations", "Operasional", "Operations"],
];
export function Admin({ section = "overview" }: { section?: string }) {
  const { t, user } = useApp();
  const [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const act = async (path: string, method: string, data?: unknown) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api(path, method, data, {
        "x-admin-password": password,
      });
      setMessage(
        t("Perubahan berhasil diproses.", "Changes processed successfully."),
      );
      setRefresh((n) => n + 1);
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role))
    return (
      <Notice
        text={t(
          "Akses administrator diperlukan.",
          "Administrator access required.",
        )}
        error
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="kicker">Lamariva / Admin</p>
          <h1>
            {t(
              adminSections.find((x) => x[0] === section)?.[1] ??
                "Administrasi",
              adminSections.find((x) => x[0] === section)?.[2] ??
                "Administration",
            )}
          </h1>
        </div>
      </div>
      <nav className="admin-tabs" aria-label="Admin">
        {adminSections
          .filter(
            (s) =>
              user.role === "SUPER_ADMIN" ||
              user.permissions.includes(
                s[0] === "operations" ? "overview" : s[0],
              ),
          )
          .map(([key, id, en]) => (
            <Link
              key={key}
              href={`/admin/${key}`}
              aria-current={key === section ? "page" : undefined}
            >
              {t(id, en)}
            </Link>
          ))}
      </nav>
      {section !== "overview" && section !== "audit" && (
        <div className="admin-confirm">
          <Field
            label={t(
              "Konfirmasi kata sandi admin untuk perubahan",
              "Confirm admin password for changes",
            )}
          >
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <p>
            {t(
              "Kata sandi tidak disimpan di browser. Tindakan administratif dicatat.",
              "Your password is not stored in the browser. Administrative actions are logged.",
            )}
          </p>
        </div>
      )}
      <Notice text={message} />
      <Notice text={error} error />
      {busy && <p role="status">{t("Memproses…", "Processing…")}</p>}
      <div key={`${section}-${refresh}`}>
        {section === "overview" ? (
          <AdminOverview />
        ) : section === "users" ? (
          <AdminUsers act={act} />
        ) : section === "templates" ? (
          <AdminTemplates act={act} />
        ) : section === "providers" ? (
          <AdminProviders act={act} />
        ) : section === "jobs" ? (
          <AdminJobs act={act} />
        ) : section === "settings" ? (
          <AdminSettings act={act} />
        ) : section === "support" ? (
          <Support admin act={act} />
        ) : section === "audit" ? (
          <Audit />
        ) : section === "operations" ? (
          <Operations act={act} />
        ) : (
          <Empty title={t("Halaman tidak ditemukan", "Page not found")} />
        )}
      </div>
    </>
  );
}
type Act = (path: string, method: string, data?: unknown) => Promise<unknown>;
function AdminOverview() {
  const { t } = useApp();
  const l = useLoad<Overview>("admin/overview");
  return (
    <State loading={l.loading} error={l.error}>
      {l.data && (
        <>
          <div className="stat-strip">
            {(
              [
                "users",
                "verified",
                "cvs",
                "letters",
                "downloads",
                "jobs",
              ] as const
            ).map((k, i) => (
              <div key={k}>
                <strong>{l.data![k]}</strong>
                <span>
                  {t(
                    [
                      "Pengguna",
                      "Terverifikasi",
                      "CV",
                      "Surat",
                      "Unduhan",
                      "Lowongan",
                    ][i],
                    [
                      "Users",
                      "Verified",
                      "CVs",
                      "Letters",
                      "Downloads",
                      "Jobs",
                    ][i],
                  )}
                </span>
              </div>
            ))}
          </div>
          <section className="panel">
            <h2>{t("Kesehatan aplikasi", "Application health")}</h2>
            <dl className="definition-list">
              <dt>Database</dt>
              <dd>{t("Terhubung", "Connected")}</dd>
              <dt>SMTP</dt>
              <dd>
                {l.data.smtp
                  ? t(
                      "Dikonfigurasi, cek hasil kirim di bawah",
                      "Configured, check delivery results below",
                    )
                  : t("Belum dikonfigurasi", "Not configured")}
              </dd>
              <dt>{t("Memori proses", "Process memory")}</dt>
              <dd>{l.data.memoryMB} MB</dd>
              <dt>{t("Sesi aktif", "Active sessions")}</dt>
              <dd>{l.data.sessions}</dd>
              <dt>{t("Versi", "Version")}</dt>
              <dd>{l.data.version}</dd>
            </dl>
          </section>
          <section>
            <h2>{t("Aktivitas sistem", "System activity")}</h2>
            {l.data.events.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Waktu", "Time")}</th>
                      <th>{t("Jenis", "Type")}</th>
                      <th>Status</th>
                      <th>{t("Detail", "Details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.data.events.map((e) => (
                      <tr key={e.id}>
                        <td>{new Date(e.createdAt).toLocaleString()}</td>
                        <td>{e.kind}</td>
                        <td>{e.status}</td>
                        <td>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>{t("Belum ada aktivitas sistem.", "No system events yet.")}</p>
            )}
          </section>
        </>
      )}
    </State>
  );
}
function AdminUsers({ act }: { act: Act }) {
  const { t, user } = useApp();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<AdminUser | null>(null),
    [reason, setReason] = useState("");
  const l = useLoad<{ items: AdminUser[]; total: number }>(
    `admin/users?q=${encodeURIComponent(q)}&page=${page}`,
  );
  return (
    <>
      <Field label={t("Cari nama atau email", "Search name or email")}>
        <input value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <State loading={l.loading} error={l.error}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Pengguna", "User")}</th>
                <th>{t("Peran", "Role")}</th>
                <th>Status</th>
                <th>{t("Tindakan", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {l.data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <br />
                    <small>{u.email}</small>
                  </td>
                  <td>{u.role}</td>
                  <td>
                    {u.suspended
                      ? "Suspended"
                      : u.emailVerified
                        ? "Verified"
                        : "Unverified"}
                  </td>
                  <td>
                    <button onClick={() => setSelected({ ...u })}>
                      {t("Kelola", "Manage")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage((n) => n - 1)}>
            {t("Sebelumnya", "Previous")}
          </button>
          <span>{page}</span>
          <button
            disabled={page * 30 >= (l.data?.total ?? 0)}
            onClick={() => setPage((n) => n + 1)}
          >
            {t("Berikutnya", "Next")}
          </button>
        </div>
      </State>
      {selected && (
        <section className="panel">
          <h2>{selected.email}</h2>
          <Field label={t("Alasan tindakan *", "Reason for action *")}>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
            />
          </Field>
          {user?.role === "SUPER_ADMIN" && (
            <>
              <Field label={t("Peran", "Role")}>
                <select
                  value={selected.role}
                  onChange={(e) =>
                    setSelected({ ...selected, role: e.target.value })
                  }
                >
                  {["USER", "ADMIN", "SUPER_ADMIN"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  checked={selected.suspended}
                  onChange={(e) =>
                    setSelected({ ...selected, suspended: e.target.checked })
                  }
                />
                {t("Tangguhkan akun", "Suspend account")}
              </label>
              {selected.role === "ADMIN" && (
                <fieldset>
                  <legend>{t("Izin admin", "Admin permissions")}</legend>
                  {[
                    "overview",
                    "users",
                    "templates",
                    "providers",
                    "jobs",
                    "settings",
                    "audit",
                    "support",
                    "email",
                  ].map((p) => (
                    <label className="check" key={p}>
                      <input
                        type="checkbox"
                        checked={selected.permissions.includes(p)}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            permissions: e.target.checked
                              ? [...selected.permissions, p]
                              : selected.permissions.filter((v) => v !== p),
                          })
                        }
                      />
                      {p}
                    </label>
                  ))}
                </fieldset>
              )}
              <button
                className="primary"
                onClick={() =>
                  void act("admin/users", "PATCH", {
                    ...selected,
                    reason,
                  }).catch(() => {})
                }
              >
                {t("Simpan akses", "Save access")}
              </button>
            </>
          )}
          <div className="row">
            <button
              onClick={() =>
                void act("admin/users", "POST", {
                  id: selected.id,
                  action: "revoke",
                  reason,
                }).catch(() => {})
              }
            >
              {t("Cabut semua sesi", "Revoke all sessions")}
            </button>
            <button
              onClick={() =>
                void act("admin/users", "POST", {
                  id: selected.id,
                  action: "reset",
                  reason,
                }).catch(() => {})
              }
            >
              {t("Kirim reset password", "Send password reset")}
            </button>
            <button onClick={() => setSelected(null)}>
              {t("Tutup", "Close")}
            </button>
            {user?.role === "SUPER_ADMIN" && (
              <button
                className="danger"
                onClick={() => {
                  if (
                    reason.length >= 5 &&
                    confirm(
                      t(
                        "Hapus akun dan data pengguna secara permanen? Pastikan permintaan penghapusan telah diverifikasi.",
                        "Permanently delete this account and its data? Confirm that the deletion request has been verified.",
                      ),
                    )
                  )
                    void act("admin/users", "POST", {
                      id: selected.id,
                      action: "delete",
                      reason,
                    }).catch(() => {});
                }}
              >
                {t("Hapus akun", "Delete account")}
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
function AdminTemplates({ act }: { act: Act }) {
  const { t } = useApp();
  const l = useLoad<Template[]>("admin/templates");
  const [editing, setEditing] = useState<Template | null>(null);
  return (
    <>
      <State loading={l.loading} error={l.error}>
        <div className="file-list">
          {l.data?.map((v) => (
            <div className="file-row" key={v.id}>
              <div className="file-info">
                <strong>{v.name}</strong>
                <small>
                  v{v.version} · {v.active ? "Active" : "Inactive"}{" "}
                  {v.isDefault ? "· Default" : ""}
                </small>
              </div>
              <button onClick={() => setEditing(v)}>Edit</button>
            </div>
          ))}
        </div>
      </State>
      {editing && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void act("admin/templates", "PUT", editing).catch(() => {});
          }}
        >
          <div className="form-grid">
            <Field label={t("Nama template", "Template name")}>
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </Field>
            <Field label={t("Urutan", "Position")}>
              <input
                type="number"
                min="0"
                value={editing.position}
                onChange={(e) =>
                  setEditing({ ...editing, position: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Font">
              <select
                value={editing.config.font}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    config: { ...editing.config, font: e.target.value },
                  })
                }
              >
                <option>Helvetica</option>
                <option>Times-Roman</option>
              </select>
            </Field>
            <Field label={t("Warna teks aksen", "Accent text color")}>
              <input
                type="color"
                value={editing.config.accent}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    config: { ...editing.config, accent: e.target.value },
                  })
                }
              />
            </Field>
            <Field label={t("Posisi header", "Header alignment")}>
              <select
                value={editing.config.header}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    config: { ...editing.config, header: e.target.value },
                  })
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </Field>
          </div>
          {(["active", "ats", "isDefault"] as const).map((k) => (
            <label key={k} className="check">
              <input
                type="checkbox"
                checked={editing[k]}
                onChange={(e) =>
                  setEditing({ ...editing, [k]: e.target.checked })
                }
              />
              {k}
            </label>
          ))}
          <div className="row">
            <button className="primary">
              {t("Simpan versi template", "Save template version")}
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              {t("Batal", "Cancel")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
function AdminProviders({ act }: { act: Act }) {
  const { t } = useApp();
  const l = useLoad<Provider[]>("admin/providers");
  const [edit, setEdit] = useState<Provider | null>(null);
  return (
    <>
      <p>
        {t(
          "Gunakan slug board resmi perusahaan. Remotive: source “remotive”. Pastikan izin dan ketentuan sumber sebelum mengaktifkan.",
          "Use the official company board slug. Remotive: source “remotive”. Check source permissions and terms before enabling.",
        )}
      </p>
      <button
        onClick={() =>
          setEdit({
            kind: "greenhouse",
            source: "",
            active: false,
            intervalHours: 24,
          })
        }
      >
        {t("Tambah sumber", "Add provider")}
      </button>
      <State loading={l.loading} error={l.error}>
        {l.data?.length ? (
          <div className="file-list">
            {l.data.map((p) => (
              <div className="file-row" key={p.id}>
                <div className="file-info">
                  <strong>
                    {p.kind} / {p.source}
                  </strong>
                  <small>
                    {p.active ? "Active" : "Inactive"} ·{" "}
                    {p.lastSyncAt
                      ? new Date(p.lastSyncAt).toLocaleString()
                      : t("Belum sinkron", "Never synced")}
                  </small>
                  {p.lastError && <p className="error">{p.lastError}</p>}
                </div>
                <button onClick={() => setEdit(p)}>Edit</button>
                <button
                  disabled={!p.active}
                  onClick={() =>
                    void act("admin/sync", "POST", { id: p.id }).catch(() => {})
                  }
                >
                  {t("Sinkronkan", "Sync")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty title={t("Belum ada sumber", "No providers yet")} />
        )}
      </State>
      {edit && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void act("admin/providers", edit.id ? "PUT" : "POST", edit).catch(
              () => {},
            );
          }}
        >
          <div className="form-grid">
            <Field label="Provider">
              <select
                value={edit.kind}
                onChange={(e) => setEdit({ ...edit, kind: e.target.value })}
              >
                {["greenhouse", "lever", "remotive"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label={t("Board slug / sumber", "Board slug / source")}>
              <input
                required
                pattern="[a-zA-Z0-9_-]+"
                value={edit.source}
                onChange={(e) => setEdit({ ...edit, source: e.target.value })}
              />
            </Field>
            <Field label={t("Interval (jam)", "Interval (hours)")}>
              <input
                type="number"
                min="6"
                max="168"
                value={edit.intervalHours}
                onChange={(e) =>
                  setEdit({ ...edit, intervalHours: Number(e.target.value) })
                }
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />
              {t("Aktif", "Enabled")}
            </label>
          </div>
          <div className="row">
            <button className="primary">
              {t("Simpan sumber", "Save provider")}
            </button>
            <button type="button" onClick={() => setEdit(null)}>
              {t("Batal", "Cancel")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
function AdminJobs({ act }: { act: Act }) {
  const { t } = useApp();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Partial<Job> | null>(null);
  const l = useLoad<{ items: Job[]; total: number }>(
    `admin/jobs?q=${encodeURIComponent(q)}&page=${page}`,
  );
  return (
    <>
      <div className="row">
        <Field label={t("Cari lowongan", "Search jobs")}>
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <button
          onClick={() =>
            setEdit({
              title: "",
              company: "",
              description: "",
              url: "",
              active: true,
            })
          }
        >
          {t("Tambah lowongan manual", "Add manual job")}
        </button>
      </div>
      <State loading={l.loading} error={l.error}>
        <div className="file-list">
          {l.data?.items.map((j) => (
            <div key={j.id} className="file-row">
              <div className="file-info">
                <strong>{j.title}</strong>
                <small>
                  {j.company} · {j.source} · {j.active ? "Active" : "Inactive"}
                </small>
              </div>
              <button onClick={() => setEdit(j)}>Edit</button>
            </div>
          ))}
        </div>
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage((n) => n - 1)}>
            {t("Sebelumnya", "Previous")}
          </button>
          <span>{page}</span>
          <button
            disabled={page * 30 >= (l.data?.total ?? 0)}
            onClick={() => setPage((n) => n + 1)}
          >
            {t("Berikutnya", "Next")}
          </button>
        </div>
      </State>
      {edit && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              "admin/jobs",
              edit.id ? "PUT" : "POST",
              edit.id ? { id: edit.id, job: edit } : edit,
            ).catch(() => {});
          }}
        >
          <div className="form-grid">
            {(
              [
                "title",
                "company",
                "location",
                "country",
                "arrangement",
                "employmentType",
                "seniority",
                "salary",
                "url",
              ] as const
            ).map((k) => (
              <Field label={k} key={k}>
                <input
                  required={["title", "company", "url"].includes(k)}
                  value={edit[k] ?? ""}
                  onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                />
              </Field>
            ))}
            <Field label={t("Kedaluwarsa", "Expires")}>
              <input
                type="date"
                value={edit.expiresAt?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, expiresAt: e.target.value || null })
                }
              />
            </Field>
          </div>
          <Field label={t("Deskripsi", "Description")}>
            <textarea
              required
              rows={10}
              value={edit.description ?? ""}
              onChange={(e) =>
                setEdit({ ...edit, description: e.target.value })
              }
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={edit.active}
              onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
            />
            {t("Aktif", "Active")}
          </label>
          <div className="row">
            <button className="primary">
              {t("Simpan lowongan", "Save job")}
            </button>
            <button type="button" onClick={() => setEdit(null)}>
              {t("Batal", "Cancel")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
function AdminSettings({ act }: { act: Act }) {
  const { t } = useApp();
  const l = useLoad<Site>("admin/settings");
  const [s, setS] = useState<Site | null>(null);
  useEffect(() => {
    if (l.data) setS(l.data);
  }, [l.data]);
  return (
    <State loading={l.loading} error={l.error}>
      {s && (
        <form
          className="narrow"
          onSubmit={(e) => {
            e.preventDefault();
            void act("admin/settings", "PUT", s).catch(() => {});
          }}
        >
          <div className="form-grid">
            {(
              [
                "name",
                "headline",
                "description",
                "contact",
                "footer",
                "announcement",
                "maintenanceMessage",
              ] as const
            ).map((k) => (
              <Field label={k} key={k}>
                <input
                  value={s[k]}
                  onChange={(e) => setS({ ...s, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <details>
            <summary>{t("Halaman publik", "Public pages")}</summary>
            {(
              [
                "about",
                "features",
                "faq",
                "help",
                "contact",
                "cover-letter",
              ] as const
            ).map((key) => (
              <Field key={key} label={key}>
                <textarea
                  rows={6}
                  value={s.pages?.[key] ?? ""}
                  onChange={(e) =>
                    setS({ ...s, pages: { ...s.pages, [key]: e.target.value } })
                  }
                />
              </Field>
            ))}
          </details>
          <details>
            <summary>
              {t("Template surat lamaran", "Cover letter templates")}
            </summary>
            <p>
              {t(
                "Gunakan {company}, {jobTitle}, dan {name}. Teks pembuka dan penutup tidak boleh menyatakan pengalaman yang belum diberikan pengguna.",
                "Use {company}, {jobTitle}, and {name}. Opening and closing text must not claim experience the user has not supplied.",
              )}
            </p>
            {(
              [
                "letterOpeningId",
                "letterClosingId",
                "letterOpeningEn",
                "letterClosingEn",
              ] as const
            ).map((key) => (
              <Field label={key} key={key}>
                <textarea
                  rows={4}
                  value={s[key]}
                  onChange={(e) => setS({ ...s, [key]: e.target.value })}
                />
              </Field>
            ))}
          </details>
          <details>
            <summary>{t("Template email", "Email templates")}</summary>
            {(
              [
                "verificationSubject",
                "resetSubject",
                "securitySubject",
                "emailFooter",
              ] as const
            ).map((key) => (
              <Field label={key} key={key}>
                <textarea
                  rows={2}
                  value={s[key]}
                  onChange={(e) => setS({ ...s, [key]: e.target.value })}
                />
              </Field>
            ))}
            <p>
              {t(
                "Tautan verifikasi dan reset tetap dibuat oleh sistem.",
                "Verification and reset links remain system-generated.",
              )}
            </p>
          </details>
          <fieldset>
            <legend>{t("Fitur", "Features")}</legend>
            {(
              [
                "registrations",
                "google",
                "tracker",
                "ai",
                "maintenance",
              ] as const
            ).map((k) => (
              <label key={k} className="check">
                <input
                  type="checkbox"
                  checked={s[k]}
                  onChange={(e) => setS({ ...s, [k]: e.target.checked })}
                />
                {k}
              </label>
            ))}
          </fieldset>
          {(["privacy", "terms"] as const).map((k) => (
            <Field
              key={k}
              label={t(
                k === "privacy"
                  ? "Kebijakan privasi (teks)"
                  : "Syarat layanan (teks)",
                k === "privacy"
                  ? "Privacy policy (plain text)"
                  : "Terms (plain text)",
              )}
            >
              <textarea
                rows={10}
                value={s[k]}
                onChange={(e) => setS({ ...s, [k]: e.target.value })}
              />
            </Field>
          ))}
          <p className="muted">
            {t(
              "Konten ditampilkan sebagai teks aman. Kosongkan untuk memakai teks awal.",
              "Content is displayed as safe text. Leave empty to use the initial text.",
            )}
          </p>
          <button className="primary">
            {t("Simpan pengaturan", "Save settings")}
          </button>
        </form>
      )}
    </State>
  );
}
type Ticket = {
  id: string;
  subject: string;
  message: string;
  reply: string;
  status: string;
  user?: { name: string; email: string };
};
export function Support({
  admin = false,
  act,
}: {
  admin?: boolean;
  act?: Act;
}) {
  const { t } = useApp();
  const l = useLoad<Ticket[]>(admin ? "admin/support" : "support");
  const [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Ticket | null>(null);
  return (
    <>
      {!admin && <h1>{t("Bantuan akun", "Account support")}</h1>}
      {!admin && (
        <form
          className="panel narrow"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("support", "POST", { subject, message });
              setNotice(
                t(
                  "Permintaan terkirim. Balasan tampil di halaman ini.",
                  "Request sent. Replies appear on this page.",
                ),
              );
              setSubject("");
              setMessage("");
              l.reload();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Field label={t("Subjek", "Subject")}>
            <input
              required
              minLength={3}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field label={t("Pesan", "Message")}>
            <textarea
              required
              minLength={10}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <button className="primary">
            {t("Kirim permintaan", "Send request")}
          </button>
        </form>
      )}
      <Notice text={notice} />
      <Notice text={error} error />
      <State loading={l.loading} error={l.error}>
        {l.data?.length ? (
          l.data.map((ticket) => (
            <article className="ticket panel" key={ticket.id}>
              <div className="section-heading">
                <h2>{ticket.subject}</h2>
                <span>{ticket.status}</span>
              </div>
              {admin && <small>{ticket.user?.email}</small>}
              <p>{ticket.message}</p>
              {ticket.reply && <blockquote>{ticket.reply}</blockquote>}
              {admin && (
                <button onClick={() => setSelected(ticket)}>
                  {t("Balas", "Reply")}
                </button>
              )}
            </article>
          ))
        ) : (
          <Empty title={t("Belum ada permintaan", "No support requests")} />
        )}
      </State>
      {selected && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void act?.("admin/support", "PUT", selected).catch(() => {});
          }}
        >
          <h2>{selected.subject}</h2>
          <Field label={t("Balasan", "Reply")}>
            <textarea
              rows={6}
              value={selected.reply}
              onChange={(e) =>
                setSelected({ ...selected, reply: e.target.value })
              }
            />
          </Field>
          <Field label="Status">
            <select
              value={selected.status}
              onChange={(e) =>
                setSelected({ ...selected, status: e.target.value })
              }
            >
              <option>OPEN</option>
              <option>CLOSED</option>
            </select>
          </Field>
          <button className="primary">
            {t("Simpan balasan", "Save reply")}
          </button>
        </form>
      )}
    </>
  );
}
function Audit() {
  const { t } = useApp();
  const [page, setPage] = useState(1);
  const l = useLoad<{
    items: {
      id: string;
      actorId: string;
      action: string;
      target: string;
      reason: string;
      createdAt: string;
    }[];
    total: number;
  }>(`admin/audit?page=${page}`);
  return (
    <State loading={l.loading} error={l.error}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Waktu", "Time")}</th>
              <th>{t("Pelaku", "Actor")}</th>
              <th>{t("Tindakan", "Action")}</th>
              <th>{t("Target / alasan", "Target / reason")}</th>
            </tr>
          </thead>
          <tbody>
            {l.data?.items.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.createdAt).toLocaleString()}</td>
                <td className="break">{a.actorId}</td>
                <td>{a.action}</td>
                <td className="break">
                  {a.target}
                  <br />
                  {a.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage((n) => n - 1)}>
          {t("Sebelumnya", "Previous")}
        </button>
        <span>{page}</span>
        <button
          disabled={page * 30 >= (l.data?.total ?? 0)}
          onClick={() => setPage((n) => n + 1)}
        >
          {t("Berikutnya", "Next")}
        </button>
      </div>
    </State>
  );
}
function Operations({ act }: { act: Act }) {
  const { t } = useApp();
  return (
    <section className="panel narrow">
      <h2>Email</h2>
      <p>
        {t(
          "Kirim email pengujian ke alamat akun administrator Anda. Kredensial SMTP dikelola melalui environment VPS.",
          "Send a test email to your administrator account. SMTP credentials are managed through the VPS environment.",
        )}
      </p>
      <button
        onClick={() => void act("admin/email", "POST", {}).catch(() => {})}
      >
        {t("Kirim email tes", "Send test email")}
      </button>
      <h2>{t("Backup dan pemulihan", "Backup and recovery")}</h2>
      <p>
        {t(
          "Backup terenkripsi dan pemulihan dijalankan melalui skrip deployment di VPS. Dashboard tidak menjalankan perintah shell. Lihat deploy/backup.sh dan panduan README.",
          "Encrypted backup and restore run through the VPS deployment scripts. The dashboard does not execute shell commands. See deploy/backup.sh and the README.",
        )}
      </p>
      <h2>{t("Batas rilis ini", "Release scope")}</h2>
      <p>
        {t(
          "Konfigurasi email dan sumber eksternal perlu diuji kembali di domain produksi. Modul inti dapat digunakan tanpa API AI.",
          "Email and external providers must be tested again on the production domain. Core modules work without an AI API.",
        )}
      </p>
    </section>
  );
}
