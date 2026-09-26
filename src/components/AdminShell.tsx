"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import RefreshButton from "@/components/RefreshButton";

const navigation = [
  ["/admin", "Overview", "home"],
  ["/admin/students", "Students", "users"],
  ["/admin/courses", "Courses", "book"],
  ["/admin/learning", "Learning Center", "graduation"],
  ["/admin/exams", "Exams", "file"],
  ["/admin/questions", "Question Bank", "database"],
  ["/admin/results", "Results", "chart"],
  ["/admin/monitoring", "Live Monitoring", "monitor"],
  ["/admin/suspicious", "Suspicious Activity", "shield"],
  ["/admin/settings", "Settings", "settings"],
] as const;

type IconName = (typeof navigation)[number][2] | "menu" | "close" | "logout" | "user";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-6h6v6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 21v-2a5.5 5.5 0 0 1 11 0v2M16 4.5a3 3 0 0 1 0 5.8M18.5 21v-2a5.5 5.5 0 0 0-3.2-5"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M8 7h8"/></>,
    graduation: <><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11.2V16c3.7 2.7 8.3 2.7 12 0v-4.8M22 9v6"/></>,
    file: <><path d="M6 2h8l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v5h5M8 12h8M8 16h6"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    monitor: <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5"/></>,
    shield: <><path d="M12 2 4 5v6c0 5.1 3.3 9.8 8 11 4.7-1.2 8-5.9 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5.3v-3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L8.7 6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function matchesRoute(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ onNavigate, variant }: { onNavigate?: () => void; variant: "top" | "rail" | "drawer" }) {
  const pathname = usePathname();
  return <div className={`admin-nav admin-nav--${variant}`}>
    {navigation.map(([href, label, icon]) => {
      const active = matchesRoute(pathname, href);
      return <Link key={href} href={href} onClick={onNavigate} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
        {variant !== "top" && <Icon name={icon} size={19} />}<span>{label}</span>
      </Link>;
    })}
  </div>;
}

export default function AdminShell({ adminName, children }: { adminName: string; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return <div className="admin-shell">
    <header className="admin-header">
      <div className="admin-header__brand">
        <button type="button" className="admin-menu-button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" aria-expanded={drawerOpen}><Icon name="menu" size={28} /></button>
        <img src="/logo.png" alt="Nakconel" className="admin-logo" />
        <div><strong>Nakconel Examinations</strong><span>Admin</span></div>
      </div>
      <div className="admin-header__actions">
        <span className="admin-name">{adminName}</span>
        <RefreshButton className="admin-header-button admin-refresh" />
        <LogoutButton redirectTo="/admin/login" role="admin" className="admin-header-button admin-logout" />
        <span className="admin-profile-icon"><Icon name="user" size={22} /></span>
      </div>
    </header>
    <nav className="admin-top-nav" aria-label="Primary navigation"><Navigation variant="top" /></nav>
    <div className="admin-shell__body">
      <main className="admin-main">{children}</main>
    </div>
    {drawerOpen && <div className="admin-drawer-layer" role="presentation" onMouseDown={() => setDrawerOpen(false)}>
      <aside className="admin-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu" onMouseDown={(event) => event.stopPropagation()}>
        <div className="admin-drawer__brand"><img src="/logo.png" alt="" /><div><strong>Nakconel<br/>Examinations</strong><span>Admin</span></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><Icon name="close" size={22} /></button></div>
        <Navigation variant="drawer" onNavigate={() => setDrawerOpen(false)} />
        <div className="admin-drawer__logout"><Icon name="logout" size={20} /><LogoutButton redirectTo="/admin/login" role="admin" className="admin-drawer-logout" /></div>
      </aside>
    </div>}
  </div>;
}
