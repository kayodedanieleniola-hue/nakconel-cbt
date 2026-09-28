"use client";

import { useState } from "react";

export type CurriculumItem = {
  id: string;
  weekNumber: number;
  weekTitle: string | null;
  title: string;
  description: string | null;
  status: string; // NOT_DONE | PARTIAL | DONE
  position: number;
};

interface AdminCurriculumManagerProps {
  courseId: string;
  courseName: string;
  items: CurriculumItem[];
  onRefresh: () => void;
}

export default function AdminCurriculumManager({
  courseId,
  courseName,
  items,
  onRefresh,
}: AdminCurriculumManagerProps) {
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekTitle, setWeekTitle] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("NOT_DONE");

  const [bulkText, setBulkText] = useState("");
  const [bulkWeek, setBulkWeek] = useState(1);
  const [showBulk, setShowBulk] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    weekNumber: number;
    weekTitle: string;
    title: string;
    description: string;
  }>({ weekNumber: 1, weekTitle: "", title: "", description: "" });

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please enter a subject/topic title.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          weekNumber,
          weekTitle: weekTitle.trim() || `Week ${weekNumber}`,
          title: title.trim(),
          description: description.trim() || null,
          status,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Added topic to Week ${weekNumber} successfully.`);
        setTitle("");
        setDescription("");
        onRefresh();
      } else {
        setErrorMsg(data.error || "Failed to add curriculum item.");
      }
    } catch {
      setErrorMsg("Network error adding curriculum item.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setErrorMsg("Please enter at least one topic line.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const itemsToCreate = lines.map((line, idx) => ({
      weekNumber: bulkWeek,
      weekTitle: `Week ${bulkWeek}`,
      title: line,
      status: "NOT_DONE",
      position: idx,
    }));

    try {
      const res = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          items: itemsToCreate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Bulk added ${data.count} topics to Week ${bulkWeek}!`);
        setBulkText("");
        setShowBulk(false);
        onRefresh();
      } else {
        setErrorMsg(data.error || "Bulk upload failed.");
      }
    } catch {
      setErrorMsg("Network error uploading bulk curriculum.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(id: string, newStatus: string) {
    try {
      const res = await fetch("/api/admin/curriculum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch {
      setErrorMsg("Failed to update status.");
    }
  }

  async function handleSaveEdit(id: string) {
    try {
      const res = await fetch("/api/admin/curriculum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          weekNumber: editForm.weekNumber,
          weekTitle: editForm.weekTitle,
          title: editForm.title,
          description: editForm.description,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        onRefresh();
      }
    } catch {
      setErrorMsg("Failed to update item.");
    }
  }

  async function handleDeleteItem(id: string, itemTitle: string) {
    if (!confirm(`Are you sure you want to delete topic "${itemTitle}"?`)) return;
    try {
      const res = await fetch(`/api/admin/curriculum?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        onRefresh();
      }
    } catch {
      setErrorMsg("Failed to delete item.");
    }
  }

  // Group items by weekNumber
  const groupedByWeek = items.reduce<Record<number, CurriculumItem[]>>((acc, item) => {
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
    ? Math.round(((doneCount + partialCount * 0.5) / totalCount) * 100)
    : 0;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: "0 0 0.3rem 0", color: "var(--burgundy-900)", fontSize: "1.3rem" }}>
            Curriculum Management ({courseName})
          </h2>
          <p style={mutedStyle}>
            Add and set completion status (Not Done, Partial, Done) for topics by Week.
          </p>
        </div>
        <div style={progressBoxStyle}>
          <span style={{ fontSize: "0.8rem", color: "var(--ink-600)", fontWeight: 600 }}>Course Progress</span>
          <strong style={{ fontSize: "1.4rem", color: "var(--burgundy-900)", fontFamily: "var(--font-display)" }}>
            {completionPercent}%
          </strong>
        </div>
      </div>

      {successMsg && <div style={noticeSuccess}>{successMsg}</div>}
      {errorMsg && <div style={noticeError}>{errorMsg}</div>}

      {/* Add Form Section */}
      <div style={formCardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--burgundy-900)" }}>
            {showBulk ? "Bulk Add Topics" : "Add Curriculum Topic"}
          </h3>
          <button
            type="button"
            onClick={() => setShowBulk(!showBulk)}
            style={toggleBtnStyle}
          >
            {showBulk ? "Single Topic Form" : "⚡ Bulk Add Topics"}
          </button>
        </div>

        {showBulk ? (
          <form onSubmit={handleBulkAdd}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
              <div>
                <label style={labelStyle}>Week Number</label>
                <input
                  type="number"
                  min={1}
                  value={bulkWeek}
                  onChange={(e) => setBulkWeek(Number(e.target.value))}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Topics (One topic per line)</label>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`HTML & CSS Basics\nResponsive Web Design\nJavaScript ES6 Foundations`}
                  style={{ ...inputStyle, resize: "vertical" }}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? "Adding..." : "Upload Bulk Topics"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAddItem}>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
              <div>
                <label style={labelStyle}>Week #</label>
                <input
                  type="number"
                  min={1}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(Number(e.target.value))}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Week Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Week 1: Web Fundamentals"
                  value={weekTitle}
                  onChange={(e) => setWeekTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={inputStyle}
                >
                  <option value="NOT_DONE">🔴 Not Done</option>
                  <option value="PARTIAL">🟡 Partially Done</option>
                  <option value="DONE">🟢 Done (Completed)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={labelStyle}>Subject / Topic Title *</label>
              <input
                type="text"
                placeholder="e.g. HTML5 Forms and Native Validation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: "0.8rem" }}>
              <label style={labelStyle}>Description / Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Key concepts, exercises, assignment"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? "Saving..." : "Add Curriculum Topic"}
            </button>
          </form>
        )}
      </div>

      {/* Curriculum List by Weeks */}
      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "1.15rem", color: "var(--burgundy-900)", margin: "0 0 1rem 0" }}>
          Uploaded Course Curriculum ({items.length} Topics)
        </h3>

        {weekNumbers.length === 0 ? (
          <div style={emptyCardStyle}>
            No curriculum topics uploaded for this course yet. Use the form above to add items for Week 1, Week 2, etc.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1.2rem" }}>
            {weekNumbers.map((wNum) => {
              const weekItems = groupedByWeek[wNum];
              const weekHeading = weekItems[0]?.weekTitle || `Week ${wNum}`;

              return (
                <div key={wNum} style={weekSectionStyle}>
                  <div style={weekHeaderStyle}>
                    <h4 style={{ margin: 0, color: "var(--burgundy-900)", fontSize: "1.05rem" }}>
                      {weekHeading}
                    </h4>
                    <span style={weekBadgeStyle}>{weekItems.length} Topics</span>
                  </div>

                  <div style={{ display: "grid", gap: "0.6rem" }}>
                    {weekItems.map((item) => {
                      const isEditing = editingId === item.id;

                      return (
                        <div key={item.id} style={itemCardStyle}>
                          {isEditing ? (
                            <div style={{ width: "100%" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <input
                                  type="number"
                                  min={1}
                                  value={editForm.weekNumber}
                                  onChange={(e) => setEditForm({ ...editForm, weekNumber: Number(e.target.value) })}
                                  style={inputStyle}
                                />
                                <input
                                  type="text"
                                  placeholder="Week Title"
                                  value={editForm.weekTitle}
                                  onChange={(e) => setEditForm({ ...editForm, weekTitle: e.target.value })}
                                  style={inputStyle}
                                />
                                <input
                                  type="text"
                                  placeholder="Topic Title"
                                  value={editForm.title}
                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                  style={inputStyle}
                                />
                              </div>
                              <input
                                type="text"
                                placeholder="Description"
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                style={{ ...inputStyle, marginBottom: "0.5rem" }}
                              />
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(item.id)}
                                  style={smallBtnStyle}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  style={cancelBtnStyle}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <strong style={{ color: "var(--burgundy-900)", fontSize: "0.95rem" }}>
                                    {item.title}
                                  </strong>
                                </div>
                                {item.description && (
                                  <p style={{ margin: "0.2rem 0 0 0", color: "var(--ink-600)", fontSize: "0.85rem" }}>
                                    {item.description}
                                  </p>
                                )}
                              </div>

                              {/* Status Toggle Buttons */}
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  title="Mark as Not Done"
                                  onClick={() => handleUpdateStatus(item.id, "NOT_DONE")}
                                  style={{
                                    ...statusBtnStyle,
                                    background: item.status === "NOT_DONE" ? "#fee2e2" : "#f5f5f5",
                                    color: item.status === "NOT_DONE" ? "#991b1b" : "#666",
                                    borderColor: item.status === "NOT_DONE" ? "#fca5a5" : "#ddd",
                                  }}
                                >
                                  🔴 Not Done
                                </button>

                                <button
                                  type="button"
                                  title="Mark as Partially Done"
                                  onClick={() => handleUpdateStatus(item.id, "PARTIAL")}
                                  style={{
                                    ...statusBtnStyle,
                                    background: item.status === "PARTIAL" ? "#fef3c7" : "#f5f5f5",
                                    color: item.status === "PARTIAL" ? "#92400e" : "#666",
                                    borderColor: item.status === "PARTIAL" ? "#fde68a" : "#ddd",
                                  }}
                                >
                                  🟡 Partial
                                </button>

                                <button
                                  type="button"
                                  title="Mark as Done"
                                  onClick={() => handleUpdateStatus(item.id, "DONE")}
                                  style={{
                                    ...statusBtnStyle,
                                    background: item.status === "DONE" ? "#dcfce7" : "#f5f5f5",
                                    color: item.status === "DONE" ? "#166534" : "#666",
                                    borderColor: item.status === "DONE" ? "#86efac" : "#ddd",
                                  }}
                                >
                                  🟢 Done
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setEditForm({
                                      weekNumber: item.weekNumber,
                                      weekTitle: item.weekTitle || `Week ${item.weekNumber}`,
                                      title: item.title,
                                      description: item.description || "",
                                    });
                                  }}
                                  style={actionLinkStyle}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id, item.title)}
                                  style={dangerLinkStyle}
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const containerStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "1.4rem",
  marginTop: "1.5rem",
  boxShadow: "var(--shadow-sm)",
} as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  marginBottom: "1.2rem",
  flexWrap: "wrap",
} as const;

const progressBoxStyle = {
  background: "#faf6f0",
  border: "1px solid var(--gold-400)",
  borderRadius: 8,
  padding: "0.6rem 1rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minWidth: 120,
} as const;

const formCardStyle = {
  background: "#fcfbfa",
  border: "1px solid #e7dfd5",
  borderRadius: 8,
  padding: "1.1rem",
} as const;

const labelStyle = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--ink-700)",
  marginBottom: "0.25rem",
} as const;

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: "0.88rem",
  boxSizing: "border-box",
} as const;

const buttonStyle = {
  background: "var(--burgundy-900)",
  color: "#ffffff",
  border: "none",
  borderRadius: 6,
  padding: "0.55rem 1.1rem",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
} as const;

const toggleBtnStyle = {
  background: "transparent",
  border: "1px solid var(--gold-600)",
  color: "#98661B",
  borderRadius: 6,
  padding: "0.35rem 0.75rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const mutedStyle = {
  color: "var(--ink-600)",
  fontSize: "0.88rem",
  margin: 0,
} as const;

const noticeSuccess = {
  color: "#166534",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  padding: "0.65rem 0.9rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  marginBottom: "1rem",
} as const;

const noticeError = {
  color: "#991b1b",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  padding: "0.65rem 0.9rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  marginBottom: "1rem",
} as const;

const emptyCardStyle = {
  background: "#fafafa",
  border: "1px dashed var(--gold-400)",
  borderRadius: 8,
  padding: "1.4rem",
  textAlign: "center",
  color: "var(--ink-600)",
  fontSize: "0.9rem",
} as const;

const weekSectionStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "1rem",
} as const;

const weekHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: "0.6rem",
  marginBottom: "0.6rem",
  borderBottom: "1px solid #eee",
} as const;

const weekBadgeStyle = {
  background: "#efe9e0",
  color: "var(--burgundy-900)",
  fontSize: "0.75rem",
  fontWeight: 700,
  padding: "0.2rem 0.55rem",
  borderRadius: 12,
} as const;

const itemCardStyle = {
  background: "#fafafa",
  border: "1px solid #e9e9e9",
  borderRadius: 6,
  padding: "0.75rem 0.9rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.8rem",
  flexWrap: "wrap",
} as const;

const statusBtnStyle = {
  border: "1px solid #ccc",
  borderRadius: 6,
  padding: "0.3rem 0.6rem",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.15s ease",
} as const;

const actionLinkStyle = {
  background: "none",
  border: "none",
  color: "var(--burgundy-900)",
  fontSize: "0.8rem",
  fontWeight: 700,
  cursor: "pointer",
  padding: "0.2rem 0.4rem",
} as const;

const dangerLinkStyle = {
  ...actionLinkStyle,
  color: "#dc2626",
} as const;

const smallBtnStyle = {
  background: "var(--burgundy-900)",
  color: "#ffffff",
  border: "none",
  borderRadius: 4,
  padding: "0.35rem 0.75rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const cancelBtnStyle = {
  background: "transparent",
  border: "1px solid #ccc",
  color: "#555",
  borderRadius: 4,
  padding: "0.35rem 0.75rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
} as const;
