"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { label, input, fieldGroup, submitButton, errorText } from "@/components/formStyles";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Returning student"
      title="Log in"
      subtitle="Use your email or Student ID, whichever you have handy."
      footer={
        <>
          New here? <Link href="/register" style={{ color: "var(--gold-600)", fontWeight: 600 }}>Register for a course</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && <p style={errorText}>{error}</p>}

        <div style={fieldGroup}>
          <label style={label} htmlFor="identifier">Email or Student ID</label>
          <input
            style={input}
            id="identifier"
            required
            autoFocus
            placeholder="you@example.com or NAK-2026-001"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="password">Password</label>
          <input
            style={input}
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button style={submitButton} type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
