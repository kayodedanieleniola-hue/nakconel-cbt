"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalTracks, LocalTrack, Room, RoomEvent, VideoPresets } from "livekit-client";

export default function InstructorBroadcaster({
  classId,
  classTitle,
  onClose,
}: {
  classId: string;
  classTitle: string;
  onClose: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);

  const [quality, setQuality] = useState<"4k" | "1080p" | "720p" | "480p">("1080p");
  const [status, setStatus] = useState("Initializing camera & microphone...");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const getResolutionPreset = (preset: "4k" | "1080p" | "720p" | "480p") => {
    switch (preset) {
      case "4k":
        return VideoPresets.h2160.resolution;
      case "1080p":
        return VideoPresets.h1080.resolution;
      case "720p":
        return VideoPresets.h720.resolution;
      case "480p":
        return { width: 854, height: 480, frameRate: 30 };
    }
  };

  useEffect(() => {
    let active = true;

    async function startBroadcast() {
      try {
        const response = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to acquire broadcast token");

        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          if (active) {
            setStatus("Broadcast disconnected");
            setIsBroadcasting(false);
          }
        });

        await room.connect(data.url, data.token);

        // Capture local camera & mic tracks with simulcast adaptive layers enabled
        const tracks = await createLocalTracks({
          audio: true,
          video: { resolution: getResolutionPreset(quality) },
        });

        localTracksRef.current = tracks;

        for (const track of tracks) {
          if (track.kind === "video" && localVideoRef.current) {
            track.attach(localVideoRef.current);
            await room.localParticipant.publishTrack(track, { simulcast: true });
          } else {
            await room.localParticipant.publishTrack(track);
          }
        }

        if (active) {
          setStatus(`BROADCASTING LIVE (${quality.toUpperCase()} · SIMULCAST ACTIVE)`);
          setIsBroadcasting(true);
        }
      } catch (err) {
        console.error("Instructor broadcast error:", err);
        if (active) {
          const msg = err instanceof Error ? err.message : "Failed to start broadcast";
          setErrorMsg(msg);
          setStatus("Broadcast failed");
        }
      }
    }

    void startBroadcast();

    return () => {
      active = false;
      for (const track of localTracksRef.current) {
        track.stop();
        track.detach();
      }
      roomRef.current?.removeAllListeners();
      void roomRef.current?.disconnect();
    };
  }, [classId, quality]);

  const toggleCamera = () => {
    const videoTrack = localTracksRef.current.find((t) => t.kind === "video");
    if (videoTrack) {
      if (cameraOn) {
        videoTrack.mute();
        setCameraOn(false);
      } else {
        videoTrack.unmute();
        setCameraOn(true);
      }
    }
  };

  const toggleMic = () => {
    const audioTrack = localTracksRef.current.find((t) => t.kind === "audio");
    if (audioTrack) {
      if (micOn) {
        audioTrack.mute();
        setMicOn(false);
      } else {
        audioTrack.unmute();
        setMicOn(true);
      }
    }
  };

  return (
    <div style={overlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <span style={liveTag}>INSTRUCTOR LIVE STUDIO (PHASE 8: ADAPTIVE 4K)</span>
            <h3 style={modalTitle}>{classTitle}</h3>
          </div>
          <button type="button" onClick={onClose} style={closeBtn}>
            ✕ Close
          </button>
        </div>

        <div style={previewStage}>
          <video ref={localVideoRef} autoPlay playsInline muted style={previewVideo} />

          {!cameraOn && (
            <div style={cameraOffOverlay}>
              <span style={{ fontSize: "2rem" }}>📷</span>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#a38b80" }}>
                Camera is turned OFF
              </p>
            </div>
          )}

          <div style={statusOverlay}>
            <span style={{ ...statusBadge, ...(isBroadcasting ? liveBadge : alertBadge) }}>
              {isBroadcasting
                ? `● LIVE (${quality.toUpperCase()} · ADAPTIVE SIMULCAST)`
                : status}
            </span>
          </div>
        </div>

        {errorMsg && <p style={errorNotice}>{errorMsg}</p>}

        {/* Resolution Quality Selector */}
        <div style={qualitySelectorRow}>
          <label style={qualityLabel}>Broadcast Resolution & Quality:</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as "4k" | "1080p" | "720p" | "480p")}
            style={qualitySelect}
          >
            <option value="4k">✨ 4K Ultra HD (3840 × 2160 @ 30fps) - Max Clarity</option>
            <option value="1080p">📺 1080p Full HD (1920 × 1080 @ 30fps)</option>
            <option value="720p">⚡ 720p HD (1280 × 720 @ 30fps) - Balanced</option>
            <option value="480p">📶 480p SD (854 × 480 @ 30fps) - Low Bandwidth</option>
          </select>
        </div>

        <div style={controlsRow}>
          <button
            type="button"
            onClick={toggleCamera}
            style={{ ...ctrlBtn, ...(cameraOn ? activeCtrlBtn : mutedCtrlBtn) }}
          >
            {cameraOn ? "📷 Camera ON" : "📷 Camera OFF"}
          </button>

          <button
            type="button"
            onClick={toggleMic}
            style={{ ...ctrlBtn, ...(micOn ? activeCtrlBtn : mutedCtrlBtn) }}
          >
            {micOn ? "🎙️ Microphone ON" : "🎙️ Microphone Muted"}
          </button>

          <button type="button" onClick={onClose} style={endBtn}>
            ⏹️ End Broadcast
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "1rem",
} as const;

