"use client";

import { useEffect } from "react";

interface MaterialViewerModalProps {
  materialId: string;
  title: string;
  fileName: string;
  onClose: () => void;
}

export default function MaterialViewerModal({
  materialId,
  title,
  fileName,
  onClose,
}: MaterialViewerModalProps) {
  useEffect(() => {
    // Disable right-click context menu and save/print shortcuts while viewing document
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "s")) {
        e.preventDefault();
      }
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const viewUrl = `/api/learning/materials/${materialId}#toolbar=0&navpanes=0&scrollbar=0`;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={badgeStyle}>READ ONLY</span>
            <div>
              <h3 style={titleStyle}>{title}</h3>
              <span style={fileNameStyle}>{fileName}</span>
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeBtnStyle}>
            Close Document
          </button>
        </div>

        {/* View-Only Document Frame */}
        <div style={viewerContainerStyle} onContextMenu={(e) => e.preventDefault()}>
          <iframe
            src={viewUrl}
            title={title}
            style={iframeStyle}
          />
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(10, 4, 4, 0.92)",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.2rem",
} as const;

const modalCardStyle = {
  width: "1100px",
  maxWidth: "100%",
  height: "92vh",
  background: "#180909",
  border: "1px solid var(--gold-600)",
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
} as const;

const headerStyle = {
  background: "#280d0d",
  borderBottom: "1px solid #3d1515",
  padding: "1rem 1.4rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
} as const;

const badgeStyle = {
  background: "#98661B",
  color: "#ffffff",
  fontSize: "0.7rem",
  fontWeight: 800,
  letterSpacing: "0.05em",
  padding: "0.25rem 0.6rem",
  borderRadius: 4,
} as const;

const titleStyle = {
  margin: 0,
  color: "#ffffff",
  fontSize: "1.1rem",
  fontWeight: 800,
} as const;

const fileNameStyle = {
  color: "#b08585",
  fontSize: "0.8rem",
} as const;

const closeBtnStyle = {
  background: "#4d1010",
  color: "#ff4d4d",
  border: "1px solid #ff4d4d",
  borderRadius: 6,
  padding: "0.45rem 1rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const viewerContainerStyle = {
  flex: 1,
  background: "#0d0404",
  position: "relative",
  userSelect: "none",
  WebkitUserSelect: "none",
} as const;

const iframeStyle = {
  width: "100%",
  height: "100%",
  border: "none",
} as const;
