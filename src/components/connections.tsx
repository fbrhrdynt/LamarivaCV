"use client";
import { api, useApp, useLoad, Notice, State } from "./context";
export function Connections() {
  const { t, site } = useApp();
  const l =
    useLoad<{ id: string; providerId: string; accountId: string }[]>(
      "auth/list-accounts",
    );
  const [error, setError] = React.useState("");
  return (
    <section className="panel">
      <h2>{t("Koneksi akun", "Account connections")}</h2>
      <Notice text={error} error />
      <State loading={l.loading} error={l.error}>
        {l.data?.map((a) => (
          <div className="section-heading" key={a.id}>
            <span>
              {a.providerId === "credential"
                ? t("Email dan kata sandi", "Email and password")
                : a.providerId}
            </span>
            {a.providerId !== "credential" && (
              <button
                disabled={(l.data?.length ?? 0) < 2}
                onClick={async () => {
                  if (
                    confirm(
                      t(
                        "Putuskan koneksi akun ini?",
                        "Disconnect this account?",
                      ),
                    )
                  )
                    try {
                      await api("auth/unlink-account", "POST", {
                        providerId: a.providerId,
                        accountId: a.accountId,
                      });
                      l.reload();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                }}
              >
                {t("Putuskan", "Disconnect")}
              </button>
            )}
          </div>
        ))}
        {site?.googleAvailable &&
          !l.data?.some((a) => a.providerId === "google") && (
            <button
              onClick={async () => {
                try {
                  const r = await api<{ url: string }>(
                    "auth/link-social",
                    "POST",
                    { provider: "google", callbackURL: "/settings" },
                  );
                  window.location.assign(r.url);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t("Hubungkan Google", "Connect Google")}
            </button>
          )}
      </State>
      <p className="muted">
        {t(
          "Minimal satu metode masuk harus tetap terhubung.",
          "At least one sign-in method must remain connected.",
        )}
      </p>
    </section>
  );
}
import React from "react";
