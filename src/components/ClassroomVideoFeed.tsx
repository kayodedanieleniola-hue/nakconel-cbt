"use client";

import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
  type LocalTrack,
} from "livekit-client";
import { LocalClassroomPeer } from "@/lib/localP2P";

export default function ClassroomVideoFeed({
  classId,
  onRoomReady,
}: {
  classId: string;
  onRoomReady?: (room: Room) => void;
}) {
  // Shows the instructor's live feed to the student AND automatically
  // publishes the student's own camera + mic to the room immediately
  // after LiveKit connects. The browser's native permission prompt is
  // the only gate — there is no second application-level confirmation.

  const instructorVideoRef = useRef<HTMLVideoElement>(null);
  const instructorAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const p2pRef = useRef<LocalClassroomPeer | null>(null);

  const [status, setStatus] = useState("Connecting...");
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasLiveVideo, setHasLiveVideo] = useState(false);
  const [fallbackFrame, setFallbackFrame] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const onRoomReadyRef = useRef(onRoomReady);
  useEffect(() => {
    onRoomReadyRef.current = onRoomReady;
  });

  useEffect(() => {
    let active = true;
    let currentRoom: Room | null = null;
    let bc: BroadcastChannel | undefined;

    // ── Local WebRTC P2P (same-machine fallback) ──────────────────────
    try {
      const peer = new LocalClassroomPeer(classId, "student");
      p2pRef.current = peer;
      peer.onRemoteStream = (remoteStream) => {
        if (!active) return;
        if (instructorAudioRef.current) {
          instructorAudioRef.current.srcObject = remoteStream;
          void instructorAudioRef.current.play().catch(() => {});
        }
        if (instructorVideoRef.current && remoteStream.getVideoTracks().length > 0) {
          instructorVideoRef.current.srcObject = remoteStream;
          setHasLiveVideo(true);
          void instructorVideoRef.current.play().catch(() => {});
        }
      };
    } catch {
      // P2P not available — LiveKit path handles it
    }

    // ── BroadcastChannel (same-machine JPEG fallback) ──────────────────
    try {
      bc = new BroadcastChannel(`nak-classroom-${classId}`);

      const sendStudentJoin = () => {
        bc?.postMessage({
          type: "STUDENT_JOIN",
          identity: "student-enrolled",
          name: "Enrolled Student",
        });
      };
      sendStudentJoin();

      bc.onmessage = (event) => {
        if (!active) return;
        const d = event.data;
        if (!d) return;
        if (d.type === "INSTRUCTOR_PING") {
          sendStudentJoin();
        } else if (d.type === "FRAME" && d.frame) {
          setFallbackFrame(d.frame);
          setStatus(`LIVE (${(d.quality || "LOCAL").toUpperCase()})`);
        } else if (d.type === "STOP") {
          setFallbackFrame(null);
          setStatus("Instructor stream offline");
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }

    // ── LiveKit connection + automatic camera/mic publish ─────────────
    async function connect() {
      const room = new Room({ adaptiveStream: true, dynacast: true });
      currentRoom = room;

      // Instructor's track arrives — attach to the viewer element
      room.on(RoomEvent.TrackSubscribed, async (track, _pub, participant) => {
        if (!active) return;
        // Only show tracks from the instructor, not from other students
        if (!participant.identity.startsWith("instructor-")) return;
        if (track.kind === Track.Kind.Video && instructorVideoRef.current) {
          track.attach(instructorVideoRef.current);
          setHasLiveVideo(true);
          try {
            await instructorVideoRef.current.play();
            setNeedsTapToPlay(false);
          } catch {
            setNeedsTapToPlay(true);
          }
        }
        if (track.kind === Track.Kind.Audio && instructorAudioRef.current) {
          track.attach(instructorAudioRef.current);
        }
        setStatus("LIVE (ADAPTIVE SIMULCAST)");
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        if (!participant.identity.startsWith("instructor-")) return;
        track.detach();
        if (track.kind === Track.Kind.Video) setHasLiveVideo(false);
      });

      room.on(RoomEvent.Reconnecting, () => { if (active) setStatus("Reconnecting..."); });
      room.on(RoomEvent.Reconnected,  () => { if (active) setStatus("LIVE STREAMING"); });
      room.on(RoomEvent.Disconnected, () => {
        if (active) { setStatus("Disconnected"); setHasLiveVideo(false); }
      });

      try {
        const response = await fetch(
          `/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to connect");

        await room.connect(data.url, data.token);
        if (!active) return;

        onRoomReadyRef.current?.(room);

        // Phase 2: auto-publish student camera + mic.
        // createLocalTracks triggers the browser's own permission prompt —
        // that is the only confirmation the student sees. Once they click
        // Allow, the stream starts and publishes with no extra step.
        try {
          const tracks = await createLocalTracks({ audio: true, video: true });
          if (!active) { tracks.forEach((t) => t.stop()); return; }

          localTracksRef.current = tracks;

          // Show a small self-preview (muted to prevent echo)
          const videoTrack = tracks.find((t) => t.kind === "video");
          if (videoTrack && localVideoRef.current) {
            videoTrack.attach(localVideoRef.current);
            void localVideoRef.current.play().catch(() => {});
          }

          // Feed the stream into the local P2P peer as well
          const mediaStream = new MediaStream(tracks.map((t) => t.mediaStreamTrack));
          if (p2pRef.current) p2pRef.current.addLocalStream(mediaStream);

          // Publish to LiveKit so the instructor's tile grid shows this student
          for (const track of tracks) {
            await room.localParticipant.publishTrack(track);
          }

          if (active) setCameraReady(true);
        } catch (camErr) {
          // Permission denied or device unavailable — student can still
          // watch the instructor, they just won't appear in the grid.
          if (active) {
            const msg = camErr instanceof Error ? camErr.message : "Camera unavailable";
            const isDenied =
              msg.toLowerCase().includes("permission") ||
              msg.toLowerCase().includes("denied") ||
              msg.toLowerCase().includes("notallowed");
            setCameraError(
              isDenied
                ? "Camera access denied. The instructor won't see you."
                : `Camera unavailable: ${msg}`
            );
          }
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Live feed unavailable";
          setStatus(
            message.includes("503") || message.includes("not configured")
              ? "Live video ready (local mode)"
              : `Offline · ${message}`
          );
        }
      }
    }

    void connect();

    return () => {
      active = false;
      if (bc) bc.close();
      if (p2pRef.current) { p2pRef.current.destroy(); p2pRef.current = null; }
      for (const t of localTracksRef.current) { t.stop(); t.detach(); }
      localTracksRef.current = [];
      currentRoom?.removeAllListeners();
      void currentRoom?.disconnect();
    };
  }, [classId]);

  const toggleMute = () => {
    if (instructorAudioRef.current) {
      instructorAudioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const isStreamActive = hasLiveVideo || !!fallbackFrame;

  return (
    <div style={container}>
      {/* Instructor's video (what the student watches) */}
      <div style={videoStage}>
        <video
          ref={instructorVideoRef}
          autoPlay
          playsInline
          muted
          style={{ ...videoElement, display: hasLiveVideo ? "block" : "none" }}
        />

        {!hasLiveVideo && fallbackFrame && (
          <img src={fallbackFrame} alt="Live Instructor Stream" style={videoElement} />
        )}

        {!isStreamActive && (
          <div style={fallbackPlaceholder}>
            <div style={avatarIcon}>INSTRUCTOR</div>
            <p style={placeholderText}>Instructor stream offline</p>
            <span style={placeholderSub}>Waiting for live broadcast to start</span>
          </div>
        )}

        {needsTapToPlay && (
          <button
            type="button"
            onClick={() => {
              void instructorAudioRef.current?.play().then(() => setNeedsTapToPlay(false)).catch(() => {});
              void instructorVideoRef.current?.play().catch(() => {});
            }}
            style={tapBtn}
          >
            Tap to Enable Audio &amp; Video
          </button>
        )}
      </div>

      <audio ref={instructorAudioRef} autoPlay style={{ display: "none" }} />

      <div style={statusBar}>
        <span style={{ ...statusBadge, ...(isStreamActive ? liveBadgeStyle : offlineBadge) }}>
          {isStreamActive ? `● LIVE · ${status}` : status}
        </span>
        {hasLiveVideo && (
          <button type="button" onClick={toggleMute} style={muteBtn}>
            {isMuted ? "Unmute Audio" : "Mute Audio"}
          </button>
        )}
      </div>

      {/* Student's own camera preview — small, below the instructor feed */}
      {cameraReady && (
        <div style={selfPreviewWrap}>
          <video ref={localVideoRef} autoPlay playsInline muted style={selfPreviewVideo} />
          <span style={selfPreviewLabel}>You (live)</span>
        </div>
      )}

      {/* Non-blocking notice if camera/mic was denied */}
      {cameraError && !cameraReady && (
        <p style={cameraErrorNote}>{cameraError}</p>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const container: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const videoStage: React.CSSProperties = {
  position: "relative",
  background: "#100707",
  border: "1px solid #3b2220",
  borderRadius: 6,
  aspectRatio: "16 / 9",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const videoElement: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const fallbackPlaceholder: React.CSSProperties = {
  textAlign: "center",
  padding: "1rem",
  color: "#a38b80",
};

const avatarIcon: React.CSSProperties = { fontSize: "2.2rem" };

const placeholderText: React.CSSProperties = {
  margin: "0.3rem 0 0.15rem",
  fontWeight: 600,
  fontSize: "0.9rem",
  color: "#f3eee7",
};

const placeholderSub: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#8c766b",
};

const tapBtn: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  color: "#ffd98a",
  border: "none",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const statusBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.5rem",
};

const statusBadge: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.2rem 0.5rem",
  borderRadius: 4,
};

const liveBadgeStyle: React.CSSProperties = {
  background: "#4d1010",
  color: "#4dff88",
  border: "1px solid #2e5938",
};

const offlineBadge: React.CSSProperties = {
  background: "#1a0d0c",
  color: "#a38b80",
  border: "1px solid #3b2220",
};

const muteBtn: React.CSSProperties = {
  background: "#241211",
  color: "#ffd98a",
  border: "1px solid #98661B",
  borderRadius: 4,
  padding: "0.2rem 0.5rem",
  fontSize: "0.75rem",
  cursor: "pointer",
  fontWeight: 600,
};

const selfPreviewWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.2rem",
};

const selfPreviewVideo: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  borderRadius: 4,
  border: "1px solid #98661B",
  background: "#100707",
};

const selfPreviewLabel: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#4dff88",
  fontWeight: 600,
};

const cameraErrorNote: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#ff9a8a",
  margin: 0,
  background: "#2a0a08",
  padding: "0.35rem 0.6rem",
  borderRadius: 4,
  border: "1px solid #5a1c18",
};
