"use client";

import { useEffect, useState } from "react";

type Event = { id: string; actorType: string; actorId: string | null; action: string; detail: string | null; createdAt: string };

export default function SuspiciousPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/admin/suspicious").then((response) => response.json()).then((data) => setEvents(data.events ?? [])).finally(() => setLoading(false)); }, []);

  return <div><p style={eyebrow}>Security review</p><h1 style={{ fontSize: "1.9rem", marginBottom: "0.5rem" }}>Suspicious activity</h1><p style={muted}>Failed sign-ins and exam timeouts recorded by the system.</p>{loading ? <p style={muted}>Loading...</p> : events.length === 0 ? <p style={empty}>No suspicious activity recorded.</p> : <div style={list}>{events.map((event) => <article key={event.id} style={card}><strong>{label[event.action] ?? event.action}</strong><p style={small}>{event.detail ?? "No additional detail"}</p><p style={small}>{event.actorType} · {event.actorId ?? "unknown actor"} · {new Date(event.createdAt).toLocaleString()}</p></article>)}</div>}</div>;
}

const label: Record<string, string> = { "student.login_failed": "Failed student sign-in", "admin.login_failed": "Failed admin sign-in", "student.exam_timeout": "Exam timed out" };
const eyebrow = { color: "var(--gold-600)", fontWeight: 600, fontSize: "0.9rem" } as const;
const muted = { color: "var(--ink-600)", fontSize: "0.9rem" } as const;
const empty = { border: "1px dashed var(--gold-400)", borderRadius: 6, padding: "1.5rem", color: "var(--ink-600)" } as const;
const list = { display: "grid", gap: "0.8rem" } as const;
const card = { background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: "1.15rem" } as const;
const small = { color: "var(--ink-600)", fontSize: "0.8rem", margin: "0.35rem 0 0" } as const;
