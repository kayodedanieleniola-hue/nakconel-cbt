"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import ClassroomVideoFeed from "@/components/ClassroomVideoFeed";
import ClassroomParticipants from "@/components/ClassroomParticipants";
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
};

export default function ClassroomClient({
  learningClass,
  materials,
}: {
  learningClass: LearningClass;
  materials: Material[];
}) {
  // Select assigned active material or fall back to first material
  const initialId =
    learningClass.activeMaterialId && materials.some((m) => m.id === learningClass.activeMaterialId)
      ? learningClass.activeMaterialId
      : materials[0]?.id ?? "";

  const [materialId, setMaterialId] = useState(initialId);
  const [activeTab, setActiveTab] = useState<"materials" | "agenda" | "tools">("materials");
  const [zoom, setZoom] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);

  const currentIndex = materials.findIndex((m) => m.id === materialId);
  const selected = materials.find((m) => m.id === materialId);

  const previewable =
    selected?.mimeType.startsWith("image/") || selected?.mimeType === "application/pdf";

  // Log student class attendance in backend DB
  useEffect(() => {
    if (learningClass.id) {
      void fetch("/api/learning/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: learningClass.id }),
      }).catch(() => {});
    }
  }, [learningClass.id]);

  // Fullscreen change listener
  useEffect(() => {
    function handleFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      void stageRef.current.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < materials.length - 1) {
      setMaterialId(materials[currentIndex + 1].id);
      setZoom(1.0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setMaterialId(materials[currentIndex - 1].id);
      setZoom(1.0);
    }
  };

  return (
    <main style={shell}>
      {/* Classroom Top Bar */}
      <header style={header}>
        <div style={brandGroup}>
          <Link href="/learning" style={brand}>
            Nak Learning Center
          </Link>
          <span style={liveBadge}>
            <span style={pulseDot}>●</span> LIVE CLASSROOM
          </span>
        </div>
        <div style={headerRight}>
          <span style={courseBadge}>
            {learningClass.course} {learningClass.module ? `· ${learningClass.module}` : ""}
          </span>
          <Link href="/learning" style={leaveBtn}>
            Leave classroom
          </Link>
        </div>
      </header>

      {/* Classroom Body Grid */}
      <section style={layout}>
        {/* Main Stage / Presentation Viewer */}
        <div ref={stageRef} style={{ ...stageContainer, ...(isFullscreen ? fullscreenStage : {}) }}>
          {/* Stage Control Toolbar */}
          <div style={stageToolbar}>
            <div style={stageInfo}>
              <span style={presentationTag}>PRESENTATION STAGE</span>
              <h2 style={stageTitle}>{selected ? selected.title : learningClass.title}</h2>
              {selected && <span style={fileMetaBadge}>{formatFileType(selected.mimeType)}</span>}
            </div>

            <div style={toolbarControls}>
              {/* Zoom controls */}
              <div style={controlGroup}>
                <button
                  type="button"
                  title="Zoom out"
                  disabled={!previewable || zoom <= 0.5}
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  style={toolBtn}
                >
                  −
                </button>
                <span style={zoomIndicator}>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  title="Zoom in"
                  disabled={!previewable || zoom >= 2.0}
                  onClick={() => setZoom((z) => Math.min(2.0, z + 0.25))}
                  style={toolBtn}
                >
                  +
                </button>
                {zoom !== 1.0 && (
                  <button type="button" onClick={() => setZoom(1.0)} style={resetBtn}>
                    Reset
                  </button>
                )}
              </div>

              {/* Material Navigation */}
              {materials.length > 1 && (
                <div style={controlGroup}>
                  <button
                    type="button"
                    title="Previous material"
                    disabled={currentIndex <= 0}
                    onClick={handlePrev}
                    style={toolBtn}
                  >
                    ◄
                  </button>
                  <span style={counterIndicator}>
                    {currentIndex + 1} / {materials.length}
                  </span>
                  <button
                    type="button"
                    title="Next material"
                    disabled={currentIndex < 0 || currentIndex >= materials.length - 1}
                    onClick={handleNext}
                    style={toolBtn}
                  >
                    ►
                  </button>
                </div>
              )}

              {/* Fullscreen & Download */}
              <div style={controlGroup}>
                <button
                  type="button"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Stage"}
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
                    title="Download active material"
                  >
                    ↓ Download
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Presentation Content Viewport */}
          <div style={viewportContainer}>
            {selected && previewable ? (
              <div style={{ ...scaledWrapper, transform: `scale(${zoom})` }}>
                <iframe
                  title={selected.title}
                  src={`/api/learning/materials/${selected.id}?view=inline`}
                  style={iframeViewer}
                />
              </div>
            ) : (
              <div style={emptyStage}>
                <div style={emptyIcon}>📊</div>
                {selected ? (
                  <>
                    <h3 style={{ margin: "0.5rem 0", color: "#fff" }}>{selected.title}</h3>
                    <p style={emptySub}>
                      This file format ({selected.mimeType}) cannot be rendered live inside the stage.
                    </p>
                    <a href={`/api/learning/materials/${selected.id}`} style={downloadActionBtn}>
                      Download file to view locally
                    </a>
                  </>
                ) : (
                  <>
                    <h3 style={{ margin: "0.5rem 0", color: "#fff" }}>Presentation Stage Ready</h3>
                    <p style={emptySub}>
                      Your instructor will share presentation slides, notes, or documents here.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Workspace Dock / Sidebar */}
        <aside style={sideDock}>
          {/* Instructor Live Video & Audio Feed */}
          <section style={instructorPanel}>
            <div style={instructorHeader}>
              <span style={sideTag}>INSTRUCTOR FEED</span>
              <span style={activeDot}>● LIVE STREAM</span>
            </div>
            <ClassroomVideoFeed
              classId={learningClass.id}
              onRoomReady={setActiveRoom}
            />
            <ClassroomPollOverlay classId={learningClass.id} />
          </section>

          {/* Workspace Tabs & Content */}
          <section style={workspacePanel}>
            <div style={tabHeader}>
              <button
                type="button"
                onClick={() => setActiveTab("materials")}
                style={{ ...tabBtn, ...(activeTab === "materials" ? activeTabBtn : {}) }}
              >
                Materials ({materials.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("agenda")}
                style={{ ...tabBtn, ...(activeTab === "agenda" ? activeTabBtn : {}) }}
              >
                Agenda
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tools")}
                style={{ ...tabBtn, ...(activeTab === "tools" ? activeTabBtn : {}) }}
              >
                Tools
              </button>
            </div>

            <div style={tabBody}>
              {/* TAB 1: MATERIALS */}
              {activeTab === "materials" && (
                <div>
                  <p style={tabHint}>Select a material to present on the main stage:</p>
                  {materials.length === 0 ? (
                    <p style={emptyText}>No presentation materials shared for this class yet.</p>
                  ) : (
                    <div style={materialGrid}>
                      {materials.map((m) => {
                        const isCurrent = m.id === materialId;
                        const isAssigned = m.id === learningClass.activeMaterialId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setMaterialId(m.id);
                              setZoom(1.0);
                            }}
                            style={{
                              ...materialItemCard,
                              ...(isCurrent ? activeMaterialCard : {}),
                            }}
                          >
                            <div style={materialTopRow}>
                              <span style={materialIcon}>
                                {m.mimeType === "application/pdf"
                                  ? "📄"
                                  : m.mimeType.startsWith("image/")
                                  ? "🖼️"
                                  : "📁"}
                              </span>
                              <strong style={materialTitleStr}>{m.title}</strong>
                            </div>
                            <div style={materialMetaRow}>
                              <span style={fileTypeBadge}>{formatFileType(m.mimeType)}</span>
                              {m.sizeBytes && (
                                <span style={fileSizeBadge}>
                                  {Math.ceil(m.sizeBytes / 1024)} KB
                                </span>
                              )}
                              {isAssigned && <span style={spotlightBadge}>⭐ Active Deck</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AGENDA */}
              {activeTab === "agenda" && (
                <div style={agendaContainer}>
                  <h4 style={agendaClassTitle}>{learningClass.title}</h4>
                  <p style={agendaCourse}>
                    Course: <strong>{learningClass.course}</strong>
                  </p>
                  {learningClass.module && (
                    <p style={agendaCourse}>
                      Module: <strong>{learningClass.module}</strong>
                    </p>
                  )}
                  {learningClass.instructor && (
                    <p style={agendaCourse}>
                      Instructor: <strong>{learningClass.instructor}</strong>
                    </p>
                  )}

                  <hr style={divider} />

                  <h5 style={subHeading}>Class Overview</h5>
                  <p style={agendaText}>
                    {learningClass.description
                      ? learningClass.description
                      : "Welcome to this live classroom session. Follow along on the presentation stage as your instructor covers the module materials."}
                  </p>
                </div>
              )}

              {/* TAB 3: PARTICIPANTS & TOOLS */}
              {activeTab === "tools" && (
                <div style={toolsContainer}>
                  <ClassroomParticipants
                    classId={learningClass.id}
                    room={activeRoom}
                    canPublishVideo={false}
                    onToggleStudentCamera={() => {}}
                  />

                  <hr style={divider} />

                  <ClassroomChat
                    classId={learningClass.id}
                    room={activeRoom}
                    isInstructor={false}
                  />
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>

    </main>
  );
}

function formatFileType(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF Slide Deck";
  if (mimeType.startsWith("image/")) return "Image Slide";
  if (mimeType.includes("word") || mimeType.includes("document")) return "Word Document";
  return "Document";
}

// Styling Tokens
const shell = {
  minHeight: "100vh",
  background: "#1e1312",
  color: "#f3eee7",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

const header = {
  background: "#330808",
  borderBottom: "1px solid #4a1919",
  color: "#fff",
  padding: "0.75rem 2vw",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
} as const;

const brandGroup = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
} as const;

const brand = {
  color: "#fff",
  fontStyle: "italic",
  fontWeight: 700,
  fontSize: "1.2rem",
  textDecoration: "none",
} as const;

const liveBadge = {
  background: "#4d1010",
  color: "#ffd98a",
  border: "1px solid #98661B",
  padding: "0.25rem 0.6rem",
  borderRadius: 20,
  fontSize: "0.75rem",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
} as const;

const pulseDot = {
  color: "#ff4d4d",
} as const;

const headerRight = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
} as const;

const courseBadge = {
  color: "#d4b684",
  fontSize: "0.85rem",
} as const;

const leaveBtn = {
  color: "#fff",
  textDecoration: "none",
  background: "transparent",
  border: "1px solid #98661B",
  borderRadius: 4,
  padding: "0.4rem 0.75rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  transition: "all 0.2s ease",
} as const;

const layout = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)",
  gap: "1.2rem",
  padding: "1.2rem 2vw",
  maxWidth: 1800,
  margin: "0 auto",
} as const;

const stageContainer = {
  background: "#120a09",
  border: "1px solid #3b2220",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  minHeight: "82vh",
  overflow: "hidden",
} as const;

const fullscreenStage = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  borderRadius: 0,
  border: "none",
  height: "100vh",
  width: "100vw",
} as const;

const stageToolbar = {
  background: "#261312",
  borderBottom: "1px solid #3b2220",
  padding: "0.7rem 1.2rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
} as const;

const stageInfo = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
} as const;

const presentationTag = {
  color: "#98661B",
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
} as const;

const stageTitle = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 600,
  color: "#fff",
} as const;

const fileMetaBadge = {
  background: "#3d201e",
  color: "#e6c99c",
  padding: "0.15rem 0.45rem",
  borderRadius: 4,
  fontSize: "0.75rem",
} as const;

const toolbarControls = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
} as const;

const controlGroup = {
  display: "flex",
  alignItems: "center",
  background: "#180c0b",
  border: "1px solid #3b2220",
  borderRadius: 6,
  padding: "0.2rem",
  gap: "0.3rem",
} as const;

const toolBtn = {
  background: "#2b1615",
  color: "#fff",
  border: "1px solid #4a2725",
  borderRadius: 4,
  padding: "0.3rem 0.65rem",
  fontSize: "0.85rem",
  cursor: "pointer",
  fontWeight: 600,
} as const;

const activeToolBtn = {
  background: "#98661B",
  borderColor: "#b57d26",
  color: "#fff",
} as const;

const zoomIndicator = {
  fontSize: "0.8rem",
  color: "#ffd98a",
  padding: "0 0.4rem",
  fontWeight: 600,
} as const;

const counterIndicator = {
  fontSize: "0.8rem",
  color: "#d4b684",
  padding: "0 0.4rem",
} as const;

const resetBtn = {
  background: "transparent",
  color: "#98661B",
  border: "none",
  fontSize: "0.75rem",
  cursor: "pointer",
  textDecoration: "underline",
  padding: "0 0.3rem",
} as const;

const downloadLinkBtn = {
  background: "#4d1010",
  color: "#ffd98a",
  border: "1px solid #98661B",
  borderRadius: 4,
  padding: "0.3rem 0.65rem",
  fontSize: "0.8rem",
  textDecoration: "none",
  fontWeight: 600,
} as const;

const viewportContainer = {
  flex: 1,
  background: "#0c0605",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "auto",
  padding: "1rem",
} as const;

const scaledWrapper = {
  width: "100%",
  height: "100%",
  minHeight: "72vh",
  transition: "transform 0.15s ease-out",
  transformOrigin: "center center",
  display: "flex",
} as const;

const iframeViewer = {
  width: "100%",
  height: "100%",
  minHeight: "72vh",
  border: 0,
  borderRadius: 4,
  background: "#ffffff",
} as const;

const emptyStage = {
  textAlign: "center",
  padding: "3rem 1.5rem",
  color: "#b09b91",
  maxWidth: 450,
} as const;

const emptyIcon = {
  fontSize: "3rem",
  marginBottom: "0.5rem",
} as const;

const emptySub = {
  fontSize: "0.9rem",
  lineHeight: 1.5,
  margin: "0.5rem 0 1.2rem",
} as const;

const downloadActionBtn = {
  display: "inline-block",
  background: "#98661B",
  color: "#fff",
  textDecoration: "none",
  padding: "0.55rem 1rem",
  borderRadius: 4,
  fontSize: "0.85rem",
  fontWeight: 600,
} as const;

const sideDock = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
} as const;

const instructorPanel = {
  background: "#241211",
  border: "1px solid #3b2220",
  borderRadius: 8,
  padding: "0.85rem",
} as const;

const instructorHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.6rem",
} as const;

const sideTag = {
  color: "#98661B",
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
} as const;

const activeDot = {
  color: "#4dff88",
  fontSize: "0.75rem",
  fontWeight: 600,
} as const;

const videoStage = {
  background: "#100707",
  border: "1px solid #2e1615",
  borderRadius: 6,
  aspectRatio: "16 / 9",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.75rem",
  textAlign: "center",
} as const;

const videoAvatar = {
  fontSize: "2rem",
} as const;

const instructorName = {
  margin: "0.25rem 0 0.15rem",
  color: "#fff",
  fontWeight: 600,
  fontSize: "0.95rem",
} as const;

const phaseNotice = {
  color: "#a38b80",
  fontSize: "0.75rem",
} as const;

const workspacePanel = {
  background: "#241211",
  border: "1px solid #3b2220",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
} as const;

const tabHeader = {
  display: "flex",
  background: "#180c0b",
  borderBottom: "1px solid #3b2220",
} as const;

const tabBtn = {
  flex: 1,
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  color: "#a38b80",
  padding: "0.65rem 0.5rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
} as const;

const activeTabBtn = {
  color: "#ffd98a",
  borderBottomColor: "#98661B",
  background: "#241211",
} as const;

const tabBody = {
  padding: "0.85rem",
} as const;

const tabHint = {
  fontSize: "0.8rem",
  color: "#a38b80",
  margin: "0 0 0.65rem",
} as const;

const emptyText = {
  fontSize: "0.85rem",
  color: "#8c766b",
  fontStyle: "italic",
} as const;

const materialGrid = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
} as const;

