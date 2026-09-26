"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import RefreshButton from "@/components/RefreshButton";

interface StudentShellProps {
  studentName: string;
  children: React.ReactNode;
  backTitle?: string;
  backHref?: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "home", tab: "overview" },
  { href: "/dashboard?tab=my-course", label: "My Courses", icon: "book", tab: "my-course" },
  { href: "/dashboard?tab=exams", label: "Exams", icon: "file", tab: "exams" },
  { href: "/results", label: "Results", icon: "chart", tab: "results" },
  { href: "/learning", label: "Learning Center", icon: "graduation", tab: "learning" },
  { href: "/dashboard?tab=profile", label: "Profile", icon: "user", tab: "profile" },
  { href: "/dashboard?tab=settings", label: "Settings", icon: "settings", tab: "settings" },
] as const;

type IconName = (typeof navItems)[number]["icon"] | "menu" | "close" | "logout" | "arrow-left";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </>
    ),
    file: (
      <>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </>
    ),
    chart: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
    graduation: (
      <>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </>
    ),
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    menu: (
      <>
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </>
    ),
    close: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    "arrow-left": (
      <>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function StudentShell({
  studentName,
  children,
  backTitle,
  backHref,
}: StudentShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabParam = searchParams?.get("tab") || "";
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const isNavActive = (href: string, tab?: string) => {
    if (href === "/results") return pathname === "/results";
    if (href === "/learning") return pathname === "/learning";
    if (pathname === "/dashboard") {
      if (!activeTabParam && (tab === "overview" || href === "/dashboard")) return true;
      if (activeTabParam && tab === activeTabParam) return true;
    }
    return false;
  };

  return (
    <div className="student-shell">
      {/* Top Header */}
      <header className="student-header">
        <div className="student-header__left">
          <button
            type="button"
            className="student-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={24} />
          </button>
          <Link href="/dashboard" className="student-brand">
            <img src="/logo.png" alt="Nakconel Logo" className="student-logo" />
            <div className="student-brand-text">
              <span className="student-brand-title">Nakconel Examinations</span>
              <span className="student-brand-sub">Student</span>
            </div>
          </Link>
        </div>

        <div className="student-header__right">
          <span className="student-user-name">{studentName}</span>
          <RefreshButton className="student-header-btn" />
          <LogoutButton redirectTo="/login" role="student" className="student-header-btn" />
          <div className="student-profile-avatar" title={studentName}>
            <Icon name="user" size={18} />
          </div>
        </div>
      </header>

      {/* Mobile Sub-header back link if present */}
      {backTitle && (
        <div className="student-mobile-subheader">
          <Link href={backHref || "/dashboard"} className="student-back-link">
            <Icon name="arrow-left" size={18} />
            <span>{backTitle}</span>
          </Link>
        </div>
      )}

      <div className="student-shell__body">
        {/* Desktop Sidebar */}
        <aside className="student-sidebar">
          <nav className="student-nav" aria-label="Student Navigation">
            {navItems.map((item) => {
              const active = isNavActive(item.href, item.tab);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`student-nav-item ${active ? "is-active" : ""}`}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="student-sidebar-footer">
            <div className="student-sidebar-divider" />
            <LogoutButton redirectTo="/login" role="student" className="student-sidebar-logout">
              <Icon name="logout" size={18} />
              <span>Log out</span>
            </LogoutButton>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="student-main">{children}</main>
      </div>

      {/* Mobile Navigation Drawer */}
      {drawerOpen && (
        <div className="student-drawer-layer" onClick={() => setDrawerOpen(false)}>
          <aside
            className="student-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Student Navigation Menu"
          >
            <div className="student-drawer-header">
              <div className="student-brand">
                <img src="/logo.png" alt="Nakconel Logo" className="student-logo" />
                <div className="student-brand-text">
                  <span className="student-brand-title">Nakconel Examinations</span>
                  <span className="student-brand-sub">Student</span>
                </div>
              </div>
              <button
                type="button"
                className="student-drawer-close"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <Icon name="close" size={22} />
              </button>
            </div>

            <div className="student-drawer-user">
              <span className="student-drawer-user-label">Logged in as</span>
              <strong className="student-drawer-user-name">{studentName}</strong>
            </div>

            <nav className="student-drawer-nav">
              {navItems.map((item) => {
                const active = isNavActive(item.href, item.tab);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`student-drawer-item ${active ? "is-active" : ""}`}
                  >
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="student-drawer-footer">
              <LogoutButton redirectTo="/login" role="student" className="student-drawer-logout">
                <Icon name="logout" size={20} />
                <span>Log out</span>
              </LogoutButton>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
