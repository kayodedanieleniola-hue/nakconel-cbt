"use client";

import { useState } from "react";
import MaterialViewerModal from "@/components/MaterialViewerModal";

export type MaterialItem = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
};

interface StudentMaterialsListProps {
  materials: MaterialItem[];
}

export default function StudentMaterialsList({ materials }: StudentMaterialsListProps) {
  const [viewingMaterial, setViewingMaterial] = useState<MaterialItem | null>(null);

  if (materials.length === 0) return null;

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={headingStyle}>Course Materials & Textbooks</h2>
      <p style={{ color: "var(--ink-600)", fontSize: "0.9rem", margin: "0.2rem 0 0.85rem 0" }}>
        Read course documents and textbooks online.
      </p>

      <div style={{ display: "grid", gap: "0.85rem" }}>
        {materials.map((material) => (
          <article key={material.id} style={classCardStyle}>
            <div>
              <h3 style={{ margin: "0 0 0.2rem 0", color: "var(--burgundy-900)", fontSize: "1.05rem", fontWeight: 700 }}>
                {material.title}
              </h3>
              <p style={mutedStyle}>
                {material.fileName} &middot; {Math.ceil(material.sizeBytes / 1024)} KB
              </p>
            </div>

            <button
              type="button"
              onClick={() => setViewingMaterial(material)}
              style={viewBtnStyle}
            >
              📖 View Material
            </button>
          </article>
        ))}
      </div>

      {viewingMaterial && (
        <MaterialViewerModal
          materialId={viewingMaterial.id}
          title={viewingMaterial.title}
          fileName={viewingMaterial.fileName}
          onClose={() => setViewingMaterial(null)}
        />
      )}
    </div>
  );
}

const headingStyle = {
  color: "var(--burgundy-900)",
  fontSize: "1.35rem",
  fontWeight: 800,
  margin: "0 0 0.2rem 0",
} as const;

const mutedStyle = {
  color: "var(--ink-600)",
  fontSize: "0.88rem",
  lineHeight: 1.5,
  margin: "0.2rem 0 0 0",
} as const;

const classCardStyle = {
  background: "#ffffff",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "1.1rem 1.4rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
  boxShadow: "var(--shadow-sm)",
} as const;

const viewBtnStyle = {
  display: "inline-block",
  background: "var(--burgundy-900)",
  color: "#ffffff",
  border: "none",
  borderRadius: 6,
  padding: "0.55rem 1.1rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
} as const;
