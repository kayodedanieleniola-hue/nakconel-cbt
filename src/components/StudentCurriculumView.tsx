"use client";

import { useState } from "react";

export type StudentCurriculumItem = {
  id: string;
  weekNumber: number;
  weekTitle: string | null;
  title: string;
  description: string | null;
  status: string; // NOT_DONE | PARTIAL | DONE
  position: number;
};

interface StudentCurriculumViewProps {
  courseName: string;
  items: StudentCurriculumItem[];
}

export default function StudentCurriculumView({
  courseName,
  items,
}: StudentCurriculumViewProps) {
  const [openWeeks, setOpenWeeks] = useState<Record<number, boolean>>({});

  // Group items by weekNumber
  const groupedByWeek = items.reduce<Record<number, StudentCurriculumItem[]>>((acc, item) => {
    const w = item.weekNumber || 1;
    if (!acc[w]) acc[w] = [];
    acc[w].push(item);
    return acc;
  }, {});

  const weekNumbers = Object.keys(groupedByWeek)
    .map(Number)
    .sort((a, b) => a - b);

  // Overall Completion Calculation
  const totalCount = items.length;
  let doneCount = 0;
  let partialCount = 0;

  items.forEach((item) => {
    if (item.status === "DONE") doneCount++;
    else if (item.status === "PARTIAL") partialCount++;
  });

  const completionPercent = totalCount
    ? Math.min(100, Math.round(((doneCount + partialCount * 0.5) / totalCount) * 100))
    : 0;

  const toggleWeek = (weekNum: number) => {
    setOpenWeeks((prev) => ({
      ...prev,
      [weekNum]: prev[weekNum] === undefined ? false : !prev[weekNum],
    }));
  };

  return (
    <div style={{ display: "grid", gap: "1.75rem", marginBottom: "2.5rem" }}>
      {/* ── COURSE COMPLETION BAR ───────────────────────────── */}
      <div style={completionCardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <p style={eyebrowStyle}>Course Progress</p>
            <h2 style={{ margin: 0, color: "var(--burgundy-900)", fontSize: "1.35rem", fontWeight: 800 }}>
              Overall Completion
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "var(--burgundy-900)", fontFamily: "var(--font-display)", lineHeight: 1 }}>
              {completionPercent}%
            </span>
            <span style={{ color: "var(--ink-600)", fontSize: "0.85rem", fontWeight: 600 }}>completed</span>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div style={progressTrackStyle}>
          <div
            style={{
              ...progressBarFillStyle,
              width: `${completionPercent}%`,
            }}
          />
        </div>

        {/* Breakdown Stats */}
        <div style={statsRowStyle}>
          <div style={statItemStyle}>
            <span style={{ ...dotStyle, background: "#166534" }} />
            <span><strong>{doneCount}</strong> Completed</span>
          </div>
          <div style={statItemStyle}>
            <span style={{ ...dotStyle, background: "#d97706" }} />
            <span><strong>{partialCount}</strong> In Progress</span>
          </div>
          <div style={statItemStyle}>
            <span style={{ ...dotStyle, background: "#991b1b" }} />
            <span><strong>{totalCount - doneCount - partialCount}</strong> Remaining</span>
          </div>
          <div style={{ ...statItemStyle, marginLeft: "auto" }}>
            <span style={{ color: "var(--ink-600)", fontSize: "0.82rem" }}>
              Total Topics: <strong>{totalCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── CURRICULUM SECTION ──────────────────────────────── */}
      <div>
        <div style={{ marginBottom: "1.1rem" }}>
          <p style={eyebrowStyle}>Structured Learning</p>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--burgundy-900)", margin: 0 }}>
            {courseName} Curriculum
          </h2>
          <p style={{ color: "var(--ink-600)", fontSize: "0.9rem", margin: "0.35rem 0 0 0" }}>
            Follow your weekly subjects and track topic completion as set by your instructors.
          </p>
        </div>

        {items.length === 0 ? (
          <div style={emptyCardStyle}>
            The curriculum for <strong>{courseName}</strong> has not been uploaded yet. Check back soon!
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {weekNumbers.map((wNum) => {
              const weekItems = groupedByWeek[wNum];
              const weekHeading = weekItems[0]?.weekTitle || `Week ${wNum}`;
              const isCollapsed = openWeeks[wNum] === false;

              // Calculate week progress
              const wTotal = weekItems.length;
              const wDone = weekItems.filter((i) => i.status === "DONE").length;
              const wPartial = weekItems.filter((i) => i.status === "PARTIAL").length;
              const wPercent = Math.round(((wDone + wPartial * 0.5) / wTotal) * 100);

              return (
                <div key={wNum} style={weekCardStyle}>
                  <div
                    onClick={() => toggleWeek(wNum)}
                    style={weekHeaderStyle}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
                      <div style={weekBadgeStyle}>
                        W{wNum}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, color: "var(--burgundy-900)", fontSize: "1.1rem", fontWeight: 800 }}>
                          {weekHeading}
                        </h3>
                        <p style={{ margin: "0.15rem 0 0 0", color: "var(--ink-600)", fontSize: "0.82rem" }}>
                          {wDone} of {wTotal} topics completed &middot; {wPercent}% done
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={weekStatusBadge(wPercent)}>
                        {wPercent === 100 ? "Completed" : wPercent > 0 ? "In Progress" : "Not Started"}
                      </span>
                      <span style={{ fontSize: "1.2rem", color: "var(--ink-600)", fontWeight: 700 }}>
                        {isCollapsed ? "＋" : "−"}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div style={{ padding: "0.25rem 1.25rem 1.25rem 1.25rem", borderTop: "1px solid #f0e9df" }}>
                      <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.85rem" }}>
                        {weekItems.map((topic) => (
                          <div key={topic.id} style={topicItemStyle}>
                            <div style={{ flex: 1, paddingRight: "0.8rem" }}>
                              <h4 style={topicTitleStyle}>
                                {topic.title}
                              </h4>
                              {topic.description && (
                                <p style={topicDescStyle}>
                                  {topic.description}
                                </p>
                              )}
                            </div>

                            <StatusBadge status={topic.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "DONE") {
    return (
      <span style={{ ...badgeBase, background: "#dcfce7", color: "#15803d", borderColor: "#86efac" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Completed
      </span>
    );
  }

  if (status === "PARTIAL") {
    return (
      <span style={{ ...badgeBase, background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Partially Done
      </span>
    );
  }

  return (
    <span style={{ ...badgeBase, background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      Not Done
    </span>
  );
}

const badgeBase = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.3rem 0.75rem",
  borderRadius: 20,
  fontSize: "0.78rem",
  fontWeight: 700,
  border: "1px solid",
  whiteSpace: "nowrap",
} as const;

const eyebrowStyle = {
  color: "var(--gold-600)",
  fontSize: "0.82rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "0 0 0.3rem 0",
} as const;

const completionCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "1.4rem 1.6rem",
  boxShadow: "var(--shadow-sm)",
} as const;

const progressTrackStyle = {
  height: 14,
  width: "100%",
  background: "#efe9e0",
  borderRadius: 8,
  overflow: "hidden",
  marginBottom: "1rem",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
} as const;

const progressBarFillStyle = {
  height: "100%",
  background: "linear-gradient(90deg, #98661B 0%, #75100B 100%)",
  borderRadius: 8,
  transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

const statsRowStyle = {
  display: "flex",
  gap: "1.2rem",
  alignItems: "center",
  flexWrap: "wrap",
  fontSize: "0.85rem",
  color: "var(--ink-900)",
} as const;

const statItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
} as const;

const dotStyle = {
  width: 8,
  height: 8,
  borderRadius: "50%",
} as const;

const emptyCardStyle = {
  background: "#ffffff",
  border: "1px dashed var(--gold-400)",
  borderRadius: 10,
  padding: "2rem",
  textAlign: "center",
  color: "var(--ink-600)",
  fontSize: "0.95rem",
} as const;

const weekCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "var(--shadow-sm)",
} as const;

const weekHeaderStyle = {
  padding: "1.1rem 1.3rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  userSelect: "none",
  background: "#ffffff",
  transition: "background 0.15s ease",
} as const;

const weekBadgeStyle = {
  background: "var(--burgundy-900)",
  color: "var(--gold-200)",
  width: 42,
  height: 42,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  fontSize: "0.88rem",
  flexShrink: 0,
} as const;

const weekStatusBadge = (percent: number) => {
  if (percent === 100) {
    return {
      background: "#dcfce7",
      color: "#166534",
      padding: "0.25rem 0.65rem",
      borderRadius: 12,
      fontSize: "0.75rem",
      fontWeight: 700,
    } as const;
  }
  if (percent > 0) {
    return {
      background: "#fef3c7",
      color: "#92400e",
      padding: "0.25rem 0.65rem",
      borderRadius: 12,
      fontSize: "0.75rem",
      fontWeight: 700,
    } as const;
  }
  return {
    background: "#efe9e0",
    color: "var(--ink-600)",
    padding: "0.25rem 0.65rem",
    borderRadius: 12,
    fontSize: "0.75rem",
    fontWeight: 700,
  } as const;
};

const topicItemStyle = {
  background: "#fcfbfa",
  border: "1px solid #eae2d7",
  borderRadius: 8,
  padding: "0.85rem 1.1rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
} as const;

const topicTitleStyle = {
  margin: "0 0 0.15rem 0",
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "var(--burgundy-900)",
} as const;

const topicDescStyle = {
  margin: 0,
  fontSize: "0.85rem",
  color: "var(--ink-600)",
  lineHeight: 1.4,
} as const;