const modalCard = {
  background: "#1e1312",
  border: "1px solid #98661B",
  borderRadius: 10,
  padding: "1.2rem",
  width: "100%",
  maxWidth: 640,
  color: "#f3eee7",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
} as const;

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
} as const;

const liveTag = {
  color: "#98661B",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
} as const;

const modalTitle = {
  margin: "0.2rem 0 0",
  fontSize: "1.15rem",
  color: "#fff",
} as const;

const closeBtn = {
  background: "transparent",
  border: "1px solid #4a2725",
  color: "#a38b80",
  borderRadius: 4,
  padding: "0.35rem 0.65rem",
  fontSize: "0.8rem",
  cursor: "pointer",
} as const;

const previewStage = {
  position: "relative",
  background: "#100707",
  border: "1px solid #3b2220",
  borderRadius: 8,
  aspectRatio: "16 / 9",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

const previewVideo = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const;

const cameraOffOverlay = {
  position: "absolute",
  inset: 0,
  background: "#120a09",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
} as const;

const statusOverlay = {
  position: "absolute",
  top: "0.6rem",
  left: "0.6rem",
} as const;

const statusBadge = {
  fontSize: "0.75rem",
  fontWeight: 700,
  padding: "0.25rem 0.6rem",
  borderRadius: 4,
} as const;

const liveBadge = {
  background: "#4d1010",
  color: "#4dff88",
  border: "1px solid #2e5938",
} as const;

const alertBadge = {
  background: "#331a08",
  color: "#ffd98a",
  border: "1px solid #98661B",
} as const;

const errorNotice = {
  color: "#ff6b6b",
  fontSize: "0.82rem",
  margin: 0,
} as const;

const controlsRow = {
  display: "flex",
  gap: "0.6rem",
  flexWrap: "wrap",
} as const;

const ctrlBtn = {
  flex: 1,
  padding: "0.65rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
} as const;

const activeCtrlBtn = {
  background: "#331614",
  borderColor: "#98661B",
  color: "#ffd98a",
} as const;

const mutedCtrlBtn = {
  background: "#180c0b",
  borderColor: "#3b2220",
  color: "#8c766b",
} as const;

const endBtn = {
  background: "#4d1010",
  borderColor: "#ff4d4d",
  color: "#fff",
  padding: "0.65rem 1rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
} as const;

const qualitySelectorRow = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
} as const;

const qualityLabel = {
  fontSize: "0.8rem",
  color: "#ffd98a",
  fontWeight: 600,
} as const;

const qualitySelect = {
  background: "#100707",
  color: "#fff",
  border: "1px solid #98661B",
  borderRadius: 6,
  padding: "0.55rem 0.7rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  outline: "none",
} as const;
