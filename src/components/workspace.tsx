"use client";
import {FebroLogin} from "./febro-login";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useApp, useLoad, Field, Notice, User } from "./context";
import {
  Dashboard,
  DocumentList,
  DocumentEditor,
  TemplateList,
} from "./documents";
import { ProfilePage } from "./profile-form";
import { Jobs, Tracker } from "./jobs";
import { Admin, Support } from "./admin";
import { Connections } from "./connections";
const privatePaths = [
  "dashboard",
  "cvs",
  "letters",
  "profile",
  "settings",
  "applications",
  "saved-jobs",
  "admin",
  "support",
];
export function Workspace({ path }: { path: string[] }) {
  const page = path[0] ?? "",
    privatePage = privatePaths.includes(page);
  const { t, user, setUser, site, lang, setLang, theme, setTheme } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [checking, setChecking] = useState(privatePage),
    [sessionError, setSessionError] = useState("");
  const menu = useRef<HTMLButtonElement>(null),
    drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    if (privatePage) {
      setChecking(true);
      api<User>("me")
        .then((u) => {
          setUser(u);
          setSessionError("");
        })
        .catch((e) => {
          setSessionError(e.message);
          router.replace("/login");
        })
        .finally(() => setChecking(false));
    }
  }, [page, privatePage, router, setUser]);
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
      if (e.key === "Tab") {
        const els =
          drawer.current?.querySelectorAll<HTMLElement>("a,button,select");
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    drawer.current?.querySelector<HTMLElement>("button,a")?.focus();
    return () => document.removeEventListener("keydown", handle);
  }, [open]);
  const nav = [
    ["dashboard", "Dashboard", "Dashboard"],
    ["cvs", "CV saya", "My CVs"],
    ["letters", "Surat lamaran", "Cover letters"],
    ["jobs", "Lowongan kerja", "Job opportunities"],
    ["saved-jobs", "Tersimpan", "Saved jobs"],
    ["applications", "Tracker lamaran", "Applications"],
    ["profile", "Profil profesional", "Professional profile"],
    ["settings", "Pengaturan", "Settings"],
    ["support", "Bantuan", "Support"],
  ];
  const preferences = (
    <div className="preferences">
      <select
        aria-label={t("Bahasa antarmuka", "Interface language")}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
      >
        <option value="id">ID</option>
        <option value="en">EN</option>
      </select>
      <select
        aria-label={t("Tema", "Theme")}
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="system">{t("Sistem", "System")}</option>
        <option value="light">{t("Terang", "Light")}</option>
        <option value="dark">{t("Gelap", "Dark")}</option>
      </select>
    </div>
  );
  const content =
    page === "dashboard" ? (
      <Dashboard />
    ) : page === "cvs" || page === "letters" ? (
      path[1] ? (
        <DocumentEditor id={path[1]} />
      ) : (
        <DocumentList kind={page === "cvs" ? "CV" : "LETTER"} />
      )
    ) : page === "profile" ? (
      <ProfilePage />
    ) : page === "templates" ? (
      <TemplateList />
    ) : page === "jobs" ? (
      <Jobs id={path[1]} />
    ) : page === "saved-jobs" ? (
      <Jobs saved />
    ) : page === "applications" ? (
      <Tracker />
    ) : page === "admin" ? (
      <Admin section={path[1] ?? "overview"} />
    ) : page === "settings" ? (
      <AccountSettings />
    ) : page === "support" ? (
      <Support />
    ) : ["login", "register", "forgot-password", "reset-password"].includes(
        page,
      ) ? (
      <AuthPage mode={page} />
    ) : (
      <PublicPage page={page} />
    );
  return (
    <>
      <a className="skip-link" href="#main">
        {t("Lewati ke isi", "Skip to content")}
      </a>
      {privatePage ? (
        <div className="app-shell">
          <header className="mobile-top">
            <button
              ref={menu}
              aria-label={t("Buka navigasi", "Open navigation")}
              aria-expanded={open}
              aria-controls="app-navigation"
              onClick={() => setOpen((v) => !v)}
            >
              ☰
            </button>
            <Link className="wordmark" href="/dashboard">
              {site?.name ?? "Lamariva"}
              <span>.</span>
            </Link>
            {preferences}
          </header>
          {open && (
            <button
              className="drawer-overlay"
              aria-label={t("Tutup navigasi", "Close navigation")}
              onClick={() => {
                setOpen(false);
                menu.current?.focus();
              }}
            />
          )}
          <aside
            ref={drawer}
            id="app-navigation"
            className={`sidebar ${open ? "is-open" : ""}`}
          >
            <div className="sidebar-brand">
              <Link className="wordmark" href="/dashboard">
                {site?.name ?? "Lamariva"}
                <span>.</span>
              </Link>
              <button
                className="drawer-close"
                aria-label={t("Tutup navigasi", "Close navigation")}
                onClick={() => {
                  setOpen(false);
                  menu.current?.focus();
                }}
              >
                ×
              </button>
              <p>{t("Dokumen karier Anda", "Your career documents")}</p>
            </div>
            <nav aria-label={t("Navigasi utama", "Main navigation")}>
              {nav
                .filter(
                  (x) => x[0] !== "applications" || site?.tracker !== false,
                )
                .map(([href, id, en]) => (
                  <Link
                    href={`/${href}`}
                    key={href}
                    aria-current={page === href ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {t(id, en)}
                  </Link>
                ))}
              {user && ["ADMIN", "SUPER_ADMIN"].includes(user.role) && (
                <Link
                  href="/admin"
                  aria-current={page === "admin" ? "page" : undefined}
                >
                  Admin
                </Link>
              )}
            </nav>
            <div className="sidebar-bottom">
              {user && <FebroLogin />}
              {preferences}
              <div className="account-info">
                <span className="initial">
                  {user?.name[0]?.toUpperCase() ?? "?"}
                </span>
                <div>
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                </div>
              </div>
              <button
                onClick={async () => {
                  await api("auth/sign-out", "POST", {});
                  setUser(null);
                  router.push("/login");
                }}
              >
                {t("Keluar", "Sign out")}
              </button>
            </div>
          </aside>
          <main
            id="main"
            className={`workspace ${path[1] && ["cvs", "letters"].includes(page) ? "editing" : ""}`}
          >
            {site?.announcement && (
              <p className="announcement">{site.announcement}</p>
            )}
            {checking ? (
              <p role="status">{t("Memeriksa sesi…", "Checking session…")}</p>
            ) : sessionError ? (
              <Notice text={sessionError} error />
            ) : (
              content
            )}
          </main>
        </div>
      ) : (
        <>
          <header className="public-header">
            <Link className="wordmark" href="/">
              {site?.name ?? "Lamariva"}
              <span>.</span>
            </Link>
            <nav>
              <Link href="/templates">Template CV</Link>
              <Link href="/jobs">{t("Lowongan", "Jobs")}</Link>
              <Link href="/help">{t("Panduan", "Help")}</Link>
            </nav>
            <div className="row">
              {user && <FebroLogin />}
              {preferences}
              <Link className="button" href={user ? "/dashboard" : "/login"}>
                {user ? "Dashboard" : t("Masuk", "Sign in")}
              </Link>
            </div>
          </header>
          <main id="main" className="public-main">
            {content}
          </main>
          <footer className="public-footer">
            <p>{site?.footer ?? "© 2026 LogiSource Digital"}</p>
            <nav>
              <Link href="/about">{t("Tentang", "About")}</Link>
              <Link href="/contact">{t("Kontak", "Contact")}</Link>
              <Link href="/privacy">{t("Privasi", "Privacy")}</Link>
              <Link href="/terms">{t("Syarat", "Terms")}</Link>
            </nav>
          </footer>
        </>
      )}
    </>
  );
}
function AuthPage({ mode }: { mode: string }) {
  const { t, site, setUser } = useApp();
  const router = useRouter(),
    params = useSearchParams();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [consent, setConsent] = useState(false),
    [remember, setRemember] = useState(true),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const register = mode === "register",
    reset = mode === "reset-password",
    forgot = mode === "forgot-password";
  const heading = register
    ? t("Buat akun Lamariva", "Create a Lamariva account")
    : reset
      ? t("Kata sandi baru", "New password")
      : forgot
        ? t("Lupa kata sandi", "Forgot password")
        : t("Masuk ke ruang kerja", "Sign in to your workspace");
  return (
    <div className="auth-layout">
      <aside>
        <p className="kicker">Lamariva</p>
        <h2>
          {t(
            "Pengalaman Anda, ditulis dengan jelas.",
            "Your experience, clearly written.",
          )}
        </h2>
        <p>
          {t(
            "Satu profil untuk berbagai CV dan surat lamaran. Anda menentukan informasi yang ingin ditampilkan.",
            "One profile for multiple CVs and cover letters. You choose which information to share.",
          )}
        </p>
        <Link href="/templates">
          {t("Lihat pilihan template", "View CV templates")}
        </Link>
      </aside>
      <section className="auth-form">
        <h1>{heading}</h1>
        <Notice
          text={
            params.get("error")
              ? t(
                  "Tautan atau proses autentikasi tidak berhasil. Coba lagi.",
                  "The link or authentication process failed. Please try again.",
                )
              : ""
          }
          error
        />
        <Notice text={error} error />
        <Notice text={message} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setMessage("");
            setBusy(true);
            try {
              if (register) {
                if (!consent)
                  throw new Error(
                    t(
                      "Setujui syarat dan privasi terlebih dahulu.",
                      "Accept the terms and privacy policy.",
                    ),
                  );
                await api("auth/sign-up/email", "POST", {
                  name,
                  email,
                  password,
                  consent: true,
                  callbackURL: "/login",
                });
                setMessage(
                  t(
                    "Periksa email untuk tautan verifikasi. Jika akun sudah ada, gunakan halaman masuk.",
                    "Check your email for a verification link. If you already have an account, sign in.",
                  ),
                );
              } else if (forgot) {
                await api("recovery", "POST", { email });
                setMessage(
                  t(
                    "Jika akun mendukung reset password, instruksi dikirim ke email. Akun Google memakai pemulihan Google.",
                    "If your account supports password reset, instructions will be sent. Google accounts use Google recovery.",
                  ),
                );
              } else if (reset) {
                if (password !== confirmPassword)
                  throw new Error(
                    t(
                      "Konfirmasi kata sandi tidak sama.",
                      "Passwords do not match.",
                    ),
                  );
                await api("reset-password", "POST", {
                  token: params.get("token") ?? "",
                  password,
                });
                setMessage(
                  t(
                    "Kata sandi diubah. Silakan masuk kembali.",
                    "Password changed. Please sign in again.",
                  ),
                );
              } else {
                await api("auth/sign-in/email", "POST", {
                  email,
                  password,
                  rememberMe: remember,
                  callbackURL: "/dashboard",
                });
                setUser(await api<User>("me"));
                router.push("/dashboard");
              }
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <Field label={t("Nama lengkap", "Full name")}>
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          {!reset && (
            <Field label="Email">
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          )}
          {!forgot && (
            <>
              <Field label={t("Kata sandi", "Password")}>
                <div className="password-field">
                  <input
                    required
                    minLength={register || reset ? 12 : 1}
                    maxLength={128}
                    type={show ? "text" : "password"}
                    aria-label={t("Kata sandi", "Password")}
                    autoComplete={
                      register || reset ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      show
                        ? t("Sembunyikan kata sandi", "Hide password")
                        : t("Tampilkan kata sandi", "Show password")
                    }
                    onClick={() => setShow((v) => !v)}
                  >
                    {show ? t("Tutup", "Hide") : t("Lihat", "Show")}
                  </button>
                </div>
              </Field>
              {(register || reset) && (
                <small>
                  {t("Minimal 12 karakter.", "At least 12 characters.")}
                </small>
              )}
            </>
          )}
          {reset && (
            <Field label={t("Ulangi kata sandi", "Confirm password")}>
              <input
                required
                type="password"
                minLength={12}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          )}
          {register && (
            <label className="check">
              <input
                required
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {t("Saya menyetujui", "I agree to the")}{" "}
                <Link href="/terms">{t("Syarat", "Terms")}</Link> &{" "}
                <Link href="/privacy">{t("Privasi", "Privacy")}</Link>.
              </span>
            </label>
          )}
          {mode === "login" && (
            <div className="section-heading">
              <label className="check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                {t("Ingat saya", "Remember me")}
              </label>
              <Link href="/forgot-password">
                {t("Lupa kata sandi?", "Forgot password?")}
              </Link>
            </div>
          )}
          <button
            className="primary full"
            disabled={busy || (register && site?.registrations === false)}
          >
            {busy
              ? t("Memproses…", "Processing…")
              : register
                ? t("Daftar dengan email", "Register with email")
                : forgot
                  ? t("Kirim tautan reset", "Send reset link")
                  : reset
                    ? t("Simpan kata sandi", "Save password")
                    : t("Masuk", "Sign in")}
          </button>
        </form>
        <FebroLogin />
        {(register || mode === "login") && site?.googleAvailable && (
          <>
            <p className="separator">{t("atau", "or")}</p>
            <button
              className="full"
              disabled={busy || (register && !consent)}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api<{ url: string }>(
                    "auth/sign-in/social",
                    "POST",
                    { provider: "google", callbackURL: "/dashboard" },
                  );
                  window.location.assign(result.url);
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              {t("Lanjutkan dengan Google", "Continue with Google")}
            </button>
            <p className="muted">
              {t(
                "Dengan melanjutkan, Anda menyetujui Syarat dan Kebijakan Privasi.",
                "By continuing you accept the Terms and Privacy Policy.",
              )}
            </p>
          </>
        )}
        <p className="auth-switch">
          {register ? (
            <Link href="/login">
              {t("Sudah punya akun? Masuk", "Already have an account? Sign in")}
            </Link>
          ) : mode === "login" ? (
            <Link href="/register">
              {t("Belum punya akun? Daftar", "No account yet? Register")}
            </Link>
          ) : (
            <Link href="/login">
              {t("Kembali ke halaman masuk", "Back to sign in")}
            </Link>
          )}
        </p>
      </section>
    </div>
  );
}
function AccountSettings() {
  const { t, user, setUser, lang, setLang } = useApp();
  const [name, setName] = useState(user?.name ?? ""),
    [old, setOld] = useState(""),
    [next, setNext] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const defaults = useLoad<{ id: string; name: string }[]>("templates");
  const [defaultTemplateId, setDefaultTemplateId] = useState(
    user?.defaultTemplateId ?? "",
  );
  const run = async (fn: () => Promise<unknown>, text: string) => {
    setError("");
    try {
      await fn();
      setMessage(text);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <h1>{t("Pengaturan akun", "Account settings")}</h1>
      <Notice text={message} />
      <Notice text={error} error />
      <div className="narrow">
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              async () => {
                await api("me", "PATCH", {
                  name,
                  locale: lang,
                  defaultTemplateId: defaultTemplateId || null,
                });
                if (user)
                  setUser({
                    ...user,
                    name,
                    locale: lang,
                    defaultTemplateId: defaultTemplateId || null,
                  });
              },
              t("Pengaturan tersimpan.", "Settings saved."),
            );
          }}
        >
          <h2>{t("Profil akun", "Account profile")}</h2>
          <Field label={t("Nama tampilan", "Display name")}>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input readOnly value={user?.email ?? ""} />
          </Field>
          <Field label={t("Bahasa", "Language")}>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </Field>
          <button className="primary">
            {t("Simpan pengaturan", "Save settings")}
          </button>
          <Field label={t("Template CV default", "Default CV template")}>
            <select
              value={defaultTemplateId}
              onChange={(e) => setDefaultTemplateId(e.target.value)}
            >
              <option value="">
                {t("Ikuti default aplikasi", "Use application default")}
              </option>
              {defaults.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </form>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              async () => {
                await api("auth/change-password", "POST", {
                  currentPassword: old,
                  newPassword: next,
                  revokeOtherSessions: true,
                });
                setOld("");
                setNext("");
              },
              t("Kata sandi diubah.", "Password changed."),
            );
          }}
        >
          <h2>{t("Keamanan akun", "Account security")}</h2>
          <Field label={t("Kata sandi saat ini", "Current password")}>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={old}
              onChange={(e) => setOld(e.target.value)}
            />
          </Field>
          <Field label={t("Kata sandi baru", "New password")}>
            <input
              required
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <button>{t("Ubah kata sandi", "Change password")}</button>
        </form>
        <Connections />
        <section className="panel">
          <h2>{t("Sesi dan data", "Sessions and data")}</h2>
          <div className="row">
            <button
              onClick={() =>
                void run(async () => {
                  await api("auth/revoke-sessions", "POST", {});
                  window.location.assign("/login");
                }, "")
              }
            >
              {t("Keluar dari semua perangkat", "Sign out all devices")}
            </button>
            <a className="button" href="/api/data-export">
              {t("Unduh data saya", "Download my data")}
            </a>
          </div>
          <h3>{t("Hapus akun", "Delete account")}</h3>
          <p>
            {t(
              "CV, surat, dan catatan lamaran akan dihapus. Tindakan ini tidak dapat dibatalkan. Akun Google dapat mengajukan penghapusan melalui Support.",
              "Your documents and applications will be deleted. This cannot be undone. Google accounts can request deletion through Support.",
            )}
          </p>
          <button
            className="danger"
            onClick={async () => {
              const password = prompt(
                t(
                  "Masukkan kata sandi untuk menghapus akun:",
                  "Enter your password to delete the account:",
                ),
              );
              if (
                password &&
                confirm(
                  t(
                    "Hapus akun dan semua data?",
                    "Delete account and all data?",
                  ),
                )
              )
                void run(async () => {
                  await api("me", "DELETE", {
                    password,
                    confirmation: "DELETE",
                  });
                  setUser(null);
                  window.location.assign("/");
                }, "");
            }}
          >
            {t("Hapus akun permanen", "Permanently delete account")}
          </button>
        </section>
      </div>
    </>
  );
}
function PublicPage({ page }: { page: string }) {
  const { t, site, user } = useApp();
  if (page === "")
    return (
      <>
        <section className="home-intro">
          <div>
            <p className="kicker">
              {t(
                "CV · Surat lamaran · Tracker",
                "CV · Cover letters · Applications",
              )}
            </p>
            <h1>
              {t(
                site?.headline ?? "Satu profil. Lamaran yang lebih terarah.",
                "One profile. Applications with purpose.",
              )}
            </h1>
            <p className="lead">
              {t(
                site?.description ??
                  "Susun CV, tulis surat lamaran, dan catat proses melamar dalam satu tempat.",
                "Write your CV, prepare a tailored cover letter, and keep track of every application.",
              )}
            </p>
            <Link
              className="button primary"
              href={user ? "/dashboard" : "/register"}
            >
              {t("Buat CV saya", "Create my CV")}
            </Link>
            <p className="fine">
              {t(
                "Ekspor PDF dan DOCX. Generator standar tanpa API AI.",
                "PDF and DOCX export. Standard generation without an AI API.",
              )}
            </p>
          </div>
          <aside className="home-index">
            <h2>
              {t(
                "Persiapan lamaran, satu per satu.",
                "Prepare your application, one document at a time.",
              )}
            </h2>
            <Link href="/templates">
              <span>01</span>
              <div>
                <strong>
                  {t("CV yang sesuai tujuan", "A CV for your next role")}
                </strong>
                <p>
                  {t(
                    "Mulai dari ATS Standard atau pilih gaya lain.",
                    "Start with ATS Standard or choose another style.",
                  )}
                </p>
              </div>
            </Link>
            <Link href="/cover-letter">
              <span>02</span>
              <div>
                <strong>
                  {t(
                    "Surat untuk perusahaan pilihan",
                    "A letter for your chosen company",
                  )}
                </strong>
                <p>
                  {t(
                    "Gunakan pengalaman nyata dari profil Anda.",
                    "Use the real experience from your profile.",
                  )}
                </p>
              </div>
            </Link>
            <Link href="/jobs">
              <span>03</span>
              <div>
                <strong>
                  {t("Lowongan dan tindak lanjut", "Jobs and follow-ups")}
                </strong>
                <p>
                  {t(
                    "Simpan posisi yang relevan dan catat progres.",
                    "Save relevant roles and record your progress.",
                  )}
                </p>
              </div>
            </Link>
          </aside>
        </section>
        <section className="home-note">
          <h2>
            {t(
              "CV yang mudah dibaca. Informasi yang tetap milik Anda.",
              "A readable CV. Information you control.",
            )}
          </h2>
          <p>
            {t(
              "Setiap CV menyimpan versinya sendiri. Anda dapat menyesuaikan isi tanpa mengubah profil utama, lalu mengunduh dokumen yang dapat dibaca dan diedit.",
              "Each CV keeps its own version. Tailor the content without changing your master profile, then download a readable, editable document.",
            )}
          </p>
          <Link href="/features">
            {t("Lihat fitur Lamariva", "View Lamariva features")}
          </Link>
        </section>
      </>
    );
  const titles: Record<string, [string, string]> = {
    features: ["Fitur Lamariva", "Lamariva features"],
    about: ["Tentang Lamariva", "About Lamariva"],
    faq: ["Pertanyaan tentang CV", "CV questions"],
    contact: ["Hubungi pengelola", "Contact the operator"],
    privacy: ["Kebijakan privasi", "Privacy policy"],
    terms: ["Syarat layanan", "Terms of service"],
    help: ["Panduan melamar", "Application guide"],
    "cover-letter": ["Surat lamaran yang relevan", "A relevant cover letter"],
  };
  const custom = site?.pages?.[page as keyof NonNullable<typeof site.pages>];
  if (custom && titles[page])
    return (
      <article className="prose">
        <h1>{t(...titles[page])}</h1>
        <div className="legal-text">{custom}</div>
      </article>
    );
  if (!titles[page])
    return (
      <section className="prose">
        <h1>{t("Halaman tidak ditemukan", "Page not found")}</h1>
        <Link href="/">{t("Kembali ke beranda", "Back home")}</Link>
      </section>
    );
  return (
    <article className="prose">
      <h1>{t(...titles[page])}</h1>
      {page === "about" ? (
        <>
          <p>
            {t(
              "Lamariva dikembangkan oleh LogiSource Digital untuk membantu pencari kerja menyiapkan dokumen lamaran dan mencatat proses melamar.",
              "Lamariva is developed by LogiSource Digital to help job seekers prepare documents and track applications.",
            )}
          </p>
          <p>
            {t(
              "Kami tidak menjamin kelulusan ATS atau hasil rekrutmen. Keputusan perekrutan tetap berada pada perusahaan.",
              "We do not guarantee ATS results or hiring outcomes. Hiring decisions remain with employers.",
            )}
          </p>
        </>
      ) : page === "features" ? (
        <>
          <h2>{t("Dokumen", "Documents")}</h2>
          <p>
            {t(
              "Profil yang dapat dipakai ulang, CV dengan versi tersimpan, delapan template, surat lamaran standar, serta ekspor PDF dan DOCX.",
              "Reusable profiles, versioned CVs, eight templates, standard cover letters, and PDF/DOCX export.",
            )}
          </p>
          <h2>{t("Proses melamar", "Application process")}</h2>
          <p>
            {t(
              "Lowongan dari sumber yang diaktifkan admin, lowongan tersimpan, status lamaran, dan tanggal tindak lanjut.",
              "Jobs from administrator-enabled sources, saved jobs, application status, and follow-up dates.",
            )}
          </p>
          <Link className="button" href="/templates">
            {t("Pilih template CV", "Choose a CV template")}
          </Link>
        </>
      ) : page === "contact" ? (
        <>
          <p>
            {t(
              "Untuk pertanyaan akun, kirim permintaan melalui halaman Support setelah masuk.",
              "For account questions, send a Support request after signing in.",
            )}
          </p>
          <Link className="button" href="/support">
            {t("Buka Support", "Open Support")}
          </Link>
          {site?.contact && (
            <p>
              Email: <a href={`mailto:${site.contact}`}>{site.contact}</a>
            </p>
          )}
        </>
      ) : page === "privacy" ? (
        <div className="legal-text">
          {site?.privacy ||
            t(
              "Lamariva memproses nama, email, data profil profesional, dokumen, dan catatan lamaran yang Anda masukkan untuk menyediakan layanan. Informasi akun dan dokumen disimpan pada server pengelola.\n\nEmail digunakan untuk verifikasi, pemulihan kata sandi, dan pemberitahuan keamanan. Login Google menggunakan informasi akun yang Anda izinkan. Dokumen tidak dikirim ke layanan AI pada generator standar.\n\nAnda dapat mengunduh data dan menghapus akun melalui Pengaturan. Catatan audit dan backup dapat memiliki masa retensi berbeda; pengelola perlu mengatur dan menjelaskan jadwal retensi sebelum membuka layanan publik.\n\nHubungi pengelola melalui Support untuk pertanyaan atau permintaan terkait data. Kebijakan ini perlu dilengkapi pengelola dengan kontak, lokasi penyimpanan, dan masa retensi operasional.",
              "Lamariva processes the name, email, professional profile, documents, and application records you provide to deliver the service. Account and document information is stored on the operator’s server.\n\nEmail is used for verification, recovery, and security notices. Google sign-in uses account information you authorize. Standard generation does not send documents to an AI provider.\n\nYou can export your data and delete your account in Settings. Audit records and backups may have different retention periods; the operator must configure and disclose these before a public launch.\n\nContact Support for data requests. The operator must complete this policy with contact information, storage location, and operational retention periods.",
            )}
        </div>
      ) : page === "terms" ? (
        <div className="legal-text">
          {site?.terms ||
            t(
              "Gunakan Lamariva untuk membuat dokumen berdasarkan informasi yang benar dan yang berhak Anda gunakan. Anda bertanggung jawab meninjau dokumen sebelum dikirim kepada perusahaan.\n\nTemplate ATS berorientasi pada keterbacaan, bukan jaminan lolos seleksi. Lowongan berasal dari sumber eksternal atau input pengelola; periksa kembali detail di situs sumber. Membuka tombol lamaran tidak berarti lamaran telah dikirim.\n\nDilarang mengakses data pengguna lain, menyalahgunakan layanan, atau memasukkan konten melanggar hukum. Pengelola dapat menangguhkan akun yang menyalahgunakan layanan.\n\nPengelola perlu melengkapi ketentuan operasional dan kontak sebelum layanan dipublikasikan.",
              "Use Lamariva to create documents with accurate information that you are entitled to use. You are responsible for reviewing documents before sending them to employers.\n\nATS-oriented templates support readability and do not guarantee selection. Jobs come from external sources or operator entries; verify details at the source. Opening an application link does not submit an application.\n\nDo not access other users’ data, abuse the service, or submit unlawful content. The operator may suspend abusive accounts.\n\nThe operator must complete operational terms and contact details before public launch.",
            )}
        </div>
      ) : page === "cover-letter" ? (
        <>
          <p>
            {t(
              "Pilih profil atau CV, masukkan nama perusahaan dan posisi, lalu susun draf. Generator standar hanya memakai informasi yang Anda berikan dan tetap dapat diedit.",
              "Choose a profile or CV, enter the company and role, then draft your letter. The standard generator uses your information and remains editable.",
            )}
          </p>
          <Link
            className="button primary"
            href={user ? "/letters" : "/register"}
          >
            {t("Tulis surat lamaran", "Write a cover letter")}
          </Link>
        </>
      ) : (
        <>
          <h2>
            {t("Apakah CV pasti lolos ATS?", "Will a CV always pass ATS?")}
          </h2>
          <p>
            {t(
              "Tidak. Gunakan ATS Standard untuk tata letak satu kolom dan teks yang dapat dibaca. Sesuaikan isi dengan pengalaman nyata dan persyaratan posisi.",
              "No. ATS Standard uses a single column and readable text. Tailor the content to real experience and job requirements.",
            )}
          </p>
          <h2>
            {t(
              "Apakah perubahan profil mengubah CV lama?",
              "Do profile changes update existing CVs?",
            )}
          </h2>
          <p>
            {t(
              "Tidak otomatis. Gunakan Sinkronkan profil pada editor jika ingin mengganti data di CV tersebut. Versi sebelumnya dapat dipulihkan.",
              "Not automatically. Use Sync profile in the editor to replace the data in that CV. Previous versions can be restored.",
            )}
          </p>
          <h2>{t("Bagaimana cara mengunduh?", "How do I download?")}</h2>
          <p>
            {t(
              "Simpan dokumen, periksa tab PDF, lalu pilih Unduh PDF atau DOCX. PDF mempertahankan tata letak; DOCX dapat diedit.",
              "Save your document, review the PDF tab, then choose Download PDF or DOCX. PDF preserves layout; DOCX remains editable.",
            )}
          </p>
          <h2>
            {t("Mengapa email belum masuk?", "Why has an email not arrived?")}
          </h2>
          <p>
            {t(
              "Periksa spam dan alamat email. Jika tetap tidak masuk, hubungi pengelola agar konfigurasi SMTP dan status pengiriman diperiksa.",
              "Check spam and your email address. If it still does not arrive, contact the operator to check SMTP and delivery status.",
            )}
          </p>
          <Link href="/support">
            {t("Ajukan pertanyaan akun", "Ask an account question")}
          </Link>
        </>
      )}
    </article>
  );
}
