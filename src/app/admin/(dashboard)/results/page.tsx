"use client";

import { useEffect, useState } from "react";

type Result = {
  id: string;
  student: { studentId: string; fullName: string; email: string };
  course: string;
  exam: string;
  score: number;
  passingScore: number;
  passed: boolean;
  status: string;
  submittedAt: string | null;
};

export default function AdminResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/results")
      .then((response) => response.json())
      .then((data) => setResults(data.results ?? []))
      .finally(() => setLoading(false));
  }, []);

  const visible = results.filter((result) => {
    const value = `${result.student.studentId} ${result.student.fullName} ${result.student.email} ${result.course} ${result.exam}`.toLowerCase();
    return value.includes(search.toLowerCase().trim());
  });

  return (
    <div>
      <p style={eyebrow}>Admin report</p>
      <h1 style={{ fontSize: "1.9rem", marginBottom: "0.5rem" }}>Exam results</h1>
      <p style={muted}>Completed submissions and automatic scores.</p>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, course, or test" style={input} />
      {loading ? <p style={muted}>Loading...</p> : visible.length === 0 ? <p style={empty}>No submitted results yet.</p> : (
        <div style={tableWrap}><table style={table}><thead><tr><th style={cell}>Student</th><th style={cell}>Course / Test</th><th style={cell}>Score</th><th style={cell}>Status</th><th style={cell}>Submitted</th></tr></thead><tbody>{visible.map((result) => <tr key={result.id}><td style={cell}><strong>{result.student.fullName}</strong><br /><span style={small}>{result.student.studentId} · {result.student.email}</span></td><td style={cell}>{result.course}<br /><span style={small}>{result.exam}</span></td><td style={cell}><strong>{result.score}%</strong><br /><span style={small}>Pass: {result.passingScore}%</span></td><td style={{ ...cell, color: result.passed ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>{result.status === "TIMED_OUT" ? "Timed out" : result.passed ? "Passed" : "Not passed"}</td><td style={cell}>{result.submittedAt ? new Date(result.submittedAt).toLocaleString() : "-"}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

const eyebrow = { color: "var(--gold-600)", fontWeight: 600, fontSize: "0.9rem" } as const;
const muted = { color: "var(--ink-600)", fontSize: "0.9rem" } as const;
const input = { width: "100%", maxWidth: 520, border: "1px solid var(--line)", borderRadius: 4, padding: "0.7rem 0.75rem", margin: "1rem 0 1.25rem" } as const;
const empty = { border: "1px dashed var(--gold-400)", borderRadius: 6, padding: "1.5rem", color: "var(--ink-600)" } as const;
const tableWrap = { overflowX: "auto", background: "#fff", border: "1px solid var(--line)", borderRadius: 6 } as const;
const table = { width: "100%", minWidth: 720, borderCollapse: "collapse" } as const;
const cell = { padding: "0.85rem 1rem", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.88rem" } as const;
const small = { color: "var(--ink-600)", fontSize: "0.78rem" } as const;
