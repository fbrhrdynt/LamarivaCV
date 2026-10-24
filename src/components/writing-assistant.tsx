"use client";
import { useState } from "react";
import { DocumentData } from "@/lib/model";
import { api, useApp, Field, Notice } from "./context";
export function WritingAssistant({
  data,
  onApply,
}: {
  data: DocumentData;
  onApply: (value: string) => void;
}) {
  const { t, site } = useApp();
  const [consent, setConsent] = useState(false),
    [task, setTask] = useState("grammar"),
    [result, setResult] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!site?.aiAvailable) return null;
  return (
    <details>
      <summary>
        {t(
          "Bantuan penulisan AI (opsional)",
          "AI writing assistance (optional)",
        )}
      </summary>
      <Field label={t("Perbaikan", "Improvement")}>
        <select value={task} onChange={(e) => setTask(e.target.value)}>
          {[
            ["grammar", "Tata bahasa", "Grammar"],
            ["concise", "Ringkas", "Shorten"],
            ["professional", "Gaya profesional", "Professional tone"],
          ].map(([v, id, en]) => (
            <option key={v} value={v}>
              {t(id, en)}
            </option>
          ))}
        </select>
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {t(
            "Saya setuju mengirim teks dan fakta profil ke penyedia AI yang dikonfigurasi pengelola.",
            "I consent to sending this text and profile facts to the AI provider configured by the operator.",
          )}
        </span>
      </label>
      <button
        disabled={!consent || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await api<{ text: string }>("writing-assistant", "POST", {
              data,
              task,
              consent,
            });
            setResult(r.text);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? t("Memproses…", "Processing…")
          : t("Minta saran", "Suggest wording")}
      </button>
      <Notice text={error} error />
      {result && (
        <>
          <Field
            label={t(
              "Saran yang perlu Anda tinjau",
              "Suggestion for your review",
            )}
          >
            <textarea
              rows={8}
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </Field>
          <p>
            {t(
              "Periksa setiap fakta. Terapkan hanya jika sesuai pengalaman Anda.",
              "Check every fact. Apply only if it matches your experience.",
            )}
          </p>
          <button
            onClick={() => {
              onApply(result);
              setResult("");
            }}
          >
            {t("Terapkan setelah ditinjau", "Apply reviewed text")}
          </button>
        </>
      )}
    </details>
  );
}
