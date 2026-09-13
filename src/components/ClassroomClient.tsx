"use client";

/**
 * ClassroomClient — student live classroom, NAK Learning Center.
 * Fully responsive: mobile collapses panels into a bottom sheet,
 * slide viewer fills the screen. Desktop preserves the three-column layout.
 * All LiveKit logic unchanged.
 */

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import ClassroomVideoFeed, { type PresentationState } from "@/components/ClassroomVideoFeed";
import ClassroomChat from "@/components/ClassroomChat";
import ClassroomPollOverlay from "@/components/ClassroomPollOverlay";
import { Room } from "livekit-client";

/* ── Brand tokens ─────────────────────────────────────────────────────────── */
const BG      = "#0f0a0a";
const BG2     = "#1a0808";
const BG3     = "#2d1010";
const WINE    = "#5c1d1d";
const GOLD    = "#d4a843";
const GOLDD   = "#b8922f";
const WHITE   = "#ffffff";
const OFF_W   = "#f8f5f2";
const GRAY    = "#e5e0db";
const GRAY2   = "#8a7a72";
const INK     = "#1a1210";
const RED_BTN = "#dc2626";
const GREEN   = "#22c55e";
const GOLD_GLOW = "rgba(212,168,67,0.18)";

type Material = { id: string; title: string; fileName: string; mimeType: string; sizeBytes?: number };
type LearningClass = {
  id: string; title: string; course: string; module: string | null;
  instructor: string | null; description?: string | null;
  activeMaterialId?: string | null; presentationPage?: number | null;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtType(m: string) {
  if (m === "application/pdf") return "PDF";
  if (m.startsWith("image/")) return "Image";
  if (m.includes("word") || m.includes("document")) return "Word";
  if (m.includes("spreadsheet") || m.includes("excel")) return "Excel";
  if (m.includes("presentation") || m.includes("powerpoint")) return "PPT";
  return "File";
}
function fmtSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
function fileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📊";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📈";
  if (mimeType.startsWith("image/")) return "🖼️";
  return "📁";
}
function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
}

