"use client";

/**
 * ClassroomClient — student-facing live classroom.
 * Nalconel Learning Center brand: wine-red dominant, warm gold accents.
 *
 * Layout (mobile-first, single column):
 *   TOP BAR    — Nalconel logo · course title · LIVE badge · Leave
 *   MAIN       — Presentation stage (fills screen)
 *                Instructor PiP floats top-right of stage
 *   PANEL TABS — Participants / Chat / Info  (bottom of screen)
 *   BOTTOM BAR — Mic · Camera · FullScreen · Leave (always visible)
 *
 * All LiveKit logic, presentation sync, and attendance tracking are
 * unchanged — only the visual layer has been redesigned.
 */

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import ClassroomVideoFeed, { type PresentationState } from "@/components/ClassroomVideoFeed";
import ClassroomChat from "@/components/ClassroomChat";
import ClassroomPollOverlay from "@/components/ClassroomPollOverlay";
import { Room } from "livekit-client";

// ── Brand tokens ─────────────────────────────────────────────────────────────
const WINE   = "#5c1d1d";
const WINE2  = "#7a2424";
const WINE3  = "#3a1010";
const GOLD   = "#c8943a";
const GOLD2  = "#e8b86d";
const CREAM  = "#faf6f1";
const INK    = "#f3eee7";
const MUTED  = "#b09080";
const LINE   = "#7a3030";

type Material = { id: string; title: string; fileName: string; mimeType: string; sizeBytes?: number };
type LearningClass = {
  id: string; title: string; course: string; module: string | null;
  instructor: string | null; description?: string | null;
  activeMaterialId?: string | null; presentationPage?: number | null;
};

export default function ClassroomClient({
  learningClass,
  materials,
}: {
  learningClass: LearningClass;
  materials: Material[];
}) {
  const stageRef   = useRef<HTMLDivElement>(null);
  const [activeRoom,   setActiveRoom]   = useState<Room | null>(null);
  const [activeTab,    setActiveTab]    = useState<"info" | "chat">("info");
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

  useEffect(() => {
    if (learningClass.id) {
      void fetch("/api/learning/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: learningClass.id }),
      }).catch(() => {});
    }
  }, [learningClass.id]);

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

  return (
    <div style={shell}>

      {/* ── TOP BAR ────────────────────────────────────────────────────── */}
      <header style={topBar}>
        <div style={topBarLeft}>
          {/* Logo mark + brand name */}
          <div style={logoWrap}>
            <div style={logoMark}>N</div>
            <div>
              <div style={logoName}>Nalconel</div>
              <div style={logoSub}>Learning Center</div>
            </div>
          </div>
          <div style={dividerV} />
          <div style={classInfo}>
            <span style={courseName}>{learningClass.course}</span>
            {learningClass.module && (
              <span style={moduleName}> · {learningClass.module}</span>
            )}
          </div>
        </div>

        <div style={topBarRight}>
          <span style={liveBadge}>
            <span style={liveDot} />
            LIVE
          </span>
          <Link href="/learning" style={leaveBtn}>Leave</Link>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
      <div style={mainWrap}>

        {/* Presentation stage */}
        <div
          ref={stageRef}
          style={{ ...stageCard, ...(isFullscreen ? fullscreenStyle : {}) }}
        >
          {/* Stage title strip */}
          <div style={stageStrip}>
            <span style={stageTitle}>
              {selected
                ? `${selected.title} · ${fmtType(selected.mimeType)}`
                : learningClass.title}
              {presState.page > 1 && (
                <span style={pageTag}> · p.{presState.page}</span>
              )}
            </span>
            <button type="button" onClick={toggleFullscreen} style={fsBtn} title="Fullscreen">
              {isFullscreen ? "⤡" : "⛶"}
            </button>
          </div>

          {/* Slide / PDF viewer */}
          <div style={slideArea}>
            {selected && previewable ? (
              <iframe
                key={`${selected.id}-p${presState.page}`}
                title={selected.title}
                src={`/api/learning/materials/${selected.id}?view=inline&page=${presState.page}${selected.mimeType === "application/pdf" ? "#toolbar=0&navpanes=0&scrollbar=0" : ""}`}
                style={slideFrame}
              />
            ) : (
              <div style={slidePlaceholder}>
                <span style={{ fontSize: "3rem" }}>📊</span>
                <p style={slideMsg}>
                  {selected ? selected.title : "Waiting for instructor…"}
                </p>
                <p style={slideHint}>
                  {selected
                    ? "This format cannot be previewed inline."
                    : "The presentation will appear here automatically."}
                </p>
              </div>
            )}
          </div>

          {/* Instructor PiP — top-right corner */}
          <div style={pipBox}>
            <div style={pipHead}>
              <span style={pipDot} />
              <span style={pipLabel}>Instructor</span>
            </div>
            <ClassroomVideoFeed
              classId={learningClass.id}
              onRoomReady={setActiveRoom}
              onPresentationState={handlePresentationState}
              pipMode
            />
            <ClassroomPollOverlay classId={learningClass.id} />
          </div>
        </div>

        {/* Bottom panel — tabs */}
        <div style={panelCard}>
          <div style={panelTabBar}>
            {(["info", "chat"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                style={{ ...panelTab, ...(activeTab === t ? panelTabActive : {}) }}
              >
                {t === "info" ? "ℹ️ Info" : "💬 Chat & Q&A"}
              </button>
            ))}
          </div>

          <div style={panelBody}>
            {activeTab === "info" && (
              <div style={infoPanel}>
                <h4 style={infoTitle}>{learningClass.title}</h4>
                <div style={infoRow}><span style={infoKey}>Course</span><span style={infoVal}>{learningClass.course}</span></div>
                {learningClass.module   && <div style={infoRow}><span style={infoKey}>Module</span><span style={infoVal}>{learningClass.module}</span></div>}
                {learningClass.instructor && <div style={infoRow}><span style={infoKey}>Instructor</span><span style={infoVal}>{learningClass.instructor}</span></div>}
                <div style={infoRow}><span style={infoKey}>Status</span><span style={{ ...infoVal, color: "#4dff88", fontWeight: 700 }}>● LIVE</span></div>
                <hr style={infoDivider} />
                <p style={infoDesc}>
                  {learningClass.description ??
                    "Welcome to this live session. The presentation updates automatically — your instructor controls the slides."}
                </p>
                <div style={viewOnlyNote}>
                  🔒 View only — presentation is controlled by your instructor. Downloads are disabled during live sessions.
                </div>
              </div>
            )}
            {activeTab === "chat" && (
              <ClassroomChat classId={learningClass.id} room={activeRoom} isInstructor={false} />
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ─────────────────────────────────────────── */}
      <div style={ctrlBar}>
        <div style={ctrlBarInner}>
          <div style={ctrlGroup}>
            <button type="button" style={ctrlBtn} title="Microphone (view only)">
              🎤
              <span style={ctrlLabel}>Mic</span>
            </button>
            <button type="button" style={ctrlBtn} title="Camera (view only)">
              📷
              <span style={ctrlLabel}>Camera</span>
            </button>
            <button type="button" onClick={toggleFullscreen} style={ctrlBtn} title="Fullscreen">
              ⛶
              <span style={ctrlLabel}>Fullscreen</span>
            </button>
          </div>
          <Link href="/learning" style={leaveCtrl}>
            Leave
          </Link>
        </div>
      </div>

    </div>
  );
}

