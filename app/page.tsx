"use client";

import { useState } from "react";

export default function Home() {
  const [form, setForm] = useState({
    firma: "",
    name: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    stadt: "",
    fachrichtung: "",
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "dokument.pdf";
    a.click();
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input name="firma" placeholder="Firma" onChange={handleChange} />
        <input name="name" placeholder="Empfänger Name" onChange={handleChange} />
        <input name="strasse" placeholder="Straße" onChange={handleChange} />
        <input name="hausnummer" placeholder="Hausnummer" onChange={handleChange} />
        <input name="plz" placeholder="PLZ" onChange={handleChange} />
        <input name="stadt" placeholder="Stadt" onChange={handleChange} />
        <input name="fachrichtung" placeholder="Fachrichtung" onChange={handleChange} />

        <button type="submit">PDF erstellen</button>
      </form>
    </>
  );
}