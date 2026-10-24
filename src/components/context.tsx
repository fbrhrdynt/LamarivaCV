"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  permissions: string[];
  locale: string;
  defaultTemplateId?: string | null;
};
export type Site = {
  name: string;
  headline: string;
  description: string;
  contact: string;
  registrations: boolean;
  google: boolean;
  googleAvailable: boolean;
  smtpAvailable: boolean;
  tracker: boolean;
  ai: boolean;
  aiAvailable?: boolean;
  maintenance: boolean;
  maintenanceMessage: string;
  announcement: string;
  defaultLanguage: string;
  footer: string;
  privacy: string;
  terms: string;
  pages?: Partial<
    Record<
      "about" | "features" | "faq" | "help" | "contact" | "cover-letter",
      string
    >
  >;
  verificationSubject: string;
  resetSubject: string;
  securitySubject: string;
  emailFooter: string;
  letterOpeningId: string;
  letterOpeningEn: string;
  letterClosingId: string;
  letterClosingEn: string;
};
export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  data?: unknown,
  extra?: Record<string, string>,
): Promise<T> {
  const r = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": "application/json", ...extra },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await r.json();
  if (!r.ok)
    throw new Error(result.error ?? result.message ?? "Permintaan gagal.");
  return result;
}
const Context = createContext<{
  lang: string;
  t: (id: string, en: string) => string;
  setLang: (v: string) => void;
  theme: string;
  setTheme: (v: string) => void;
  user: User | null;
  setUser: (v: User | null) => void;
  site: Site | null;
}>({
  lang: "id",
  t: (id) => id,
  setLang: () => {},
  theme: "system",
  setTheme: () => {},
  user: null,
  setUser: () => {},
  site: null,
});
export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setL] = useState("id"),
    [theme, setT] = useState("system"),
    [user, setUser] = useState<User | null>(null),
    [site, setSite] = useState<Site | null>(null);
  useEffect(() => {
    setL(localStorage.getItem("lamariva-language") ?? "id");
    setT(localStorage.getItem("lamariva-theme") ?? "system");
    api<Site>("config")
      .then((config) => {
        setSite(config);
        if (!localStorage.getItem("lamariva-language"))
          setL(config.defaultLanguage);
      })
      .catch(() => {});
    api<User>("me")
      .then(setUser)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (v: string) => {
    setL(v);
    localStorage.setItem("lamariva-language", v);
  };
  const setTheme = (v: string) => {
    setT(v);
    localStorage.setItem("lamariva-theme", v);
  };
  return (
    <Context.Provider
      value={{
        lang,
        t: (id, en) => (lang === "id" ? id : en),
        setLang,
        theme,
        setTheme,
        user,
        setUser,
        site,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, tick]);
  return { data, setData, error, loading, reload: () => setTick((t) => t + 1) };
}
export function State({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: React.ReactNode;
}) {
  const { t } = useApp();
  return loading ? (
    <p role="status" className="loading">
      {t("Memuat…", "Loading…")}
    </p>
  ) : error ? (
    <p role="alert" className="notice error">
      {error}
    </p>
  ) : (
    children
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return text ? (
    <p
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {text}
    </p>
  ) : null;
}
