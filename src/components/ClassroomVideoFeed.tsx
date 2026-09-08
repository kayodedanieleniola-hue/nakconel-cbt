"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

export default function ClassroomVideoFeed({ classId }: { classId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [status, setStatus] = useState("Connecting...");
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasLiveVideo, setHasLiveVideo] = useState(false);

  useEffect(() => {
    let active = true;
    let currentRoom: Room | null = null;

    async function connect() {
      const room = new Room({ adaptiveStream: true, dynacast: true });
      currentRoom = room;

      room.on(RoomEvent.TrackSubscribed, async (track) => {
        if (!active) return;
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setHasLiveVideo(true);
          try {
            await videoRef.current.play();
            setNeedsTapToPlay(false);
          } catch {
            setNeedsTapToPlay(true);
          }
        }
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
        }
        setStatus("LIVE (ADAPTIVE SIMULCAST)");
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        if (track.kind === Track.Kind.Video) {
          setHasLiveVideo(false);
        }
      });

      room.on(RoomEvent.Reconnecting, () => {
        if (active) setStatus("Reconnecting...");
      });

      room.on(RoomEvent.Reconnected, () => {
        if (active) setStatus("LIVE STREAMING");
      });

      room.on(RoomEvent.Disconnected, () => {
        if (active) {
          setStatus("Disconnected");
          setHasLiveVideo(false);
        }
      });

      try {
        const response = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to connect");

        await room.connect(data.url, data.token);
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Live feed unavailable";
          setStatus(message.includes("503") || message.includes("not configured") ? "Live video not configured" : `Offline · ${message}`);
        }
      }
    }

    void connect();

    return () => {
      active = false;
      currentRoom?.removeAllListeners();
      void currentRoom?.disconnect();
    };
  }, [classId]);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div style={container}>
      <div style={videoStage}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ ...videoElement, display: hasLiveVideo ? "block" : "none" }}
        />

        {!hasLiveVideo && (
          <div style={fallbackPlaceholder}>
            <div style={avatarIcon}>👨‍🏫</div>
            <p style={placeholderText}>Instructor stream offline</p>
            <span style={placeholderSub}>Waiting for live broadcast to start</span>
          </div>
        )}

        {needsTapToPlay && (
          <button
            type="button"
            onClick={() => {
              videoRef.current?.play().then(() => setNeedsTapToPlay(false)).catch(() => {});
            }}
            style={tapBtn}
          >
            Tap to view live video
          </button>
        )}
      </div>

      <audio ref={audioRef} autoPlay style={{ display: "none" }} />

      <div style={statusBar}>
        <span style={{ ...statusBadge, ...(hasLiveVideo ? liveBadge : offlineBadge) }}>
          {hasLiveVideo ? "● LIVE" : "STATUS"} {status}
        </span>

        {hasLiveVideo && (
          <button type="button" onClick={toggleMute} style={muteBtn}>
            {isMuted ? "🔇 Unmute Audio" : "🔊 Mute Audio"}
          </button>
        )}
      </div>
    </div>
  );
}

const container = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
} as const;

const videoStage = {
  position: "relative",
  background: "#100707",
  border: "1px solid #3b2220",
  borderRadius: 6,
  aspectRatio: "16 / 9",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

const videoElement = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const;

const fallbackPlaceholder = {
  textAlign: "center",
  padding: "1rem",
  color: "#a38b80",
} as const;

const avatarIcon = {
  fontSize: "2.2rem",
} as const;

const placeholderText = {
  margin: "0.3rem 0 0.15rem",
  fontWeight: 600,
  fontSize: "0.9rem",
  color: "#f3eee7",
} as const;

const placeholderSub = {
  fontSize: "0.75rem",
  color: "#8c766b",
} as const;

const tapBtn = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  color: "#ffd98a",
  border: "none",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
} as const;

const statusBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.5rem",
} as const;

const statusBadge = {
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.2rem 0.5rem",
  borderRadius: 4,
} as const;

const liveBadge = {
  background: "#4d1010",
  color: "#4dff88",
  border: "1px solid #2e5938",
} as const;

const offlineBadge = {
  background: "#1a0d0c",
  color: "#a38b80",
  border: "1px solid #3b2220",
} as const;

const muteBtn = {
  background: "#241211",
  color: "#ffd98a",
  border: "1px solid #98661B",
  borderRadius: 4,
  padding: "0.2rem 0.5rem",
  fontSize: "0.75rem",
  cursor: "pointer",
  fontWeight: 600,
} as const;
