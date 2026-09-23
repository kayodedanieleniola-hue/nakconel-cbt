"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({
  redirectTo = "/login",
  role = "student",
  className,
}: {
  redirectTo?: string;
  role?: "student" | "admin";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={className}
      style={{
        background: "transparent",
        border: "1px solid var(--gold-400)",
        color: "var(--cream-50)",
        padding: "0.5rem 1rem",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: "0.9rem",
      }}
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
