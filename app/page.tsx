"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Contact } from "@/lib/supabase";
import { preloadImages, generateLetterPdf, mergePdfs } from "@/lib/generateLetter";
import styles from "./page.module.css";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
    <main className={styles.main}>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {contacts.length} Kontakt{contacts.length !== 1 ? "e" : ""}
        </span>
        <button
          className={styles.generateBtn}
          disabled={selected.size === 0 || generating}
          onClick={handleGenerate}
        >
          {generating ? (
            <>
              <i className="bi bi-hourglass-split" /> Generiere…
            </>
          ) : (
            <>
              <i className="bi bi-file-earmark-pdf" /> Briefe generieren
              {selected.size > 0 && ` (${selected.size})`}
            </>
          )}
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>Lade Kontakte…</p>
      ) : contacts.length === 0 ? (
        <p className={styles.empty}>Noch keine Kontakte. CSV importieren oder manuell hinzufügen.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Firma</th>
                <th>Empfänger</th>
                <th>Straße</th>
                <th>PLZ</th>
                <th>Ort</th>
                <th>Fachrichtung</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className={selected.has(c.id) ? styles.rowSelected : ""}
                  onClick={() => toggleOne(c.id)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                    />
                  </td>
                  <td>{c.firma}</td>
                  <td>{c.empfaenger}</td>
                  <td>{c.strasse}</td>
                  <td>{c.plz}</td>
                  <td>{c.ort}</td>
                  <td>{c.fachrichtung}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
