"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { label, input, fieldGroup, submitButton, errorText, helpText } from "@/components/formStyles";

type Course = { id: string; name: string };

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  age: string;
  gender: string;
  address: string;
  socialMedia: string;
  password: string;
  confirmPassword: string;
  courseId: string;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  age: "",
  gender: "",
  address: "",
  socialMedia: "",
  password: "",
  confirmPassword: "",
  courseId: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ studentId: string; course: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/register")
      .then((res) => res.json())
      .then((data) => setCourses(data.courses ?? []))
      .catch(() => setError("Couldn't load the list of courses. Refresh the page to try again."))
      .finally(() => setCoursesLoading(false));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          age: form.age,
          gender: form.gender,
          address: form.address,
          socialMedia: form.socialMedia,
          password: form.password,
          courseId: form.courseId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }

      setSuccess({ studentId: data.studentId, course: data.course });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AuthShell
        eyebrow="Registration complete"
        title="You're enrolled"
        subtitle="Save your Student ID — you'll use it (or your email) to log in."
      >
        <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
          <p style={{ ...label, marginBottom: "0.3rem" }}>Your Student ID</p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.9rem",
              color: "var(--burgundy-900)",
              margin: "0 0 1.25rem",
            }}
          >
            {success.studentId}
          </p>
          <p style={{ color: "var(--ink-600)", marginBottom: "1.75rem" }}>
            Enrolled in <strong>{success.course}</strong>
          </p>
          <button
            style={submitButton}
            onClick={() => router.push("/dashboard")}
          >
            Continue to my dashboard
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="New student"
      title="Register for your programme"
      subtitle="This creates your account and enrolls you in the course you select below."
      footer={
        <>
          Already registered? <Link href="/login" style={{ color: "var(--gold-600)", fontWeight: 600 }}>Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && <p style={errorText}>{error}</p>}

        <div style={fieldGroup}>
          <label style={label} htmlFor="fullName">Full name</label>
          <input
            style={input}
            id="fullName"
            required
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="email">Email</label>
          <input
            style={input}
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "0.8rem" }}>
          <div style={{ ...fieldGroup, flex: 2 }}>
            <label style={label} htmlFor="phone">Phone number</label>
            <input
              style={input}
              id="phone"
              required
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div style={{ ...fieldGroup, flex: 1 }}>
            <label style={label} htmlFor="age">Age</label>
            <input
              style={input}
              id="age"
              type="number"
              min={10}
              max={100}
              required
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            />
          </div>
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="gender">Gender</label>
          <select
            style={input}
            id="gender"
            required
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="" disabled>Select one</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="address">Address</label>
          <input
            style={input}
            id="address"
            required
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="socialMedia">Social media account (optional)</label>
          <input
            style={input}
            id="socialMedia"
            placeholder="e.g. @yourhandle"
            value={form.socialMedia}
            onChange={(e) => update("socialMedia", e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="courseId">Course</label>
          <select
            style={input}
            id="courseId"
            required
            disabled={coursesLoading}
            value={form.courseId}
            onChange={(e) => update("courseId", e.target.value)}
          >
            <option value="" disabled>
              {coursesLoading ? "Loading courses…" : "Select your course"}
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p style={helpText}>You won't need to select this again when you log in.</p>
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="password">Password</label>
          <input
            style={input}
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <p style={helpText}>At least 8 characters.</p>
        </div>

        <div style={fieldGroup}>
          <label style={label} htmlFor="confirmPassword">Confirm password</label>
          <input
            style={input}
            id="confirmPassword"
            type="password"
            required
            value={form.confirmPassword}
            onChange={(e) => update("confirmPassword", e.target.value)}
          />
        </div>

        <button style={submitButton} type="submit" disabled={submitting}>
          {submitting ? "Registering…" : "Register"}
        </button>
      </form>
    </AuthShell>
  );
}
