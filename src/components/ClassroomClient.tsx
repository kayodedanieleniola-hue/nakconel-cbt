"use client";

/**
 * ClassroomClient — student-facing live classroom.
 *
 * MOBILE-FIRST, TWO-TAB LAYOUT:
 *
 *  Tab 1 — CLASS
 *    • Presentation fills the screen (no controls — instructor-only)
 *    • Instructor feed as a small floating picture-in-picture box
 *      in the top-right corner
 *    • Poll overlay sits below the PiP box
 *    • Agenda / Chat panel below the presentation
 *
 *  Tab 2 — STUDENTS
 *    • Student's own camera (self-preview)
 *    • Other students' cameras (via ClassroomVideoFeed)
 *
 * PRESENTATION SECURITY:
 *    • No download button shown anywhere
 *    • iframe sandbox prevents right-click save / print download
 *    • Material API also strips Content-Disposition attachment header
 *      when ?view=inline — students cannot trigger a browser download
 */

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import ClassroomVideoFeed, { type PresentationState } from "@/components/ClassroomVideoFeed";
import ClassroomChat from "@/components/ClassroomChat";
import ClassroomPollOverlay from "@/components/ClassroomPollOverlay";
import { Room } from "livekit-client";

type Material = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
};

type LearningClass = {
  id: string;
  title: string;
  course: string;
  module: string | null;
  instructor: string | null;
  description?: string | null;
  activeMaterialId?: string | null;
  presentationPage?: number | null;
};