const materialItemCard = {
  textAlign: "left",
  background: "#1a0d0c",
  border: "1px solid #3b2220",
  borderRadius: 6,
  padding: "0.6rem 0.75rem",
  cursor: "pointer",
  color: "#f3eee7",
  transition: "all 0.15s ease",
} as const;

const activeMaterialCard = {
  borderColor: "#98661B",
  background: "#331614",
  boxShadow: "0 0 10px rgba(152, 102, 27, 0.25)",
} as const;

const materialTopRow = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
} as const;

const materialIcon = {
  fontSize: "1rem",
} as const;

const materialTitleStr = {
  fontSize: "0.88rem",
  color: "#fff",
  fontWeight: 600,
} as const;

const materialMetaRow = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  marginTop: "0.35rem",
  flexWrap: "wrap",
} as const;

const fileTypeBadge = {
  background: "#2e1615",
  color: "#d4b684",
  fontSize: "0.7rem",
  padding: "0.1rem 0.35rem",
  borderRadius: 3,
} as const;

const fileSizeBadge = {
  color: "#8c766b",
  fontSize: "0.7rem",
} as const;

const spotlightBadge = {
  background: "#98661B",
  color: "#fff",
  fontSize: "0.68rem",
  fontWeight: 700,
  padding: "0.1rem 0.35rem",
  borderRadius: 3,
} as const;

const agendaContainer = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
} as const;

const agendaClassTitle = {
  margin: "0 0 0.3rem",
  color: "#fff",
  fontSize: "1rem",
} as const;

const agendaCourse = {
  margin: 0,
  fontSize: "0.85rem",
  color: "#c2aba0",
} as const;

const divider = {
  borderColor: "#3b2220",
  margin: "0.6rem 0",
} as const;

const subHeading = {
  margin: "0 0 0.3rem",
  fontSize: "0.85rem",
  color: "#ffd98a",
} as const;

const agendaText = {
  fontSize: "0.82rem",
  lineHeight: 1.5,
  color: "#a38b80",
  margin: 0,
} as const;

const toolsContainer = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
} as const;

const toolCard = {
  background: "#1a0d0c",
  border: "1px solid #3b2220",
  borderRadius: 6,
  padding: "0.65rem",
} as const;

const toolMuted = {
  fontSize: "0.78rem",
  color: "#8c766b",
  margin: "0.25rem 0 0",
} as const;

