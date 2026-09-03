"use client";

import { useEffect, useState } from "react";
import CameraCheck from "@/components/CameraCheck";

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
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [message, setMessage] = useState("Starting exam...");
  const [actionError, setActionError] = useState<string | null>(null);
  const [attemptGone, setAttemptGone] = useState(false);
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
    if (attempt && secondsLeft !== null && secondsLeft === 0 && !result && !busy && !attemptGone) submitExam();
  }, [secondsLeft, attempt, result, busy, attemptGone]);

  async function chooseAnswer(selectedIndex: number) {
    if (!attempt || busy) return;
    const question = attempt.questions[current];
    setAttempt({ ...attempt, questions: attempt.questions.map((item) => item.id === question.id ? { ...item, selectedIndex } : item) });
    try {
      const response = await fetch(`/api/attempts/${attempt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedIndex }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        handleActionFailure(response.status, data.error, "Your answer wasn't saved");
      } else {
        setActionError(null);
      }
    } catch {
      setActionError("Your answer wasn't saved — check your connection.");
    }
  }

  async function submitExam() {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/attempts/${attempt.id}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setResult(data.result);
      } else {
        handleActionFailure(response.status, data.error, "Unable to submit exam");
      }
    } catch {
      setActionError("Couldn't reach the server. Check your connection and try submitting again.");
    } finally {
      setBusy(false);
    }
  }

  function handleActionFailure(status: number, serverError: string | undefined, fallback: string) {
    if (status === 404) {
      // The attempt this tab was working with no longer exists server-side —
      // most commonly because an admin reset it. Retrying the same request
      // will only 404 again forever, so stop and send the student to restart
      // cleanly instead of silently looping.
      setAttemptGone(true);
      setActionError("This exam session is no longer valid. It may have been reset by an administrator.");
      return;
    }
    setActionError(serverError || fallback);
  }

  if (result) {
    return <main style={shell}><section style={panel}><p style={eyebrow}>Exam complete</p><h1>Your result</h1><p style={{ fontSize: "2rem", color: "var(--burgundy-900)" }}>{result.score}%</p><p>{result.passed ? "Passed" : "Did not pass"} · {result.correctAnswers} of {result.totalQuestions} correct</p><a href="/dashboard" style={button}>Return to dashboard</a></section></main>;
  }

  if (attemptGone) {
    return <main style={shell}><section style={panel}><p style={{ ...eyebrow, color: "var(--danger)" }}>Session ended</p><h1>{actionError}</h1><p style={{ color: "var(--ink-600)", margin: "0.75rem 0 1.5rem" }}>Go back to your dashboard and start the exam again to get a fresh attempt.</p><a href="/dashboard" style={button}>Return to dashboard</a></section></main>;
  }

  if (!attempt) return <main style={shell}><section style={panel}><p>{message}</p></section></main>;

  const question = attempt.questions[current];
  const safeSecondsLeft = secondsLeft ?? 0;
  const minutes = Math.floor(safeSecondsLeft / 60).toString().padStart(2, "0");
  const seconds = (safeSecondsLeft % 60).toString().padStart(2, "0");

  return <main style={shell}><section style={{ ...panel, maxWidth: 780 }}><CameraCheck attemptId={attempt.id} /><div style={topbar}><span>Question {current + 1} of {attempt.questions.length}</span><strong>{minutes}:{seconds}</strong></div>{actionError && <p style={errorBanner}>{actionError}</p>}<h1>{question.text}</h1><div style={{ display: "grid", gap: "0.7rem" }}>{question.options.map((option, index) => <button key={option} type="button" onClick={() => chooseAnswer(index)} style={{ ...optionButton, ...(question.selectedIndex === index ? selectedOption : {}) }}>{option}</button>)}</div><div style={controls}><button type="button" disabled={current === 0} onClick={() => setCurrent(current - 1)} style={button}>Previous</button>{current < attempt.questions.length - 1 ? <button type="button" onClick={() => setCurrent(current + 1)} style={button}>Next</button> : <button type="button" onClick={submitExam} disabled={busy} style={button}>{busy ? "Submitting..." : "Submit exam"}</button>}</div></section></main>;
}

const shell = { minHeight: "100dvh", background: "var(--cream-50)", padding: "5vh 6vw" } as const;
const panel = { background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: "1.5rem", margin: "0 auto" } as const;
const eyebrow = { color: "var(--gold-600)", fontWeight: 600 } as const;
const topbar = { display: "flex", justifyContent: "space-between", marginBottom: "2rem", color: "var(--ink-600)" } as const;
const optionButton = { background: "#fff", border: "1px solid var(--line)", borderRadius: 4, padding: "0.9rem 1rem", textAlign: "left", cursor: "pointer", fontSize: "1rem" } as const;
const selectedOption = { borderColor: "var(--burgundy-900)", background: "#f4ece8" } as const;
const controls = { display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "2rem" } as const;
const button = { display: "inline-block", background: "var(--burgundy-900)", color: "#fff", border: 0, borderRadius: 4, padding: "0.7rem 1rem", textDecoration: "none", cursor: "pointer" } as const;
const errorBanner = { background: "#f2e3e0", color: "var(--danger)", padding: "0.75rem 1rem", borderRadius: 4, marginBottom: "1.25rem", fontSize: "0.9rem" } as const;
