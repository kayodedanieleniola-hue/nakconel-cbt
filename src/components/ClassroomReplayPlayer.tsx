"use client";

import { useRef, useState } from "react";

type MaterialItem = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
};

export default function ClassroomReplayPlayer({
  classTitle,
  instructorName,
  videoUrl,
  materials = [],
  onClose,
}: {
  classTitle: string;
  instructorName?: string;
  videoUrl: string;
  materials?: MaterialItem[];
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        void videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  return (
    <div style={overlay}>
      <div style={modalCard} className="replay-modal">
        <div style={modalHeader} className="replay-header">
          <div>
            <span style={archiveTag}>ARCHIVED REPLAY SESSION</span>
            <h3 style={modalTitle}>{classTitle}</h3>
            {instructorName && <p style={instructorSub}>Instructor: {instructorName}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", position: "relative" }}>
            <button type="button" onClick={() => setShowMore((open) => !open)} aria-label="Replay options" aria-expanded={showMore} style={moreBtn}>•••</button>
            {showMore && (
              <div style={moreMenu}>
                <span style={speedLabel}>Playback speed</span>
                <div style={speedOptions}>
                  {[1, 1.25, 1.5, 2].map((rate) => (
                    <button key={rate} type="button" onClick={() => { changeSpeed(rate); setShowMore(false); }} style={{ ...speedBtn, background: playbackRate === rate ? "#98661B" : "#2a1010", color: playbackRate === rate ? "#fff" : "#ffd98a" }}>{rate}x</button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={onClose} style={closeBtn}>End session</button>
          </div>
        </div>

        <div style={bodyGrid} className="replay-body">
          {/* Main Video Screen */}
          <div style={videoStage}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={videoElement}
            />

            <div style={controlsRow}>
              <button type="button" onClick={togglePlay} style={playBtn}>
                {isPlaying ? "Pause" : "Play"}
              </button>

              <span style={speedLabel}>{playbackRate}x playback</span>
            </div>
          </div>

          {/* Materials Sidebar */}
          <div style={materialsSidebar} className="replay-materials">
            <h4 style={materialsHeader}>Class Materials ({materials.length})</h4>
            {materials.length === 0 ? (
              <p style={emptyMaterials}>No files attached to this class session.</p>
            ) : (
              <div style={materialsList}>
                {materials.map((item) => (
                  <a
                    key={item.id}
                    href={`/api/student/learning/materials?id=${item.id}`}
                    download
                    style={materialCard}
                  >
                    <div>
                      <strong style={materialTitle}>{item.title}</strong>
                      <span style={materialMeta}>{item.fileName} ({Math.ceil(item.sizeBytes / 1024)} KB)</span>
                    </div>
                    <span style={downloadIcon}>Download</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(10, 4, 4, 0.92)",
  backdropFilter: "blur(8px)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
} as const;

const modalCard = {
  width: "1000px",
  maxWidth: "100%",
  maxHeight: "90vh",
  background: "#180909",
  border: "1px solid #98661B",
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
  color: "#f3eee7",
} as const;

const modalHeader = {
  padding: "1rem 1.25rem",
  background: "#280d0d",
  borderBottom: "1px solid #3d1515",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
} as const;

const archiveTag = {
  fontSize: "0.68rem",
  color: "#ffd98a",
  fontWeight: 700,
  letterSpacing: "0.05em",
} as const;

const modalTitle = {
  margin: "0.2rem 0 0",
  fontSize: "1.2rem",
  fontWeight: 700,
  color: "#fff",
} as const;

const instructorSub = {
  margin: "0.1rem 0 0",
  fontSize: "0.8rem",
  color: "#b08585",
} as const;

const closeBtn = {
  background: "#4d1010",
  color: "#ff4d4d",
  border: "1px solid #ff4d4d",
  borderRadius: 6,
  padding: "0.4rem 0.8rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const moreBtn = { width: 44, height: 40, background: "#2a1010", color: "#ffd98a", border: "1px solid #4a1c1c", borderRadius: 6, cursor: "pointer", fontSize: "1.1rem", fontWeight: 800, lineHeight: 1 } as const;
const moreMenu = { position: "absolute", right: "6.5rem", top: "2.8rem", zIndex: 5, minWidth: 190, padding: "0.75rem", borderRadius: 8, background: "#250b0b", border: "1px solid #98661B", boxShadow: "0 10px 24px rgba(0,0,0,0.5)" } as const;
const speedOptions = { display: "flex", gap: "0.35rem", marginTop: "0.45rem" } as const;

const bodyGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 300px",
  flex: 1,
  overflow: "hidden",
} as const;

const videoStage = {
  display: "flex",
  flexDirection: "column",
  background: "#000",
  position: "relative",
} as const;

const videoElement = {
  width: "100%",
  flex: 1,
  maxHeight: "65vh",
  objectFit: "contain",
} as const;

const controlsRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.75rem 1rem",
  background: "#120505",
  borderTop: "1px solid #2d0c0c",
} as const;

const playBtn = {
  background: "#98661B",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "0.4rem 0.9rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const speedLabel = {
  fontSize: "0.78rem",
  color: "#b08585",
} as const;

const speedBtn = {
  border: "1px solid #4a1c1c",
  borderRadius: 4,
  padding: "0.25rem 0.5rem",
  fontSize: "0.75rem",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const materialsSidebar = {
  padding: "1rem",
  background: "#1c0b0b",
  borderLeft: "1px solid #331010",
  overflowY: "auto",
} as const;

const materialsHeader = {
  margin: "0 0 0.75rem",
  fontSize: "0.9rem",
  fontWeight: 700,
  color: "#ffd98a",
} as const;

const emptyMaterials = {
  fontSize: "0.8rem",
  color: "#885858",
} as const;

const materialsList = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
} as const;

const materialCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.6rem 0.75rem",
  background: "#260e0e",
  border: "1px solid #3d1717",
  borderRadius: 6,
  textDecoration: "none",
  color: "#fff",
  fontSize: "0.8rem",
} as const;

const materialTitle = {
  display: "block",
  color: "#ffd98a",
  fontWeight: 600,
} as const;

const materialMeta = {
  display: "block",
  fontSize: "0.7rem",
  color: "#a07575",
} as const;

const downloadIcon = {
  fontSize: "0.75rem",
  color: "#4ade80",
  fontWeight: 700,
} as const;