function fmtType(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Word";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Spreadsheet";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "Slides";
  return "Document";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  minHeight: "100dvh", background: WINE3, color: INK,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "flex", flexDirection: "column",
};

// Top bar
const topBar: React.CSSProperties = {
  background: WINE, padding: "0 1rem",
  display: "flex", justifyContent: "space-between", alignItems: "stretch",
  height: 52, flexShrink: 0,
  boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
};
const topBarLeft: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.75rem",
};
const topBarRight: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.75rem",
};
const logoWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.5rem",
};
const logoMark: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`,
  color: WINE, fontWeight: 900, fontSize: "1.1rem",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};
const logoName: React.CSSProperties = {
  color: "#fff", fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.1,
};
const logoSub: React.CSSProperties = {
  color: GOLD2, fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.04em",
};
const dividerV: React.CSSProperties = {
  width: 1, height: 28, background: LINE, flexShrink: 0,
};
const classInfo: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 0,
  maxWidth: "clamp(120px, 30vw, 260px)",
  overflow: "hidden",
};
const courseName: React.CSSProperties = {
  color: GOLD2, fontSize: "0.78rem", fontWeight: 700,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const moduleName: React.CSSProperties = {
  color: MUTED, fontSize: "0.72rem",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const liveBadge: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.3rem",
  background: "rgba(220,30,30,0.25)", border: "1px solid #e05050",
  color: "#ff7070", padding: "0.2rem 0.6rem", borderRadius: 99,
  fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em",
};
const liveDot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: "50%",
  background: "#ff5555",
  boxShadow: "0 0 6px #ff5555",
  display: "inline-block",
  animation: "pulse 1.4s infinite",
};
const leaveBtn: React.CSSProperties = {
  color: "#fff", textDecoration: "none",
  background: "rgba(220,40,40,0.35)", border: "1px solid #cc4444",
  borderRadius: 6, padding: "0.3rem 0.75rem",
  fontSize: "0.78rem", fontWeight: 700,
};

// Main
const mainWrap: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  overflow: "hidden",
};

// Stage
const stageCard: React.CSSProperties = {
  position: "relative", background: CREAM,
  flex: 1, display: "flex", flexDirection: "column",
  overflow: "hidden", minHeight: "55vh",
};
const fullscreenStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  height: "100dvh", width: "100vw",
};
const stageStrip: React.CSSProperties = {
  background: WINE, padding: "0.35rem 0.75rem",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  flexShrink: 0,
};
const stageTitle: React.CSSProperties = {
  color: GOLD2, fontSize: "0.78rem", fontWeight: 600,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
};
const pageTag: React.CSSProperties = { color: MUTED, fontSize: "0.68rem" };
const fsBtn: React.CSSProperties = {
  background: WINE2, color: GOLD2, border: "none",
  borderRadius: 4, padding: "0.25rem 0.5rem",
  fontSize: "0.95rem", cursor: "pointer",
};
const slideArea: React.CSSProperties = {
  flex: 1, overflow: "hidden", display: "flex", alignItems: "stretch",
};
const slideFrame: React.CSSProperties = {
  width: "100%", height: "100%", border: 0,
  background: CREAM, userSelect: "none",
};
const slidePlaceholder: React.CSSProperties = {
  margin: "auto", textAlign: "center", padding: "2rem",
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
};
const slideMsg: React.CSSProperties = {
  color: WINE, fontWeight: 700, fontSize: "1rem", margin: 0,
};
const slideHint: React.CSSProperties = {
  color: MUTED, fontSize: "0.8rem", margin: 0,
};

// PiP
const pipBox: React.CSSProperties = {
  position: "absolute",
  top: "2.6rem", right: "0.5rem",
  width: "clamp(100px, 28vw, 180px)",
  display: "flex", flexDirection: "column",
  zIndex: 20, borderRadius: 8, overflow: "hidden",
  boxShadow: "0 4px 16px rgba(0,0,0,0.55)",
  border: `2px solid ${GOLD}`,
};
const pipHead: React.CSSProperties = {
  background: WINE, padding: "0.18rem 0.45rem",
  display: "flex", alignItems: "center", gap: "0.3rem",
};
const pipDot: React.CSSProperties = {
  width: 5, height: 5, borderRadius: "50%",
  background: "#4dff88", display: "inline-block",
};
const pipLabel: React.CSSProperties = {
  color: GOLD2, fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.04em",
};

// Panel
const panelCard: React.CSSProperties = {
  background: WINE3, borderTop: `1px solid ${LINE}`,
  display: "flex", flexDirection: "column",
  maxHeight: "38vh", flexShrink: 0,
};
const panelTabBar: React.CSSProperties = {
  display: "flex", background: WINE,
  borderBottom: `1px solid ${LINE}`,
};
const panelTab: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none",
  borderBottom: "2px solid transparent",
  color: MUTED, padding: "0.6rem 0.5rem",
  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
};
const panelTabActive: React.CSSProperties = {
  color: GOLD2, borderBottomColor: GOLD,
  background: WINE3,
};
const panelBody: React.CSSProperties = {
  flex: 1, overflowY: "auto",
};

// Info panel
const infoPanel: React.CSSProperties = {
  padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.35rem",
};
const infoTitle: React.CSSProperties = {
  margin: "0 0 0.4rem", color: "#fff", fontSize: "0.95rem", fontWeight: 700,
};
const infoRow: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "0.25rem 0", borderBottom: `1px solid ${LINE}`,
};
const infoKey: React.CSSProperties = { color: MUTED, fontSize: "0.75rem", fontWeight: 600 };
const infoVal: React.CSSProperties = { color: INK, fontSize: "0.8rem", fontWeight: 600 };
const infoDivider: React.CSSProperties = { borderColor: LINE, margin: "0.4rem 0" };
const infoDesc: React.CSSProperties = { fontSize: "0.78rem", color: MUTED, margin: 0, lineHeight: 1.5 };
const viewOnlyNote: React.CSSProperties = {
  fontSize: "0.72rem", color: GOLD,
  background: `rgba(200,148,58,0.12)`, border: `1px solid rgba(200,148,58,0.3)`,
  padding: "0.4rem 0.6rem", borderRadius: 5,
};

// Control bar
const ctrlBar: React.CSSProperties = {
  background: WINE, borderTop: `1px solid ${LINE}`,
  padding: "0.5rem 1rem", flexShrink: 0,
};
const ctrlBarInner: React.CSSProperties = {
  maxWidth: 640, margin: "0 auto",
  display: "flex", justifyContent: "space-between", alignItems: "center",
};
const ctrlGroup: React.CSSProperties = {
  display: "flex", gap: "0.5rem",
};
const ctrlBtn: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
  background: WINE2, border: `1px solid ${LINE}`,
  color: INK, borderRadius: 8,
  padding: "0.4rem 0.65rem", cursor: "pointer",
  fontSize: "1.1rem", minWidth: 48,
};
const ctrlLabel: React.CSSProperties = {
  fontSize: "0.58rem", fontWeight: 600, color: GOLD2, letterSpacing: "0.03em",
};
const leaveCtrl: React.CSSProperties = {
  background: "#8b1a1a", border: "1px solid #cc3333",
  color: "#fff", borderRadius: 8,
  padding: "0.5rem 1.2rem", fontWeight: 700, fontSize: "0.85rem",
  textDecoration: "none", display: "flex", alignItems: "center",
};
