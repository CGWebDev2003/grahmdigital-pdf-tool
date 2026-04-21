"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Contact } from "@/lib/supabase";
import { preloadImages, generateLetterPdf, mergePdfs } from "@/lib/generateLetter";
import styles from "./page.module.css";
import hStyles from "@/components/header/header.module.css";

type EditForm = Omit<Contact, "id" | "created_at" | "angeschrieben">;

function EditContactModal({ contact, onClose, onSaved }: {
  contact: Contact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    firma: contact.firma,
    empfaenger: contact.empfaenger,
    strasse: contact.strasse,
    plz: contact.plz,
    ort: contact.ort,
    fachrichtung: contact.fachrichtung,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error: err } = await supabase.from("contacts").update(form).eq("id", contact.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
    onClose();
  }

  const fields: { name: keyof EditForm; label: string }[] = [
    { name: "firma", label: "Firma" },
    { name: "empfaenger", label: "Empfänger" },
    { name: "strasse", label: "Straße" },
    { name: "plz", label: "PLZ" },
    { name: "ort", label: "Ort" },
    { name: "fachrichtung", label: "Fachrichtung" },
  ];

  return (
    <div className={hStyles.backdrop} onClick={onClose}>
      <div className={hStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={hStyles.modalHeader}>
          <h2>Kontakt bearbeiten</h2>
          <button className={hStyles.closeBtn} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <form className={hStyles.modalBody} onSubmit={handleSubmit}>
          <div className={hStyles.formGrid}>
            {fields.map(({ name, label }) => (
              <label key={name} className={hStyles.formLabel}>
                <span>{label}</span>
                <input
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  required
                  className={hStyles.formInput}
                />
              </label>
            ))}
          </div>
          {error && <p className={hStyles.errorMsg}>{error}</p>}
          <div className={hStyles.modalFooter}>
            <button type="button" className={hStyles.cancelBtn} onClick={onClose}>Abbrechen</button>
            <button type="submit" className={hStyles.confirmBtn} disabled={saving}>
              {saving ? "Speichere…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<"offene" | "angeschriebene">("offene");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
    setContacts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
    window.addEventListener("contacts-updated", fetchContacts);
    return () => window.removeEventListener("contacts-updated", fetchContacts);
  }, [fetchContacts]);

  const filteredContacts = contacts.filter((c) =>
    activeTab === "angeschriebene" ? c.angeschrieben : !c.angeschrieben
  );

  const allSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selected.has(c.id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredContacts.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...filteredContacts.map((c) => c.id)]));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteContact(id: string) {
    if (!window.confirm("Kontakt wirklich löschen?")) return;
    await supabase.from("contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  async function toggleAngeschrieben(id: string, current: boolean) {
    await supabase.from("contacts").update({ angeschrieben: !current }).eq("id", id);
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, angeschrieben: !current } : c));
  }

  async function handleDownloadSingle(contact: Contact) {
    setDownloadingId(contact.id);
    try {
      await preloadImages();
      const pdf = generateLetterPdf(contact);
      const blob = new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GrahmDigital_Brief_${contact.firma.replace(/[^\wÀ-ž]/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleGenerate() {
    if (selected.size === 0) return;
    setGenerating(true);
    try {
      await preloadImages();
      const chosen = contacts.filter((c) => selected.has(c.id));
      const pdfs = chosen.map((c) => generateLetterPdf(c));
      const merged = await mergePdfs(pdfs);
      const blob = new Blob([merged.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "GrahmDigital_Briefe.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <span className={styles.count}>
            {filteredContacts.length} Kontakt{filteredContacts.length !== 1 ? "e" : ""}
          </span>
          <button
            className={styles.generateBtn}
            disabled={selected.size === 0 || generating}
            onClick={handleGenerate}
          >
            {generating ? (
              <><i className="bi bi-hourglass-split" /> Generiere…</>
            ) : (
              <><i className="bi bi-file-earmark-pdf" /> Briefe generieren{selected.size > 0 && ` (${selected.size})`}</>
            )}
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "offene" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("offene")}
          >
            Offene
          </button>
          <button
            className={`${styles.tab} ${activeTab === "angeschriebene" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("angeschriebene")}
          >
            Angeschriebene
          </button>
        </div>

        {loading ? (
          <p className={styles.empty}>Lade Kontakte…</p>
        ) : filteredContacts.length === 0 ? (
          <p className={styles.empty}>
            {contacts.length === 0
              ? "Noch keine Kontakte. CSV importieren oder manuell hinzufügen."
              : "Keine Kontakte in dieser Ansicht."}
          </p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th>Firma</th>
                  <th>Empfänger</th>
                  <th>Straße</th>
                  <th>PLZ</th>
                  <th>Ort</th>
                  <th>Fachrichtung</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((c) => (
                  <tr
                    key={c.id}
                    className={selected.has(c.id) ? styles.rowSelected : ""}
                    onClick={() => toggleOne(c.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
                    </td>
                    <td>{c.firma}</td>
                    <td>{c.empfaenger}</td>
                    <td>{c.strasse}</td>
                    <td>{c.plz}</td>
                    <td>{c.ort}</td>
                    <td>{c.fachrichtung}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className={c.angeschrieben ? styles.statusGreen : styles.statusGray}
                        onClick={() => toggleAngeschrieben(c.id, c.angeschrieben)}
                      >
                        {c.angeschrieben ? "Angeschrieben" : "Offen"}
                      </button>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          title="Brief als PDF herunterladen"
                          disabled={downloadingId === c.id}
                          onClick={() => handleDownloadSingle(c)}
                        >
                          <i className={downloadingId === c.id ? "bi bi-hourglass-split" : "bi bi-file-earmark-pdf"} />
                        </button>
                        <button className={styles.actionBtn} title="Bearbeiten" onClick={() => setEditContact(c)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button className={styles.actionBtn} title="Löschen" onClick={() => deleteContact(c.id)}>
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editContact && (
        <EditContactModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onSaved={fetchContacts}
        />
      )}
    </>
  );
}
