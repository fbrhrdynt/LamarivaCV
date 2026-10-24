"use client";
import { Profile, Section, Entry, emptyProfile } from "@/lib/model";
import { useApp, Field, useLoad, State, api, Notice } from "./context";
import { useState, useEffect } from "react";
export function ProfileForm({
  value,
  onChange,
}: {
  value: Profile;
  onChange: (v: Profile) => void;
}) {
  const { t } = useApp();
  const [sectionType, setSectionType] = useState<Section["type"]>("experience");
  const update = (key: keyof Profile, v: string) =>
    onChange({ ...value, [key]: v });
  const changeSection = (index: number, s: Section) =>
    onChange({
      ...value,
      sections: value.sections.map((x, i) => (i === index ? s : x)),
    });
  const move = (items: Section[], i: number, delta: number) => {
    const copy = [...items];
    [copy[i], copy[i + delta]] = [copy[i + delta], copy[i]];
    onChange({ ...value, sections: copy });
  };
  const labels: Record<Section["type"], [string, string]> = {
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
    custom: ["Bagian khusus", "Custom section"],
  };
  const fields: [keyof Profile, string, string][] = [
    ["name", "Nama lengkap", "Full name"],
    ["headline", "Jabatan / headline", "Professional headline"],
    ["email", "Email", "Email"],
    ["phone", "Telepon", "Phone"],
    ["location", "Kota, provinsi, negara", "City, state, country"],
    ["linkedin", "LinkedIn URL", "LinkedIn URL"],
    ["website", "Portfolio URL", "Portfolio URL"],
    ["github", "GitHub URL", "GitHub URL"],
    ["targetTitle", "Posisi tujuan", "Target role"],
    ["targetIndustry", "Industri tujuan", "Target industry"],
  ];
  return (
    <div className="profile-form">
      <details open>
        <summary>{t("Informasi pribadi", "Personal information")}</summary>
        <div className="form-grid">
          {fields.map(([key, id, en]) => (
            <Field key={key} label={t(id, en)}>
              <input
                value={String(value[key])}
                type={key === "email" ? "email" : "text"}
                maxLength={240}
                onChange={(e) => update(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <Field label={t("Ringkasan profesional", "Professional summary")}>
          <textarea
            rows={5}
            value={value.summary}
            onChange={(e) => update("summary", e.target.value)}
          />
        </Field>
      </details>
      {value.sections.map((s, i) => (
        <details key={s.id} open>
          <summary>
            {s.title} <span className="muted">({s.entries.length})</span>
          </summary>
          <div className="section-tools">
            <input
              aria-label={t("Judul bagian", "Section title")}
              value={s.title}
              onChange={(e) =>
                changeSection(i, { ...s, title: e.target.value })
              }
            />
            <label className="check">
              <input
                type="checkbox"
                checked={s.visible}
                onChange={(e) =>
                  changeSection(i, { ...s, visible: e.target.checked })
                }
              />
              {t("Tampilkan", "Show")}
            </label>
            <button
              type="button"
              disabled={i === 0}
              onClick={() => move(value.sections, i, -1)}
              aria-label={t("Naikkan bagian", "Move section up")}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={i === value.sections.length - 1}
              onClick={() => move(value.sections, i, 1)}
              aria-label={t("Turunkan bagian", "Move section down")}
            >
              ↓
            </button>
            <button
              type="button"
              className="text-danger"
              onClick={() => {
                if (
                  confirm(
                    t(
                      "Hapus bagian ini beserta isinya?",
                      "Delete this section and its content?",
                    ),
                  )
                )
                  onChange({
                    ...value,
                    sections: value.sections.filter((_, n) => n !== i),
                  });
              }}
            >
              {t("Hapus bagian", "Delete section")}
            </button>
          </div>
          {s.entries.map((entry, n) => {
            const edit = (key: keyof Entry, v: string | boolean) =>
              changeSection(i, {
                ...s,
                entries: s.entries.map((x, k) =>
                  k === n ? { ...x, [key]: v } : x,
                ),
              });
            return (
              <fieldset key={entry.id}>
                <legend>
                  {t("Entri", "Entry")} {n + 1}
                </legend>
                <div className="form-grid">
                  <Field
                    label={t(
                      "Jabatan / gelar / keahlian",
                      "Role / degree / skill",
                    )}
                  >
                    <input
                      value={entry.title}
                      onChange={(e) => edit("title", e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t("Perusahaan / institusi", "Company / institution")}
                  >
                    <input
                      value={entry.organization}
                      onChange={(e) => edit("organization", e.target.value)}
                    />
                  </Field>
                  <Field label={t("Lokasi", "Location")}>
                    <input
                      value={entry.location}
                      onChange={(e) => edit("location", e.target.value)}
                    />
                  </Field>
                  <Field label={t("Mulai", "Start")}>
                    <input
                      type="month"
                      value={entry.start}
                      onChange={(e) => edit("start", e.target.value)}
                    />
                  </Field>
                  <Field label={t("Selesai", "End")}>
                    <input
                      type="month"
                      value={entry.end}
                      disabled={entry.current}
                      onChange={(e) => edit("end", e.target.value)}
                    />
                  </Field>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={entry.current}
                      onChange={(e) => edit("current", e.target.checked)}
                    />
                    {t("Masih berlangsung", "Ongoing")}
                  </label>
                </div>
                <Field
                  label={t(
                    "Deskripsi, pencapaian, atau detail",
                    "Description, achievements, or details",
                  )}
                >
                  <textarea
                    rows={3}
                    value={entry.description}
                    onChange={(e) => edit("description", e.target.value)}
                  />
                </Field>
                <div className="row">
                  <button
                    type="button"
                    disabled={n === 0}
                    onClick={() => {
                      const entries = [...s.entries];
                      [entries[n], entries[n - 1]] = [
                        entries[n - 1],
                        entries[n],
                      ];
                      changeSection(i, { ...s, entries });
                    }}
                  >
                    {t("Naikkan", "Move up")}
                  </button>
                  <button
                    type="button"
                    disabled={n === s.entries.length - 1}
                    onClick={() => {
                      const entries = [...s.entries];
                      [entries[n], entries[n + 1]] = [
                        entries[n + 1],
                        entries[n],
                      ];
                      changeSection(i, { ...s, entries });
                    }}
                  >
                    {t("Turunkan", "Move down")}
                  </button>
                  <button
                    type="button"
                    className="text-danger"
                    onClick={() => {
                      if (confirm(t("Hapus entri ini?", "Delete this entry?")))
                        changeSection(i, {
                          ...s,
                          entries: s.entries.filter((_, k) => k !== n),
                        });
                    }}
                  >
                    {t("Hapus entri", "Delete entry")}
                  </button>
                </div>
              </fieldset>
            );
          })}
          <button
            type="button"
            onClick={() =>
              changeSection(i, {
                ...s,
                entries: [
                  ...s.entries,
                  {
                    id: crypto.randomUUID(),
                    title: "",
                    organization: "",
                    location: "",
                    start: "",
                    end: "",
                    current: false,
                    description: "",
                  },
                ],
              })
            }
          >
            {t("Tambah entri", "Add entry")}
          </button>
        </details>
      ))}
      <div className="row">
        <Field label={t("Bagian baru", "New section")}>
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value as Section["type"])}
          >
            {Object.entries(labels).map(([key, labels]) => (
              <option key={key} value={key}>
                {t(...labels)}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              sections: [
                ...value.sections,
                {
                  id: crypto.randomUUID(),
                  type: sectionType,
                  title: t(...labels[sectionType]),
                  visible: true,
                  entries: [],
                },
              ],
            })
          }
        >
          {t("Tambah bagian", "Add section")}
        </button>
      </div>
    </div>
  );
}
export function ProfilePage() {
  const { t } = useApp();
  const load = useLoad<Profile>("profile");
  const [p, setP] = useState(emptyProfile()),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (load.data) setP(load.data);
  }, [load.data]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Profil profesional", "Professional profile")}</h1>
          <p>
            {t(
              "Sumber informasi untuk CV dan surat lamaran baru.",
              "The source for new CVs and cover letters.",
            )}
          </p>
        </div>
        <button
          className="primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await api("profile", "PUT", p);
              setMessage(t("Profil tersimpan.", "Profile saved."));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving
            ? t("Menyimpan…", "Saving…")
            : t("Simpan profil", "Save profile")}
        </button>
      </div>
      <Notice text={message} />
      <Notice text={error} error />
      <State loading={load.loading} error={load.error}>
        <div className="narrow">
          <ProfileForm value={p} onChange={setP} />
        </div>
      </State>
    </>
  );
}
