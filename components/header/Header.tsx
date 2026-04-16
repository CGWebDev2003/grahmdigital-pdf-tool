"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { supabase, type Contact } from "@/lib/supabase";
import styles from "./header.module.css";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

type CsvRow = Omit<Contact, "id" | "created_at">;

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = parseCSVLine(lines[0], delim).map((h) => h.toLowerCase().trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const vals = parseCSVLine(line, delim);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = vals[i]?.trim() ?? ""));
    return {
      firma: row["firma"] ?? "",
      empfaenger: row["empfaenger"] ?? "",
      strasse: row["strasse"] ?? "",
      plz: row["plz"] ?? "",
      ort: row["ort"] ?? "",
      fachrichtung: row["fachrichtung"] ?? "",
    };
  });
}

function dupKey(row: { firma: string; strasse: string; plz: string }) {
  return `${row.firma.toLowerCase().trim()}|${row.strasse.toLowerCase().trim()}|${row.plz.trim()}`;
}

// ─── CSV Import Modal ──────────────────────────────────────────────────────────

function CsvImportModal({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<(CsvRow & { duplicate: boolean })[]>([]);
  const [parsed, setParsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const csvRows = parseCSV(text);
    if (csvRows.length === 0) { setError("Keine gültigen Zeilen gefunden."); return; }

    const { data: existing } = await supabase.from("contacts").select("firma, strasse, plz");
    const existingKeys = new Set((existing ?? []).map(dupKey));

    setRows(csvRows.map((r) => ({ ...r, duplicate: existingKeys.has(dupKey(r)) })));
    setParsed(true);
    setError("");
  }

  async function handleConfirm() {
    const clean = rows.filter((r) => !r.duplicate);
    if (clean.length === 0) return;
    setSaving(true);
    const { error: err } = await supabase.from("contacts").insert(
      clean.map(({ duplicate: _d, ...r }) => r)
    );
    setSaving(false);
    if (err) { setError(err.message); return; }
    window.dispatchEvent(new CustomEvent("contacts-updated"));
    onClose();
  }

  const cleanCount = rows.filter((r) => !r.duplicate).length;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>CSV importieren</h2>
          <button className={styles.closeBtn} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <div className={styles.modalBody}>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className={styles.fileInput} />
          {error && <p className={styles.errorMsg}>{error}</p>}

          {parsed && (
            <>
              <p className={styles.previewInfo}>
                {rows.length} Zeilen · <span className={styles.dupLabel}>{rows.length - cleanCount} Duplikat{rows.length - cleanCount !== 1 ? "e" : ""}</span> · {cleanCount} neu
              </p>
              <div className={styles.previewWrapper}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>Status</th><th>Firma</th><th>Empfänger</th><th>Straße</th><th>PLZ</th><th>Ort</th><th>Fachrichtung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r.duplicate ? styles.dupRow : ""}>
                        <td>{r.duplicate ? <span className={styles.dupBadge}>Duplikat</span> : <span className={styles.newBadge}>Neu</span>}</td>
                        <td>{r.firma}</td><td>{r.empfaenger}</td><td>{r.strasse}</td><td>{r.plz}</td><td>{r.ort}</td><td>{r.fachrichtung}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={onClose}>Abbrechen</button>
                <button
                  className={styles.confirmBtn}
                  disabled={cleanCount === 0 || saving}
                  onClick={handleConfirm}
                >
                  {saving ? "Speichere…" : `${cleanCount} Kontakt${cleanCount !== 1 ? "e" : ""} importieren`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Contact Modal ─────────────────────────────────────────────────────────

const EMPTY_FORM: CsvRow = { firma: "", empfaenger: "", strasse: "", plz: "", ort: "", fachrichtung: "" };

function AddContactModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<CsvRow>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .ilike("firma", form.firma.trim())
      .ilike("strasse", form.strasse.trim())
      .eq("plz", form.plz.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      setSaving(false);
      setError("Duplikat: Dieser Kontakt existiert bereits (Firma + Straße + PLZ).");
      return;
    }

    const { error: err } = await supabase.from("contacts").insert([form]);
    setSaving(false);
    if (err) { setError(err.message); return; }
    window.dispatchEvent(new CustomEvent("contacts-updated"));
    onClose();
  }

  const fields: { name: keyof CsvRow; label: string; placeholder: string }[] = [
    { name: "firma", label: "Firma", placeholder: "Mustermann GmbH" },
    { name: "empfaenger", label: "Empfänger", placeholder: "Dr. Max Mustermann" },
    { name: "strasse", label: "Straße", placeholder: "Musterstraße 1" },
    { name: "plz", label: "PLZ", placeholder: "04420" },
    { name: "ort", label: "Ort", placeholder: "Markranstädt" },
    { name: "fachrichtung", label: "Fachrichtung", placeholder: "Allgemeinmedizin" },
  ];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Kontakt hinzufügen</h2>
          <button className={styles.closeBtn} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            {fields.map(({ name, label, placeholder }) => (
              <label key={name} className={styles.formLabel}>
                <span>{label}</span>
                <input
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  required
                  className={styles.formInput}
                />
              </label>
            ))}
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Abbrechen</button>
            <button type="submit" className={styles.confirmBtn} disabled={saving}>
              {saving ? "Speichere…" : "Hinzufügen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const [showCsv, setShowCsv] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <a className={styles.logoLink} href="/">
            <Image src="/logo_white.png" height={40} width={82} alt="Grahm Digital Logo" loading="eager" />
            <h1 className={styles.logoText}>Brief Tool</h1>
          </a>
          <div className={styles.actionButtonBox}>
            <button type="button" className={styles.iconBtn} title="CSV importieren" onClick={() => setShowCsv(true)}>
              <i className="bi bi-file-earmark-arrow-up" />
            </button>
            <button type="button" className={styles.iconBtn} title="Manuell hinzufügen" onClick={() => setShowAdd(true)}>
              <i className="bi bi-person-plus" />
            </button>
          </div>
        </div>
      </header>

      {showCsv && <CsvImportModal onClose={() => setShowCsv(false)} />}
      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} />}
    </>
  );
}
