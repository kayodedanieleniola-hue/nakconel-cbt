"use client";

/**
 * ClassroomClient — student-facing live classroom.
 *
 * Presentation state (which material + page) is CONTROLLED EXCLUSIVELY by
 * the instructor. Students receive it via LiveKit data channel messages
 * (PRESENTATION_STATE) forwarded by ClassroomVideoFeed via onPresentationState.
 * Students have NO material-selection or page-navigation controls.
 *
 * Initial presentation state is also fetched from the server on mount so
 * a student who joins mid-session sees the current slide immediately.
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
  /** Server-persisted active material — used as initial state */
  activeMaterialId?: string | null;
  /** Server-persisted presentation page — used as initial state */
  presentationPage?: number | null;
};

export default function ClassroomClient({
  learningClass,
  materials,
}: {
  learningClass: LearningClass;
  materials: Material[];
}) {
  const stageRef   = useRef<HTMLDivElement>(null);
  const [activeRoom,    setActiveRoom]    = useState<Room | null>(null);
  const [activeTab,     setActiveTab]     = useState<"agenda" | "chat">("agenda");
  const [isFullscreen,  setIsFullscreen]  = useState(false);

  // Presentation state is read-only on the student side.
  // Initialise from server-persisted values so late joiners see the current slide.
  const [presState, setPresState] = useState<PresentationState>({
    materialId: learningClass.activeMaterialId && materials.some((m) => m.id === learningClass.activeMaterialId)
      ? learningClass.activeMaterialId
      : materials[0]?.id ?? "",
    page: learningClass.presentationPage ?? 1,
  });

  const selected   = materials.find((m) => m.id === presState.materialId);
  const previewable = selected?.mimeType === "application/pdf" || selected?.mimeType?.startsWith("image/");

  // Receive presentation state broadcast from instructor (via data channel)
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
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) void stageRef.current.requestFullscreen().catch(() => {});
    else void document.exitFullscreen().catch(() => {});
  };

  return (
    <main style={shell}>
      {/* Top bar */}
      <header style={header}>
        <div style={brandGroup}>
          <Link href="/learning" style={brand}>Nak Learning Center</Link>
          <span style={liveBadge}><span style={pulseDot}>●</span> LIVE CLASSROOM</span>
        </div>
        <div style={headerRight}>
          <span style={courseBadge}>
            {learningClass.course}{learningClass.module ? ` · ${learningClass.module}` : ""}
          </span>
          <Link href="/learning" style={leaveBtn}>Leave classroom</Link>
        </div>
      </header>

      {/* Body */}
      <section style={layout}>

        {/* Presentation Stage — student view, read-only */}
        <div
          ref={stageRef}
          style={{ ...stageContainer, ...(isFullscreen ? fullscreenStage : {}) }}
        >
          <div style={stageToolbar}>
            <div style={stageInfo}>
              <span style={presentationTag}>PRESENTATION STAGE</span>
              <h2 style={stageTitle}>{selected ? selected.title : learningClass.title}</h2>
              {selected && <span style={fileMetaBadge}>{formatFileType(selected.mimeType)}</span>}
              {presState.page > 1 && (
                <span style={pageIndicator}>Page {presState.page}</span>
              )}
            </div>
            {/* Students have no navigation controls — instructor-only */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                onClick={toggleFullscreen}
                style={{ ...toolBtn, ...activeToolBtn }}
              >
                {isFullscreen ? "Exit Fullscreen" : "⛶ Fullscreen"}
              </button>
              {selected && (
                <a
                  href={`/api/learning/materials/${selected.id}`}
                  download
                  style={downloadLinkBtn}
                >
                  ↓ Download
                </a>
              )}
            </div>
          </div>

          <div style={viewportContainer}>
            {selected && previewable ? (
              <iframe
                key={`${selected.id}-${presState.page}`}
                title={selected.title}
                src={`/api/learning/materials/${selected.id}?view=inline&page=${presState.page}`}
                style={iframeViewer}
              />
            ) : selected ? (
              <div style={emptyStage}>
                <div style={{ fontSize: "3rem" }}>📁</div>
                <h3 style={{ margin: "0.5rem 0", color: "#fff" }}>{selected.title}</h3>
                <p style={emptySub}>
                  This file format cannot be previewed live. Download to view locally.
                </p>
                <a href={`/api/learning/materials/${selected.id}`} style={downloadActionBtn}>
                  ↓ Download file
                </a>
              </div>
            ) : (
              <div style={emptyStage}>
                <div style={{ fontSize: "3rem" }}>📊</div>
                <h3 style={{ margin: "0.5rem 0", color: "#fff" }}>Presentation Stage</h3>
                <p style={emptySub}>
                  Your instructor will share presentation materials here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside style={sideDock}>
          {/* Instructor feed + poll overlay */}
          <section style={instructorPanel}>
            <div style={instructorHeader}>
              <span style={sideTag}>INSTRUCTOR FEED</span>
              <span style={activeDot}>● LIVE</span>
            </div>
            <ClassroomVideoFeed
              classId={learningClass.id}
              onRoomReady={setActiveRoom}
              onPresentationState={handlePresentationState}
            />
            <ClassroomPollOverlay classId={learningClass.id} />
          </section>

          {/* Tabs: Agenda | Chat */}
          <section style={workspacePanel}>
            <div style={tabHeader}>
              <button
                type="button"
                onClick={() => setActiveTab("agenda")}
                style={{ ...tabBtn, ...(activeTab === "agenda" ? activeTabBtn : {}) }}
              >
                Agenda
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                style={{ ...tabBtn, ...(activeTab === "chat" ? activeTabBtn : {}) }}
              >
                Chat &amp; Q&amp;A
              </button>
            </div>

            <div style={tabBody}>
              {activeTab === "agenda" && (
                <div style={agendaContainer}>
                  <h4 style={agendaClassTitle}>{learningClass.title}</h4>
                  <p style={agendaLine}>Course: <strong>{learningClass.course}</strong></p>
                  {learningClass.module && (
                    <p style={agendaLine}>Module: <strong>{learningClass.module}</strong></p>
                  )}
                  {learningClass.instructor && (
                    <p style={agendaLine}>Instructor: <strong>{learningClass.instructor}</strong></p>
                  )}
                  <hr style={divider} />
                  <p style={agendaText}>
                    {learningClass.description ??
                      "Welcome to this live classroom session. Follow along on the presentation stage as your instructor covers the module materials."}
                  </p>
                  <hr style={divider} />
                  <p style={readOnlyNotice}>
                    📌 Presentation is controlled by your instructor. Your stage updates automatically.
                  </p>
                </div>
              )}
              {activeTab === "chat" && (
                <ClassroomChat
                  classId={learningClass.id}
                  room={activeRoom}
                  isInstructor={false}
                />
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
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
  minHeight: "100vh",
  background: "#1e1312",
  color: "#f3eee7",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const header: React.CSSProperties = {
  background: "#330808",
  borderBottom: "1px solid #4a1919",
  color: "#fff",
  padding: "0.75rem 2vw",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
};

const brandGroup: React.CSSProperties = { display: "flex", alignItems: "center", gap: "1rem" };

const brand: React.CSSProperties = {
  color: "#fff", fontStyle: "italic", fontWeight: 700, fontSize: "1.2rem", textDecoration: "none",
};

const liveBadge: React.CSSProperties = {
  background: "#4d1010", color: "#ffd98a", border: "1px solid #98661B",
  padding: "0.25rem 0.6rem", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700,
  display: "flex", alignItems: "center", gap: "0.35rem",
};

const pulseDot: React.CSSProperties = { color: "#ff4d4d" };

const headerRight: React.CSSProperties = { display: "flex", alignItems: "center", gap: "1rem" };

const courseBadge: React.CSSProperties = { color: "#d4b684", fontSize: "0.85rem" };

const leaveBtn: React.CSSProperties = {
  color: "#fff", textDecoration: "none", background: "transparent",
  border: "1px solid #98661B", borderRadius: 4,
  padding: "0.4rem 0.75rem", fontSize: "0.85rem", fontWeight: 600,
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) minmax(300px,360px)",
  gap: "1.2rem",
  padding: "1.2rem 2vw",
  maxWidth: 1800,
  margin: "0 auto",
};

const stageContainer: React.CSSProperties = {
  background: "#120a09",
  border: "1px solid #3b2220",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  minHeight: "82vh",
  overflow: "hidden",
};

const fullscreenStage: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  borderRadius: 0, border: "none", height: "100vh", width: "100vw",
};

const stageToolbar: React.CSSProperties = {
  background: "#261312",
  borderBottom: "1px solid #3b2220",
  padding: "0.7rem 1.2rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  flexShrink: 0,
};

const stageInfo: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.75rem" };

const presentationTag: React.CSSProperties = {
  color: "#98661B", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em",
};

const stageTitle: React.CSSProperties = { margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "#fff" };

const fileMetaBadge: React.CSSProperties = {
  background: "#3d201e", color: "#e6c99c",
  padding: "0.15rem 0.45rem", borderRadius: 4, fontSize: "0.75rem",
};

const pageIndicator: React.CSSProperties = {
  background: "#2b1615", color: "#ffd98a",
  border: "1px solid #4a2725",
  padding: "0.15rem 0.45rem", borderRadius: 4, fontSize: "0.72rem", fontWeight: 600,
};

const toolBtn: React.CSSProperties = {
  background: "#2b1615", color: "#fff",
  border: "1px solid #4a2725", borderRadius: 4,
  padding: "0.3rem 0.65rem", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600,
};

const activeToolBtn: React.CSSProperties = { background: "#98661B", borderColor: "#b57d26" };

const downloadLinkBtn: React.CSSProperties = {
  background: "#4d1010", color: "#ffd98a",
  border: "1px solid #98661B", borderRadius: 4,
  padding: "0.3rem 0.65rem", fontSize: "0.8rem", textDecoration: "none", fontWeight: 600,
};

const viewportContainer: React.CSSProperties = {
  flex: 1, background: "#0c0605",
  display: "flex", alignItems: "center", justifyContent: "center",
  overflow: "auto", padding: "1rem",
};

const iframeViewer: React.CSSProperties = {
  width: "100%", height: "100%", minHeight: "72vh",
  border: 0, borderRadius: 4, background: "#ffffff",
};

const emptyStage: React.CSSProperties = {
  textAlign: "center", padding: "3rem 1.5rem", color: "#b09b91", maxWidth: 450,
};

const emptySub: React.CSSProperties = { fontSize: "0.9rem", lineHeight: 1.5, margin: "0.5rem 0 1.2rem" };

const downloadActionBtn: React.CSSProperties = {
  display: "inline-block", background: "#98661B", color: "#fff",
  textDecoration: "none", padding: "0.55rem 1rem",
  borderRadius: 4, fontSize: "0.85rem", fontWeight: 600,
};

const sideDock: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "1rem" };

const instructorPanel: React.CSSProperties = {
  background: "#241211", border: "1px solid #3b2220", borderRadius: 8, padding: "0.85rem",
};

const instructorHeader: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem",
};

const sideTag: React.CSSProperties = {
  color: "#98661B", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em",
};

const activeDot: React.CSSProperties = { color: "#4dff88", fontSize: "0.75rem", fontWeight: 600 };

const workspacePanel: React.CSSProperties = {
  background: "#241211", border: "1px solid #3b2220",
  borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden",
};

const tabHeader: React.CSSProperties = {
  display: "flex", background: "#180c0b", borderBottom: "1px solid #3b2220",
};

const tabBtn: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none",
  borderBottom: "2px solid transparent",
  color: "#a38b80", padding: "0.65rem 0.5rem",
  fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
};

const activeTabBtn: React.CSSProperties = {
  color: "#ffd98a", borderBottomColor: "#98661B", background: "#241211",
};

const tabBody: React.CSSProperties = { padding: "0.85rem" };

const agendaContainer: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.4rem" };

const agendaClassTitle: React.CSSProperties = { margin: "0 0 0.3rem", color: "#fff", fontSize: "1rem" };

const agendaLine: React.CSSProperties = { margin: 0, fontSize: "0.85rem", color: "#c2aba0" };

const divider: React.CSSProperties = { borderColor: "#3b2220", margin: "0.6rem 0" };

const agendaText: React.CSSProperties = { fontSize: "0.82rem", lineHeight: 1.5, color: "#a38b80", margin: 0 };

const readOnlyNotice: React.CSSProperties = {
  fontSize: "0.75rem", color: "#98661B",
  background: "#1a0d0c", border: "1px solid #3b2220",
  padding: "0.4rem 0.6rem", borderRadius: 4, margin: 0,
};