/* ── Logo ────────────────────────────────────────────────────────────────── */
function NakLogo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <div style={{ width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: 8, background: `linear-gradient(135deg, ${GOLD} 0%, #e8c878 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: compact ? "0.8rem" : "1rem" }}>✦</span>
      </div>
      {!compact && (
        <div>
          <div style={{ color: light ? WHITE : INK, fontWeight: 900, fontSize: "1rem", lineHeight: 1 }}>NAK</div>
          <div style={{ color: light ? "rgba(255,255,255,0.6)" : GRAY2, fontSize: "0.58rem", letterSpacing: "0.06em" }}>Learning Center</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function ClassroomClient({
  learningClass,
  materials,
}: {
  learningClass: LearningClass;
  materials: Material[];
}) {
  const stageRef   = useRef<HTMLDivElement>(null);
  const [activeRoom,   setActiveRoom]   = useState<Room | null>(null);
  const [activeTab,    setActiveTab]    = useState<"participants" | "chat" | "qa" | "materials">("materials");
  const [leftTab,      setLeftTab]      = useState<"materials" | "chat" | "qa" | "info">("materials");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsed,      setElapsed]      = useState(0);
  const [isMobile,     setIsMobile]     = useState(false);
  const [showSheet,    setShowSheet]    = useState(false);
  const [sheetTab,     setSheetTab]     = useState<"materials" | "chat" | "qa" | "info">("materials");

  const [presState, setPresState] = useState<PresentationState>({
    materialId:
      learningClass.activeMaterialId && materials.some((m) => m.id === learningClass.activeMaterialId)
        ? learningClass.activeMaterialId
        : materials[0]?.id ?? "",
    page: learningClass.presentationPage ?? 1,
  });

  const selected    = materials.find((m) => m.id === presState.materialId);
  const previewable = selected?.mimeType === "application/pdf" || !!selected?.mimeType?.startsWith("image/");

  const handlePresentationState = useCallback((ps: PresentationState) => setPresState(ps), []);

  /* responsive ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (learningClass.id) {
      void fetch("/api/learning/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId: learningClass.id }) }).catch(() => {});
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

  /* ── shared bottom-sheet / panel content ─────────────────────────────── */
  function SheetContent({ tab, setTab, dark }: { tab: typeof sheetTab; setTab: (t: typeof sheetTab) => void; dark?: boolean }) {
    const bdr   = dark ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${GRAY}`;
    const bgIn  = dark ? "rgba(255,255,255,0.06)" : WHITE;
    const txtC  = dark ? WHITE : INK;
    const mutC  = dark ? "rgba(255,255,255,0.4)" : GRAY2;

    const tabs: { key: typeof sheetTab; label: string; icon: string }[] = [
      { key: "materials", label: "Materials", icon: "📁" },
      { key: "chat",      label: "Chat",      icon: "💬" },
      { key: "qa",        label: "Q&A",       icon: "❓" },
      { key: "info",      label: "Info",      icon: "ℹ️" },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: bdr, background: dark ? BG2 : WHITE }}>
          {tabs.map(({ key, label, icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)} style={{
              flex: 1, background: "transparent", border: "none",
              borderBottom: tab === key ? `2px solid ${GOLDD}` : "2px solid transparent",
              color: tab === key ? GOLDD : mutC,
              padding: "0.65rem 0.1rem", fontSize: "0.6rem", fontWeight: 700,
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
              WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontSize: "0.9rem" }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Materials */}
        {tab === "materials" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "0.65rem", borderBottom: bdr }}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: txtC, marginBottom: "0.4rem" }}>Class Materials</div>
              <div style={{ display: "flex", alignItems: "center", background: bgIn, border: bdr, borderRadius: 6, padding: "0.3rem 0.5rem", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.8rem", color: mutC }}>🔍</span>
                <input placeholder="Search materials…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.75rem", color: txtC }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
              {materials.length === 0 ? (
                <p style={{ color: mutC, fontSize: "0.8rem", textAlign: "center", padding: "1.5rem 0" }}>No materials yet</p>
              ) : materials.map((m) => {
                const isActive = m.id === presState.materialId;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.6rem", borderRadius: 8, background: isActive ? "rgba(212,168,67,0.12)" : "transparent", border: isActive ? `1px solid rgba(212,168,67,0.3)` : "1px solid transparent", marginBottom: "0.25rem" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: isActive ? GOLDD : dark ? BG3 : "#ede8e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                      {fileIcon(m.mimeType)}
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ color: txtC, fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                      <div style={{ color: mutC, fontSize: "0.62rem" }}>{fmtType(m.mimeType)}{m.sizeBytes ? ` · ${fmtSize(m.sizeBytes)}` : ""}</div>
                    </div>
                    {isActive && <div style={{ background: GOLDD, color: WHITE, fontSize: "0.55rem", fontWeight: 800, padding: "0.1rem 0.35rem", borderRadius: 3, flexShrink: 0 }}>Live</div>}
                  </div>
                );
              })}
            </div>
            {/* Notes */}
            <div style={{ padding: "0.65rem", borderTop: bdr }}>
              <div style={{ fontWeight: 700, fontSize: "0.78rem", color: txtC, marginBottom: "0.35rem" }}>My Notes</div>
              <textarea placeholder="Take notes during class…" style={{ width: "100%", minHeight: 70, background: bgIn, border: bdr, borderRadius: 6, color: txtC, fontSize: "0.75rem", padding: "0.45rem", resize: "none", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
        )}

        {/* Chat */}
        {tab === "chat" && (
          <div style={{ flex: 1, overflow: "auto", padding: "0.75rem" }}>
            <ClassroomChat classId={learningClass.id} room={activeRoom} isInstructor={false} />
          </div>
        )}

        {/* Q&A */}
        {tab === "qa" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>❓</div>
              <p style={{ color: mutC, fontSize: "0.82rem", margin: 0 }}>No questions yet.</p>
            </div>
          </div>
        )}

        {/* Info */}
        {tab === "info" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
            <div style={{ color: txtC, fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.75rem" }}>{learningClass.title}</div>
            {([["Course", learningClass.course], ["Instructor", learningClass.instructor ?? "—"], ["Status", "● Live"], ["Duration", fmtTime(elapsed)]] as [string,string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: bdr }}>
                <span style={{ color: mutC, fontSize: "0.75rem" }}>{k}</span>
                <span style={{ color: k === "Status" ? GREEN : txtC, fontSize: "0.78rem", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <p style={{ color: mutC, fontSize: "0.75rem", marginTop: "0.75rem", lineHeight: 1.5 }}>
              {learningClass.description ?? "The presentation updates automatically. Your instructor controls the slides."}
            </p>
            <div style={{ marginTop: "0.6rem", background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)", borderRadius: 6, padding: "0.5rem 0.65rem", fontSize: "0.72rem", color: GOLDD }}>
              🔒 View only — downloads disabled during live sessions.
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /* MOBILE LAYOUT                                                            */
  /* ════════════════════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div style={{ height: "100dvh", background: BG, color: WHITE, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── mobile top bar ─────────────────────────────────────────────── */}
        <div style={{ height: 50, padding: "0 0.85rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(180deg,${BG2},rgba(26,8,8,0.97))`, borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <NakLogo light compact />
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.12)" }} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.6rem", lineHeight: 1 }}>{learningClass.course}</div>
              <div style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700, lineHeight: 1.2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {learningClass.module ?? learningClass.title}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ background: RED_BTN, color: WHITE, fontWeight: 800, fontSize: "0.58rem", padding: "0.18rem 0.5rem", borderRadius: 99, display: "flex", alignItems: "center", gap: "0.22rem" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: WHITE, display: "inline-block" }} />LIVE
            </div>
            <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "0.2rem 0.5rem", fontWeight: 700, fontSize: "0.72rem", fontVariantNumeric: "tabular-nums" }}>
              {fmtTime(elapsed)}
            </div>
          </div>
        </div>

        {/* ── PDF nav bar (mobile compact) ───────────────────────────────── */}
        <div style={{ background: BG2, borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {selected ? (
            <>
              <span style={{ fontSize: "0.85rem" }}>{fileIcon(selected.mimeType)}</span>
              <span style={{ color: WHITE, fontSize: "0.72rem", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", background: BG3, borderRadius: 6, padding: "0.2rem 0.5rem" }}>
                <span>◄</span>
                <span style={{ fontWeight: 700, color: WHITE, minWidth: 18, textAlign: "center" }}>{presState.page}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
                <span>—</span>
                <span>►</span>
              </div>
              <button type="button" onClick={toggleFullscreen} style={{ background: BG3, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", borderRadius: 5, padding: "0.2rem 0.45rem", cursor: "pointer", fontSize: "0.75rem" }}>⛶</button>
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>Waiting for instructor…</span>
          )}
        </div>

        {/* ── Slide area (fills remaining space) ─────────────────────────── */}
        <div ref={stageRef} style={{ flex: 1, overflow: "hidden", background: "#f0ece6", position: "relative", minHeight: 0, ...(isFullscreen ? { position: "fixed", inset: 0, zIndex: 9999, height: "100dvh", width: "100vw" } : {}) }}>
          {selected && previewable ? (
            <iframe
              key={`${selected.id}-p${presState.page}`}
              title={selected.title}
              src={`/api/learning/materials/${selected.id}?view=inline&page=${presState.page}${selected.mimeType === "application/pdf" ? "#toolbar=0&navpanes=0&scrollbar=0" : ""}`}
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.75rem" }}>
              <span style={{ fontSize: "3rem" }}>📊</span>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: WINE }}>
                {selected ? selected.title : "Waiting for instructor…"}
              </p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: GRAY2 }}>
                {selected ? "This file cannot be previewed." : "Slides will appear here automatically."}
              </p>
            </div>
          )}

          {/* Instructor PiP — top-right corner */}
          <div style={{ position: "absolute", top: "0.55rem", right: "0.55rem", zIndex: 20 }}>
            <ClassroomVideoFeed classId={learningClass.id} onRoomReady={setActiveRoom} onPresentationState={handlePresentationState} pipMode />
            <ClassroomPollOverlay classId={learningClass.id} />
          </div>
        </div>

        {/* ── mobile bottom controls ─────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(0deg,${BG2},rgba(26,8,8,0.97))`, borderTop: "1px solid rgba(255,255,255,0.07)", padding: "0.45rem 0.4rem calc(0.45rem + env(safe-area-inset-bottom,0px))", display: "flex", alignItems: "center", justifyContent: "space-around", flexShrink: 0 }}>
          {[
            { icon: "📁", label: "Materials", tab: "materials" as const },
            { icon: "💬", label: "Chat",      tab: "chat"      as const },
            { icon: "❓", label: "Q&A",       tab: "qa"        as const },
            { icon: "ℹ️", label: "Info",      tab: "info"      as const },
          ].map(({ icon, label, tab }) => (
            <button key={tab} type="button"
              onClick={() => { setSheetTab(tab); setShowSheet(true); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.22rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "0.55rem 0.75rem", color: "rgba(255,255,255,0.82)", cursor: "pointer", minWidth: 56, WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: "1.15rem" }}>{icon}</span>
              <span style={{ fontSize: "0.58rem", fontWeight: 700 }}>{label}</span>
            </button>
          ))}
          <Link href="/learning" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.22rem", background: RED_BTN, color: WHITE, borderRadius: 12, padding: "0.55rem 0.75rem", fontWeight: 700, fontSize: "0.58rem", textDecoration: "none", minWidth: 56, WebkitTapHighlightColor: "transparent" }}>
            <span style={{ fontSize: "1.15rem" }}>🚪</span>
            <span>Leave</span>
          </Link>
        </div>

        {/* ── bottom sheet ───────────────────────────────────────────────── */}
        {showSheet && (
          <>
            <div onClick={() => setShowSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40, backdropFilter: "blur(3px)" }} />
            <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: BG2, borderTop: `2px solid ${GOLDD}`, borderRadius: "20px 20px 0 0", height: "75dvh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.65)", animation: "nakSlideUp 0.28s cubic-bezier(.32,.72,0,1)" }}>
              {/* handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "0.6rem 0 0.25rem" }}>
                <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.18)" }} />
              </div>
              {/* close row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1rem 0.4rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: WHITE }}>
                  {sheetTab === "materials" ? "Materials" : sheetTab === "chat" ? "Chat" : sheetTab === "qa" ? "Q&A" : "Class Info"}
                </span>
                <button onClick={() => setShowSheet(false)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <SheetContent tab={sheetTab} setTab={setSheetTab} dark />
              </div>
            </div>
          </>
        )}

        <style>{`@keyframes nakSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /* DESKTOP LAYOUT                                                           */
  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100dvh", background: BG, color: WHITE, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header style={{ background: BG2, borderBottom: "1px solid rgba(255,255,255,0.08)", height: 56, padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <NakLogo light />
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.12)" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem" }}>○</span>
              <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.78rem" }}>{learningClass.course}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem" }}>○</span>
              <span style={{ color: WHITE, fontSize: "0.82rem", fontWeight: 600 }}>{learningClass.module ?? learningClass.title}</span>
            </div>
          </div>
          <div style={{ background: RED_BTN, color: WHITE, fontWeight: 800, fontSize: "0.7rem", padding: "0.25rem 0.6rem", borderRadius: 99, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: WHITE, display: "inline-block" }} />LIVE
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
            🕐 {fmtTime(elapsed)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
            <span style={{ color: GREEN, fontSize: "0.72rem", fontWeight: 600 }}>Connected</span>
          </div>
          <span style={{ fontSize: "1.1rem", cursor: "pointer" }}>🔔</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: GOLD, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem" }}>S</div>
            <div>
              <div style={{ color: WHITE, fontSize: "0.78rem", fontWeight: 700 }}>Student</div>
              <div style={{ color: GOLD, fontSize: "0.6rem" }}>Learner</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div style={{ width: 280, borderRight: "1px solid rgba(255,255,255,0.08)", background: BG2, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ display: "flex", background: BG2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {(["materials","chat","qa","info"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setLeftTab(t)} style={{ flex:1, background:"transparent", border:"none", borderBottom: leftTab===t ? `2px solid ${GOLD}` : "2px solid transparent", color: leftTab===t ? GOLD : "rgba(255,255,255,0.45)", padding:"0.65rem 0.2rem", fontSize:"0.65rem", fontWeight:700, cursor:"pointer", textTransform:"capitalize" }}>
                {t === "materials" ? "Materials" : t === "chat" ? "Chat" : t === "qa" ? "Q&A" : "Info"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <SheetContent tab={leftTab} setTab={setLeftTab} />
          </div>
        </div>

        {/* ── CENTER ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* PDF nav bar */}
          <div style={{ background: BG2, borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0.4rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            {selected && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: BG3, borderRadius: 6, padding: "0.25rem 0.6rem" }}>
                  <span style={{ fontSize: "0.85rem" }}>{fileIcon(selected.mimeType)}</span>
                  <span style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "rgba(255,255,255,0.6)", fontSize: "0.78rem" }}>
                  <span>◄</span>
                  <span style={{ fontWeight: 700, color: WHITE }}>{presState.page}</span>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span>
                  <span>—</span>
                  <span>►</span>
                </div>
              </>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
              <button style={{ background: BG3, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", borderRadius: 5, padding: "0.22rem 0.5rem", cursor: "pointer", fontSize: "0.72rem" }}>100%</button>
              <button type="button" onClick={toggleFullscreen} style={{ background: BG3, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", borderRadius: 5, padding: "0.22rem 0.5rem", cursor: "pointer", fontSize: "0.75rem" }}>⛶</button>
            </div>
          </div>

          {/* Slide area */}
          <div ref={stageRef} style={{ flex: 1, overflow: "hidden", background: "#f0ece6", position: "relative", ...(isFullscreen ? { position: "fixed", inset: 0, zIndex: 9999, height: "100dvh", width: "100vw" } : {}) }}>
            {selected && previewable ? (
              <iframe
                key={`${selected.id}-p${presState.page}`}
                title={selected.title}
                src={`/api/learning/materials/${selected.id}?view=inline&page=${presState.page}${selected.mimeType === "application/pdf" ? "#toolbar=0&navpanes=0&scrollbar=0" : ""}`}
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.75rem" }}>
                <span style={{ fontSize: "3.5rem" }}>📊</span>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: WINE }}>
                  {selected ? selected.title : "Waiting for instructor…"}
                </p>
                <p style={{ margin: 0, fontSize: "0.82rem", color: GRAY2 }}>
                  {selected ? "This file cannot be previewed." : "The presentation will appear here automatically."}
                </p>
              </div>
            )}

            {/* Instructor PiP */}
            <div style={{ position: "absolute", top: "0.65rem", right: "0.65rem", zIndex: 20 }}>
              <ClassroomVideoFeed classId={learningClass.id} onRoomReady={setActiveRoom} onPresentationState={handlePresentationState} pipMode />
              <ClassroomPollOverlay classId={learningClass.id} />
            </div>
          </div>

          {/* Video strip */}
          <div style={{ background: BG, borderTop: "1px solid rgba(255,255,255,0.08)", padding: "0.65rem 1rem", display: "flex", gap: "0.6rem", overflowX: "auto", flexShrink: 0 }}>
            <p style={{ margin: "auto 0", color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>Your camera is live →</p>
            <div style={{ width: 120, height: 80, borderRadius: 8, background: BG3, border: `1px solid ${GOLD}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: GOLD, fontWeight: 700 }}>You (Live)</div>
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div style={{ width: 300, borderLeft: "1px solid rgba(255,255,255,0.08)", background: OFF_W, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ display: "flex", background: WHITE, borderBottom: `1px solid ${GRAY}` }}>
            {(["participants","chat","qa","materials"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setActiveTab(t)} style={{ flex:1, background:"transparent", border:"none", borderBottom: activeTab===t ? `2px solid ${GOLDD}` : "2px solid transparent", color: activeTab===t ? GOLDD : GRAY2, padding:"0.65rem 0.1rem", fontSize:"0.6rem", fontWeight:700, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"0.15rem" }}>
                <span style={{ fontSize: "0.9rem" }}>{t==="participants"?"👥":t==="chat"?"💬":t==="qa"?"❓":"📁"}</span>
                <span>{t==="participants"?"People":t==="chat"?"Chat":t==="qa"?"Q&A":"Files"}</span>
              </button>
            ))}
          </div>

          {activeTab === "participants" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ padding:"0.65rem 0.85rem", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${GRAY}` }}>
                <span style={{ fontWeight:700, fontSize:"0.82rem", color:INK }}>Participants</span>
                <span style={{ color:GOLDD, fontSize:"0.75rem", cursor:"pointer" }}>View All</span>
              </div>
              <div style={{ padding:"0.5rem 0.6rem" }}>
                <div style={{ display:"flex", alignItems:"center", background:WHITE, border:`1px solid ${GRAY}`, borderRadius:7, padding:"0.35rem 0.55rem", gap:"0.35rem", marginBottom:"0.5rem" }}>
                  <span style={{ color:GRAY2, fontSize:"0.8rem" }}>🔍</span>
                  <input placeholder="Search participants…" style={{ flex:1, border:"none", outline:"none", fontSize:"0.75rem", color:INK, background:"transparent" }}/>
                </div>
              </div>
              <div style={{ flex:1, overflowY:"auto" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", padding:"0.45rem 0.85rem" }}>
                  <div style={{ width:34, height:34, borderRadius:"50%", background:GOLD, color:INK, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:"0.85rem", flexShrink:0 }}>S</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:"0.8rem", color:INK }}>Student (You)</div>
                    <div style={{ fontSize:"0.62rem", color:GRAY2 }}>Learner</div>
                  </div>
                  <span style={{ fontSize:"0.8rem", color:GRAY2 }}>🎤</span>
                  <span style={{ fontSize:"0.8rem", color:GRAY2 }}>📷</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ flex:1, overflowY:"auto" }}>
                <ClassroomChat classId={learningClass.id} room={activeRoom} isInstructor={false} />
              </div>
            </div>
          )}

          {activeTab === "qa" && (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem" }}>
              <p style={{ color:GRAY2, fontSize:"0.82rem", textAlign:"center" }}>No questions yet. Ask your instructor anything!</p>
            </div>
          )}

          {activeTab === "materials" && (
            <div style={{ flex:1, overflowY:"auto", padding:"0.5rem" }}>
              {materials.map((m) => (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:"0.55rem", padding:"0.45rem 0.5rem", borderRadius:7, borderBottom:`1px solid ${GRAY}` }}>
                  <span style={{ fontSize:"1.1rem" }}>{fileIcon(m.mimeType)}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:"0.78rem", color:INK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</div>
                    <div style={{ fontSize:"0.62rem", color:GRAY2 }}>{fmtType(m.mimeType)}{m.sizeBytes ? ` · ${fmtSize(m.sizeBytes)}` : ""}</div>
                  </div>
                  {m.id === presState.materialId && <span style={{ background:GOLDD, color:WHITE, fontSize:"0.55rem", fontWeight:800, padding:"0.1rem 0.3rem", borderRadius:3 }}>Live</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ──────────────────────────────────────────── */}
      <div style={{ background: BG2, borderTop: "1px solid rgba(255,255,255,0.08)", padding: "0.45rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: BG3, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.4rem 0.75rem", cursor: "pointer" }}>
          <span style={{ fontSize: "0.85rem" }}>🖥️</span>
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.58rem" }}>Classroom Mode</div>
            <div style={{ color: WHITE, fontSize: "0.7rem", fontWeight: 700 }}>Lecture Mode</div>
          </div>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>▾</span>
        </div>
        <div style={{ display: "flex", gap: "0.2rem" }}>
          {[{ icon:"🎤", label:"Mic" }, { icon:"📷", label:"Camera" }, { icon:"📤", label:"Present", gold:true }, { icon:"📁", label:"Materials" }, { icon:"👥", label:"Participants" }, { icon:"💬", label:"Chat" }, { icon:"❓", label:"Q&A" }, { icon:"⋯", label:"More" }].map(({ icon, label, gold }) => (
            <button key={label} type="button" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.12rem", background:gold?GOLDD:"transparent", border:"1px solid transparent", color:gold?WHITE:"rgba(255,255,255,0.75)", borderRadius:8, padding:"0.4rem 0.6rem", cursor:"pointer", minWidth:48 }}>
              <span style={{ fontSize:"1.1rem" }}>{icon}</span>
              <span style={{ fontSize:"0.56rem", fontWeight:600, letterSpacing:"0.02em" }}>{label}</span>
            </button>
          ))}
        </div>
        <Link href="/learning" style={{ display:"flex", alignItems:"center", gap:"0.4rem", background:RED_BTN, color:WHITE, borderRadius:8, padding:"0.55rem 1.2rem", fontWeight:700, fontSize:"0.85rem", textDecoration:"none" }}>
          Leave
        </Link>
      </div>
    </div>
  );
}
