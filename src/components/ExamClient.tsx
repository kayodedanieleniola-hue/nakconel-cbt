"use client";

import { useEffect, useState } from "react";

type Question = {
  id: string;
  position: number;
  text: string;
  options: string[];
  selectedIndex: number | null;
};

type Attempt = {
  id: string;
  examId: string;
  status: string;
  expiresAt: string;
  questions: Question[];
};

type Result = {
  status: string;
  score: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
};

export default function ExamClient({ examId }: { examId: string }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState("Starting exam...");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/exams/${examId}/attempt`, { method: "POST" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to start exam");
        setAttempt(data.attempt);
        setMessage("");
      })
      .catch((error: Error) => setMessage(error.message));
  }, [examId]);

  useEffect(() => {
    if (!attempt) return;
    const update = () => setSecondsLeft(Math.max(0, Math.floor((Date.parse(attempt.expiresAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (attempt && secondsLeft === 0 && !result && !busy) submitExam();
  }, [secondsLeft, attempt, result, busy]);

  async function chooseAnswer(selectedIndex: number) {
    if (!attempt || busy) return;
    const question = attempt.questions[current];
    setAttempt({ ...attempt, questions: attempt.questions.map((item) => item.id === question.id ? { ...item, selectedIndex } : item) });
    await fetch(`/api/attempts/${attempt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, selectedIndex }),
    });
  }

  async function submitExam() {
    if (!attempt || busy) return;
    setBusy(true);
    const response = await fetch(`/api/attempts/${attempt.id}`, { method: "POST" });
    const data = await response.json();
    if (response.ok) setResult(data.result);
    else setMessage(data.error || "Unable to submit exam");
    setBusy(false);
  }

  if (result) {
    return <main style={shell}><section style={panel}><p style={eyebrow}>Exam complete</p><h1>Your result</h1><p style={{ fontSize: "2rem", color: "var(--burgundy-900)" }}>{result.score}%</p><p>{result.passed ? "Passed" : "Did not pass"} · {result.correctAnswers} of {result.totalQuestions} correct</p><a href="/dashboard" style={button}>Return to dashboard</a></section></main>;
  }

  if (!attempt) return <main style={shell}><section style={panel}><p>{message}</p></section></main>;

  const question = attempt.questions[current];
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  return <main style={shell}><section style={{ ...panel, maxWidth: 780 }}><div style={topbar}><span>Question {current + 1} of {attempt.questions.length}</span><strong>{minutes}:{seconds}</strong></div><h1>{question.text}</h1><div style={{ display: "grid", gap: "0.7rem" }}>{question.options.map((option, index) => <button key={option} type="button" onClick={() => chooseAnswer(index)} style={{ ...optionButton, ...(question.selectedIndex === index ? selectedOption : {}) }}>{option}</button>)}</div><div style={controls}><button type="button" disabled={current === 0} onClick={() => setCurrent(current - 1)} style={button}>Previous</button>{current < attempt.questions.length - 1 ? <button type="button" onClick={() => setCurrent(current + 1)} style={button}>Next</button> : <button type="button" onClick={submitExam} disabled={busy} style={button}>{busy ? "Submitting..." : "Submit exam"}</button>}</div></section></main>;
}

const shell = { minHeight: "100dvh", background: "var(--cream-50)", padding: "5vh 6vw" } as const;
const panel = { background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: "1.5rem", margin: "0 auto" } as const;
const eyebrow = { color: "var(--gold-600)", fontWeight: 600 } as const;
const topbar = { display: "flex", justifyContent: "space-between", marginBottom: "2rem", color: "var(--ink-600)" } as const;
const optionButton = { background: "#fff", border: "1px solid var(--line)", borderRadius: 4, padding: "0.9rem 1rem", textAlign: "left", cursor: "pointer", fontSize: "1rem" } as const;
const selectedOption = { borderColor: "var(--burgundy-900)", background: "#f4ece8" } as const;
const controls = { display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "2rem" } as const;
const button = { display: "inline-block", background: "var(--burgundy-900)", color: "#fff", border: 0, borderRadius: 4, padding: "0.7rem 1rem", textDecoration: "none", cursor: "pointer" } as const;
