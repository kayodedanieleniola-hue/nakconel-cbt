"use client";

import { useState } from "react";
import ClassroomReplayPlayer from "@/components/ClassroomReplayPlayer";

type LearningClassItem = {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  recordingUrl?: string | null;
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

      {/* Archived & Recorded Class Replays */}
      <h2 style={headingStyle}>Archived & Recorded Class Replays</h2>

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
