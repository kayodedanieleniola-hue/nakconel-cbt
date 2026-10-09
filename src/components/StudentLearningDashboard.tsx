"use client";

import { useState } from "react";
import Link from "next/link";
import ClassroomReplayPlayer from "@/components/ClassroomReplayPlayer";

export type LearningClassItem = {
  id: string;
  title: string;
  instructor?: string | null;
  description?: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  recordingUrl?: string | null;
  isGeneral?: boolean;
};

type MaterialItem = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
};

export default function StudentLearningDashboard({
  studentName,
  studentId,
  courseName,
  progressPercent,
  attendedCount,
  totalClasses,
  passedExamsCount,
  totalExams,
  allClasses,
  materials,
}: {
  studentName: string;
  studentId: string;
  courseName: string;
  progressPercent: number;
  attendedCount: number;
  totalClasses: number;
  passedExamsCount: number;
  totalExams: number;
  allClasses: LearningClassItem[];
  materials: MaterialItem[];
}) {
  const [selectedReplay, setSelectedReplay] = useState<LearningClassItem | null>(null);

  const activeOrScheduledClasses = allClasses.filter((c) => c.status !== "CANCELLED");
  const recordedClasses = allClasses.filter((c) => c.recordingUrl);

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {/* Dynamic Course Progress Card */}
      <section style={progressCardStyle}>
        <div>
          <p style={eyebrowStyle}>VERIFIED COURSE PROGRESS</p>
          <h2
            style={{
              margin: "0.2rem 0 0.4rem 0",
              color: "var(--burgundy-900)",
              fontSize: "1.85rem",
              fontWeight: 800,
            }}
          >
            {progressPercent}% Complete
          </h2>
          <p style={mutedStyle}>
            {attendedCount} of {totalClasses} classes attended &middot; {passedExamsCount} of {totalExams} assessments passed
          </p>
        </div>

        <div style={progressTrackStyle}>
          <div style={{ ...progressFillStyle, width: `${progressPercent}%` }} />
        </div>
      </section>

      {/* ── COURSE LIVE & SCHEDULED CLASSES ────────────────── */}
      <h2 style={headingStyle}>Live & Scheduled Course Classes</h2>
      <p style={{ color: "var(--ink-600)", fontSize: "0.9rem", margin: "-0.5rem 0 1rem 0" }}>
        Interactive live sessions created by your instructor for <strong>{courseName}</strong>.
      </p>

      {activeOrScheduledClasses.length === 0 ? (
        <div style={emptyCardStyle}>
          No upcoming or active classes scheduled for <strong>{courseName}</strong> yet. Check back soon!
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {activeOrScheduledClasses.map((item) => {
            const isLive = item.status === "LIVE";
            const targetUrl = item.isGeneral ? `/learning/general/${item.id}` : `/learning/class/${item.id}`;

            return (
              <article key={item.id} style={isLive ? liveClassCardStyle : classCardStyle}>
                <div style={{ flex: 1, paddingRight: "0.8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <h3
                      style={{
                        margin: "0 0 0.2rem 0",
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        color: "var(--burgundy-900)",
                      }}
                    >
                      {item.title}
                    </h3>
                    <ClassStatusBadge status={item.status} isGeneral={item.isGeneral} />
                  </div>

                  {item.instructor && (
                    <p style={{ margin: "0.15rem 0", color: "var(--ink-700)", fontSize: "0.88rem", fontWeight: 600 }}>
                      Instructor: {item.instructor}
                    </p>
                  )}

                  {item.description && (
                    <p style={{ margin: "0.2rem 0", color: "var(--ink-600)", fontSize: "0.85rem", lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                  )}

                  {item.startsAt && (
                    <p style={{ margin: "0.25rem 0 0 0", color: "var(--gold-600)", fontSize: "0.82rem", fontWeight: 700 }}>
                      Date: {new Date(item.startsAt).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {isLive ? (
                    <Link href={targetUrl} style={joinLiveBtnStyle}>
                      Join Live Class &rarr;
                    </Link>
                  ) : item.status === "SCHEDULED" || item.status === "DRAFT" ? (
                    <Link href={targetUrl} style={previewBtnStyle}>
                      Enter Classroom &rarr;
                    </Link>
                  ) : item.recordingUrl ? (
                    <button
                      type="button"
                      onClick={() => setSelectedReplay(item)}
                      style={watchBtnStyle}
                    >
                      Watch Replay
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── ARCHIVED & RECORDED CLASS REPLAYS ──────────────── */}
      <h2 style={{ ...headingStyle, marginTop: "2.2rem" }}>Archived & Recorded Class Replays</h2>

      {recordedClasses.length === 0 ? (
        <div style={emptyCardStyle}>
          No recorded classes available yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {recordedClasses.map((item) => (
            <article key={item.id} style={replayCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
                <div style={playIconCircle}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    color="var(--burgundy-900)"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <div>
                  <h3
                    style={{
                      margin: "0 0 0.2rem 0",
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: "var(--burgundy-900)",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, color: "var(--ink-600)", fontSize: "0.85rem" }}>
                    {item.startsAt
                      ? new Date(item.startsAt).toLocaleDateString("en-US", {
                          month: "numeric",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Recorded session"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReplay(item)}
                style={watchBtnStyle}
              >
                Watch
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Replay Player Modal Popup */}
      {selectedReplay && (
        <ClassroomReplayPlayer
          classTitle={selectedReplay.title}
          videoUrl={selectedReplay.recordingUrl!}
          materials={materials}
          onClose={() => setSelectedReplay(null)}
        />
      )}
    </div>
  );
}

function ClassStatusBadge({ status, isGeneral }: { status: string; isGeneral?: boolean }) {
  let bg = "#f3f4f6";
  let color = "#4b5563";
  let label = status;

  if (status === "LIVE") {
    bg = "#dc2626";
    color = "#ffffff";
    label = "LIVE NOW";
  } else if (status === "SCHEDULED") {
    bg = "#d97706";
    color = "#ffffff";
    label = "Scheduled";
  } else if (status === "COMPLETED") {
    bg = "#16a34a";
    color = "#ffffff";
    label = "Completed";
  } else if (status === "DRAFT") {
    bg = "#4b5563";
    color = "#ffffff";
    label = "Upcoming";
  }

  return (
    <span
      style={{
        background: bg,
        color: color,
        padding: "0.2rem 0.6rem",
        borderRadius: 12,
        fontSize: "0.72rem",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {label}
      {isGeneral && " · GENERAL"}
    </span>
  );
}

const progressCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "1.4rem 1.6rem",
  marginBottom: "2rem",
  boxShadow: "var(--shadow-sm)",
} as const;

const eyebrowStyle = {
  color: "var(--gold-600)",
  fontSize: "0.8rem",
  fontWeight: 800,
  margin: 0,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
} as const;

const mutedStyle = {
  color: "var(--ink-600)",
  fontSize: "0.88rem",
  margin: "0.2rem 0 0 0",
  fontWeight: 500,
} as const;

const progressTrackStyle = {
  height: 10,
  background: "#efe9e0",
  borderRadius: 99,
  overflow: "hidden",
  marginTop: "1.1rem",
} as const;

const progressFillStyle = {
  height: "100%",
  background: "linear-gradient(90deg, #cda553, #b8860b)",
  borderRadius: 99,
  transition: "width 0.5s ease",
} as const;

const headingStyle = {
  color: "var(--burgundy-900)",
  fontSize: "1.35rem",
  margin: "2rem 0 1rem 0",
  fontWeight: 800,
} as const;

const emptyCardStyle = {
  background: "#ffffff",
  border: "1px dashed var(--gold-400)",
  borderRadius: 8,
  padding: "1.5rem",
  color: "var(--ink-600)",
  fontSize: "0.9rem",
  textAlign: "center",
} as const;

const classCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "1.1rem 1.4rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  boxShadow: "var(--shadow-sm)",
} as const;

const liveClassCardStyle = {
  ...classCardStyle,
  background: "#fef2f2",
  border: "2px solid #ef4444",
  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.15)",
} as const;

const replayCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "1.1rem 1.4rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
  boxShadow: "var(--shadow-sm)",
} as const;

const playIconCircle = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "rgba(117, 16, 11, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} as const;

const watchBtnStyle = {
  background: "#ffffff",
  color: "var(--burgundy-900)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  padding: "0.45rem 1.25rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.15s ease",
} as const;

const joinLiveBtnStyle = {
  background: "#dc2626",
  color: "#ffffff",
  borderRadius: 6,
  padding: "0.55rem 1.25rem",
  fontSize: "0.88rem",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 8px rgba(220, 38, 38, 0.3)",
} as const;

const previewBtnStyle = {
  background: "var(--burgundy-900)",
  color: "#ffffff",
  borderRadius: 6,
  padding: "0.5rem 1.1rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
} as const;