export default function ClassroomClient({
  learningClass,
  materials,
}: {
  learningClass: LearningClass;
  materials: Material[];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeRoom,   setActiveRoom]   = useState<Room | null>(null);
  const [activeTab,    setActiveTab]    = useState<"class" | "students">("class");
  const [classSubTab,  setClassSubTab]  = useState<"presentation" | "chat">("presentation");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [presState, setPresState] = useState<PresentationState>({
    materialId:
      learningClass.activeMaterialId &&
      materials.some((m) => m.id === learningClass.activeMaterialId)
        ? learningClass.activeMaterialId
        : materials[0]?.id ?? "",
    page: learningClass.presentationPage ?? 1,
  });

  const selected    = materials.find((m) => m.id === presState.materialId);
  const previewable = selected?.mimeType === "application/pdf" ||
                      !!selected?.mimeType?.startsWith("image/");

  const handlePresentationState = useCallback((ps: PresentationState) => {
    setPresState(ps);
  }, []);

  // Log attendance
  useEffect(() => {
    if (learningClass.id) {
      void fetch("/api/learning/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: learningClass.id }),
      }).catch(() => {});
    }
  }, [learningClass.id]);

  // Fullscreen
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) void stageRef.current.requestFullscreen().catch(() => {});
    else void document.exitFullscreen().catch(() => {});
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={shell}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header style={topBar}>
        <div style={topBarLeft}>
          <Link href="/learning" style={brandLink}>Nak Learning Center</Link>
          <span style={livePill}><span style={redDot}>●</span> LIVE</span>
        </div>
        <div style={topBarRight}>
          <span style={courseLabel}>
            {learningClass.course}{learningClass.module ? ` · ${learningClass.module}` : ""}
          </span>
          <Link href="/learning" style={leaveBtn}>Leave</Link>
        </div>
      </header>

      {/* ── Tab switcher ────────────────────────────────────────────────── */}
      <div style={tabSwitcher}>
        <button
          type="button"
          onClick={() => setActiveTab("class")}
          style={{ ...tabSwitchBtn, ...(activeTab === "class" ? tabSwitchActive : {}) }}
        >
          📺 Class
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          style={{ ...tabSwitchBtn, ...(activeTab === "students" ? tabSwitchActive : {}) }}
        >
          📷 Students
        </button>
      </div>

      {/* ── ClassroomVideoFeed — ALWAYS mounted, never conditional.
          Conditional rendering causes the room to disconnect when the
          student switches tabs. We keep it mounted and use CSS visibility
          so the LiveKit connection, camera, and mic stay alive permanently. ── */}
      <div style={{ display: activeTab === "class" ? "contents" : "none" }}>
        {/* Presentation stage */}
        <div
          ref={stageRef}
          style={{ ...stageWrap, ...(isFullscreen ? fullscreenStyle : {}) }}
        >
          {/* Stage header — title + fullscreen only, NO download */}
          <div style={stageTitleBar}>
            <span style={stageName}>
              {selected ? selected.title : learningClass.title}
              {selected && (
                <span style={mimeTag}> · {formatFileType(selected.mimeType)}</span>
              )}
              {presState.page > 1 && (
                <span style={pagePill}> p.{presState.page}</span>
              )}
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              style={fsBtn}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? "⤡" : "⛶"}
            </button>
          </div>

          {/* Presentation viewport — NO toolbar, NO download */}
          <div style={presViewport}>
            {selected && previewable ? (
              <iframe
                key={`${selected.id}-p${presState.page}`}
                title={selected.title}
                src={`/api/learning/materials/${selected.id}?view=inline&page=${presState.page}${selected.mimeType === "application/pdf" ? "#toolbar=0&navpanes=0&scrollbar=0" : ""}`}
                style={presIframe}
              />
            ) : selected ? (
              <div style={presPlaceholder}>
                <span style={{ fontSize: "2.5rem" }}>📁</span>
                <p style={presPlaceholderText}>{selected.title}</p>
                <p style={presPlaceholderSub}>
                  This format cannot be previewed inline.
                </p>
              </div>
            ) : (
              <div style={presPlaceholder}>
                <span style={{ fontSize: "2.5rem" }}>📊</span>
                <p style={presPlaceholderText}>Waiting for instructor…</p>
                <p style={presPlaceholderSub}>
                  The presentation will appear here automatically.
                </p>
              </div>
            )}
          </div>

          {/* Instructor PiP — floats over the stage, top-right corner */}
          <div style={pipWrap}>
            <span style={pipLabel}>Instructor</span>
            <div style={pipFeed}>
              <ClassroomVideoFeed
                classId={learningClass.id}
                onRoomReady={setActiveRoom}
                onPresentationState={handlePresentationState}
                pipMode
              />
            </div>
            <ClassroomPollOverlay classId={learningClass.id} />
          </div>
        </div>

        {/* Sub-tabs: Agenda | Chat */}
        <div style={classSubTabBar}>
          <button
            type="button"
            onClick={() => setClassSubTab("presentation")}
            style={{ ...subTabBtn, ...(classSubTab === "presentation" ? subTabActive : {}) }}
          >
            📋 Agenda
          </button>
          <button
            type="button"
            onClick={() => setClassSubTab("chat")}
            style={{ ...subTabBtn, ...(classSubTab === "chat" ? subTabActive : {}) }}
          >
            💬 Chat &amp; Q&amp;A
          </button>
        </div>

        <div style={classSubContent}>
          {classSubTab === "presentation" && (
            <div style={agendaWrap}>
              <h4 style={agendaTitle}>{learningClass.title}</h4>
              <p style={agendaMeta}>Course: <strong>{learningClass.course}</strong></p>
              {learningClass.module && (
                <p style={agendaMeta}>Module: <strong>{learningClass.module}</strong></p>
              )}
              {learningClass.instructor && (
                <p style={agendaMeta}>Instructor: <strong>{learningClass.instructor}</strong></p>
              )}
              <hr style={agendaDivider} />
              <p style={agendaBody}>
                {learningClass.description ??
                  "Welcome to this live classroom session. Follow along on the presentation stage as your instructor covers the module materials."}
              </p>
              <hr style={agendaDivider} />
              <p style={viewOnlyNotice}>
                📌 Presentation is controlled by your instructor and updates automatically.
                Downloading materials is not permitted during the live session.
              </p>
            </div>
          )}
          {classSubTab === "chat" && (
            <div style={{ padding: "0.85rem" }}>
              <ClassroomChat
                classId={learningClass.id}
                room={activeRoom}
                isInstructor={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2 — STUDENTS
          Shows self-preview info. Camera is already live from the PiP
          ClassroomVideoFeed above (which is always mounted).
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "students" && (
        <div style={studentsTabWrap}>
          <p style={studentsHint}>
            Your camera is live. The instructor and other participants can see you.
          </p>
          <p style={studentsHintSub}>
            Switch back to the Class tab to view the presentation and instructor feed.
          </p>
          <div style={studentsNotice}>
            <span style={{ fontSize: "1.8rem" }}>📷</span>
            <p style={{ margin: "0.3rem 0 0", color: "#f3eee7", fontWeight: 600 }}>
              Camera is broadcasting
            </p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#a38b80" }}>
              Your microphone is also live
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

function formatFileType(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Word";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Spreadsheet";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "Slides";
  return "Document";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  minHeight: "100dvh",          // dvh = dynamic viewport height (handles mobile chrome bar)
  background: "#1e1312",
  color: "#f3eee7",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "flex",
  flexDirection: "column",
};

// Top bar
const topBar: React.CSSProperties = {
  background: "#330808",
  borderBottom: "1px solid #4a1919",
  padding: "0.6rem 1rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.5rem",
  flexShrink: 0,
};
const topBarLeft: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.6rem" };
const topBarRight: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.6rem" };
const brandLink: React.CSSProperties = {
  color: "#fff", fontStyle: "italic", fontWeight: 700,
  fontSize: "0.95rem", textDecoration: "none",
};
const livePill: React.CSSProperties = {
  background: "#4d1010", color: "#ffd98a",
  border: "1px solid #98661B",
  padding: "0.15rem 0.45rem", borderRadius: 20,
  fontSize: "0.68rem", fontWeight: 700,
  display: "flex", alignItems: "center", gap: "0.25rem",
};
const redDot: React.CSSProperties = { color: "#ff4d4d", fontSize: "0.6rem" };
const courseLabel: React.CSSProperties = {
  color: "#d4b684", fontSize: "0.75rem",
  maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const leaveBtn: React.CSSProperties = {
  color: "#fff", textDecoration: "none",
  background: "transparent", border: "1px solid #98661B",
  borderRadius: 4, padding: "0.3rem 0.6rem",
  fontSize: "0.78rem", fontWeight: 600,
};

// Tab switcher
const tabSwitcher: React.CSSProperties = {
  display: "flex",
  background: "#180c0b",
  borderBottom: "1px solid #3b2220",
  flexShrink: 0,
};
const tabSwitchBtn: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none",
  borderBottom: "2px solid transparent",
  color: "#a38b80", padding: "0.7rem 0.5rem",
  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
};
const tabSwitchActive: React.CSSProperties = {
  color: "#ffd98a", borderBottomColor: "#98661B",
  background: "#1e1312",
};

// ── CLASS TAB ─────────────────────────────────────────────────────────────────

const classTabWrap: React.CSSProperties = {
  display: "flex", flexDirection: "column", flex: 1, overflow: "hidden",
};

// Presentation stage
const stageWrap: React.CSSProperties = {
  position: "relative",
  background: "#0c0605",
  display: "flex",
  flexDirection: "column",
  // On phone: takes ~55vh of screen, slides/PDFs fill it fully
  minHeight: "55vh",
  flex: 1,
  overflow: "hidden",
};
const fullscreenStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  borderRadius: 0, border: "none",
  height: "100dvh", width: "100vw",
};
const stageTitleBar: React.CSSProperties = {
  background: "rgba(38,19,18,0.95)",
  borderBottom: "1px solid #3b2220",
  padding: "0.4rem 0.75rem",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  gap: "0.5rem", flexShrink: 0, flexWrap: "wrap",
};
const stageName: React.CSSProperties = {
  color: "#fff", fontSize: "0.82rem", fontWeight: 600,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  flex: 1,
};
const mimeTag: React.CSSProperties = { color: "#98661B", fontSize: "0.72rem" };
const pagePill: React.CSSProperties = {
  background: "#2b1615", color: "#ffd98a",
  border: "1px solid #4a2725",
  padding: "0.1rem 0.35rem", borderRadius: 3,
  fontSize: "0.68rem", fontWeight: 600, marginLeft: "0.3rem",
};
const fsBtn: React.CSSProperties = {
  background: "#98661B", color: "#fff", border: "none",
  borderRadius: 4, padding: "0.3rem 0.55rem",
  fontSize: "1rem", cursor: "pointer", lineHeight: 1,
};
const presViewport: React.CSSProperties = {
  flex: 1, overflow: "hidden",
  display: "flex", alignItems: "stretch",
};
const presIframe: React.CSSProperties = {
  width: "100%", height: "100%",
  border: 0, background: "#fff",
  // Prevent context menu / right-click on mobile
  WebkitUserSelect: "none",
  userSelect: "none",
};
const presPlaceholder: React.CSSProperties = {
  margin: "auto", textAlign: "center",
  color: "#a38b80", padding: "2rem 1rem",
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem",
};
const presPlaceholderText: React.CSSProperties = {
  color: "#f3eee7", fontWeight: 600, margin: 0,
};
const presPlaceholderSub: React.CSSProperties = {
  fontSize: "0.78rem", color: "#8c766b", margin: 0,
};

// Instructor PiP
const pipWrap: React.CSSProperties = {
  position: "absolute",
  top: "2.8rem",   // below title bar
  right: "0.5rem",
  width: "clamp(100px, 28vw, 180px)",
  display: "flex",
  flexDirection: "column",
  gap: "0",
  zIndex: 10,
  borderRadius: 6,
  overflow: "hidden",
  boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
  border: "1.5px solid #98661B",
};
const pipLabel: React.CSSProperties = {
  background: "rgba(51,8,8,0.92)",
  color: "#ffd98a",
  fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.05em",
  padding: "0.15rem 0.4rem",
  textAlign: "center",
  borderBottom: "1px solid #98661B",
};
const pipFeed: React.CSSProperties = {
  // In pipMode ClassroomVideoFeed renders: container > videoStage (16/9) > audio (hidden)
  // The container has no gap in pipMode so this just sizes to the video.
  background: "#100707",
  aspectRatio: "16/9",
  overflow: "hidden",
};

// Sub-tabs
const classSubTabBar: React.CSSProperties = {
  display: "flex",
  background: "#180c0b",
  borderTop: "1px solid #3b2220",
  flexShrink: 0,
};
const subTabBtn: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none",
  borderTop: "2px solid transparent",
  color: "#a38b80", padding: "0.6rem 0.5rem",
  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
};
const subTabActive: React.CSSProperties = {
  color: "#ffd98a", borderTopColor: "#98661B", background: "#1e1312",
};
const classSubContent: React.CSSProperties = {
  background: "#1e1312",
  // Fixed height so it doesn't push the stage off screen
  maxHeight: "35vh",
  overflowY: "auto",
  flexShrink: 0,
};

// Agenda
const agendaWrap: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.85rem",
};
const agendaTitle: React.CSSProperties = { margin: "0 0 0.25rem", color: "#fff", fontSize: "0.95rem" };
const agendaMeta: React.CSSProperties = { margin: 0, fontSize: "0.82rem", color: "#c2aba0" };
const agendaDivider: React.CSSProperties = { borderColor: "#3b2220", margin: "0.5rem 0" };
const agendaBody: React.CSSProperties = { fontSize: "0.8rem", lineHeight: 1.5, color: "#a38b80", margin: 0 };
const viewOnlyNotice: React.CSSProperties = {
  fontSize: "0.72rem", color: "#98661B",
  background: "#1a0d0c", border: "1px solid #3b2220",
  padding: "0.4rem 0.6rem", borderRadius: 4, margin: 0,
};

// ── STUDENTS TAB ──────────────────────────────────────────────────────────────

const studentsTabWrap: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  padding: "1.5rem 1rem", gap: "0.75rem",
  background: "#1a0d0c",
};
const studentsHint: React.CSSProperties = {
  color: "#ffd98a", fontSize: "0.9rem", fontWeight: 600,
  textAlign: "center", margin: 0,
};
const studentsHintSub: React.CSSProperties = {
  color: "#8c766b", fontSize: "0.78rem",
  textAlign: "center", margin: 0,
};
const studentsNotice: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  gap: "0.3rem",
  background: "#241211", border: "1px solid #98661B",
  borderRadius: 8, padding: "1.2rem 1.5rem",
  textAlign: "center",
};
