"use client";

/**
 * ClassroomVideoFeed — student-side LiveKit connection.
 *
 * Stability rules (mirrors InstructorBroadcaster):
 *  • Room lives in a ref, not in state or effect deps.
 *  • Main effect runs ONCE per classId (dep array = [classId]).
 *  • active flag is checked with activeRef.current, not a closure copy,
 *    so the async chain can always tell if the component is still mounted.
 *  • Camera/mic are published AFTER room.connect() resolves — never before.
 *  • Only instructor tracks are rendered in the instructor feed video element.
 *  • PRESENTATION_STATE data-channel messages from the instructor are forwarded
 *    to the parent via onPresentationState callback.
 */

import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
  type LocalTrack,
  type RemoteParticipant,
} from "livekit-client";

export type PresentationState = {
  materialId: string;
  page: number;
};

export default function ClassroomVideoFeed({
  classId,
  onRoomReady,
  onPresentationState,
}: {
  classId: string;
  onRoomReady?: (room: Room) => void;
  onPresentationState?: (state: PresentationState) => void;
}) {
  const roomRef         = useRef<Room | null>(null);
  const activeRef       = useRef(true);
  const instructorVidRef = useRef<HTMLVideoElement>(null);
  const instructorAudRef = useRef<HTMLAudioElement>(null);
  const selfVidRef       = useRef<HTMLVideoElement>(null);
  const localVideoTrack  = useRef<LocalTrack | null>(null);
  const localAudioTrack  = useRef<LocalTrack | null>(null);

  // Stable callback refs so handlers in the effect never go stale
  const onRoomReadyRef       = useRef(onRoomReady);
  const onPresentationRef    = useRef(onPresentationState);
  useEffect(() => { onRoomReadyRef.current = onRoomReady; });
  useEffect(() => { onPresentationRef.current = onPresentationState; });

  const [instructorLive, setInstructorLive] = useState(false);
  const [needsTap,        setNeedsTap]       = useState(false);
  const [status,          setStatus]         = useState("Connecting…");
  const [cameraReady,     setCameraReady]    = useState(false);
  const [cameraError,     setCameraError]    = useState("");
  const [isMuted,         setIsMuted]        = useState(false);

  // BroadcastChannel fallback (same-machine JPEG frames from instructor)
  const [fallbackFrame, setFallbackFrame] = useState<string | null>(null);

  useEffect(() => {
    activeRef.current = true;
    let bc: BroadcastChannel | undefined;

    // ── Same-machine JPEG fallback ────────────────────────────────────────
    try {
      bc = new BroadcastChannel(`nak-classroom-${classId}`);
      bc.onmessage = (e) => {
        if (!activeRef.current) return;
        const d = e.data;
        if (!d) return;
        if (d.type === "FRAME" && d.frame) {
          setFallbackFrame(d.frame);
          if (!instructorLive) setStatus("LIVE (local)");
        } else if (d.type === "STOP") {
          setFallbackFrame(null);
          setStatus("Instructor stream offline");
        }
      };
    } catch { /* BroadcastChannel unavailable */ }

    async function connect() {
      console.log(`[Student] connecting to classId=${classId}`);

      // ── 1. Get token ──────────────────────────────────────────────────
      let livekitUrl: string, token: string;
      try {
        const res  = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`);
        const data = await res.json();
        if (!res.ok || !data.url || !data.token) throw new Error(data.error || "Token unavailable");
        livekitUrl = data.url as string;
        token      = data.token as string;
        console.log(`[Student] token obtained, room=${data.room}`);
      } catch (err) {
        if (activeRef.current) {
          const msg = err instanceof Error ? err.message : "Could not connect";
          setStatus(msg.includes("503") ? "Live video ready (local mode)" : `Offline · ${msg}`);
        }
        return;
      }

      if (!activeRef.current) return;

      // ── 2. Create Room (never recreated) ─────────────────────────────
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: false,
      });
      roomRef.current = room;

      // ── 3. Register events BEFORE connect() ──────────────────────────

      room.on(RoomEvent.Connected, () => {
        console.log(`[Student] connected to room: ${room.name}`);
        if (activeRef.current) {
          setStatus("Connected");
          onRoomReadyRef.current?.(room);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log("[Student] disconnected from room");
        if (activeRef.current) { setInstructorLive(false); setStatus("Disconnected"); }
      });

      room.on(RoomEvent.Reconnecting, () => {
        console.log("[Student] reconnecting…");
        if (activeRef.current) setStatus("Reconnecting…");
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log("[Student] reconnected");
        if (activeRef.current) setStatus("Reconnected");
      });

      // Receive instructor video/audio
      room.on(RoomEvent.TrackSubscribed, async (track, _pub, participant: RemoteParticipant) => {
        console.log(`[Student] TrackSubscribed from ${participant.identity}: kind=${track.kind}`);
        if (!activeRef.current) return;

        // Only render instructor tracks in the instructor feed element
        if (participant.identity.startsWith("instructor-")) {
          if (track.kind === Track.Kind.Video && instructorVidRef.current) {
            track.attach(instructorVidRef.current);
            setInstructorLive(true);
            setStatus("● LIVE");
            console.log("[Student] instructor video attached");
            try {
              await instructorVidRef.current.play();
              setNeedsTap(false);
            } catch {
              setNeedsTap(true);
            }
          }
          if (track.kind === Track.Kind.Audio && instructorAudRef.current) {
            track.attach(instructorAudRef.current);
            console.log("[Student] instructor audio attached");
            // Browsers block autoplay of unmuted audio — attempt play() immediately;
            // if it fails (autoplay policy), the tap-to-enable overlay will show.
            try {
              await instructorAudRef.current.play();
            } catch {
              setNeedsTap(true);
            }
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant: RemoteParticipant) => {
        console.log(`[Student] TrackUnsubscribed from ${participant.identity}: kind=${track.kind}`);
        track.detach();
        if (participant.identity.startsWith("instructor-") && track.kind === Track.Kind.Video) {
          if (activeRef.current) setInstructorLive(false);
        }
      });

      // Receive presentation state data messages from instructor
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          console.log(`[Student] data received from ${participant?.identity}:`, msg);
          if (msg.type === "PRESENTATION_STATE" && msg.materialId) {
            onPresentationRef.current?.({ materialId: msg.materialId, page: msg.page ?? 1 });
          }
        } catch { /* non-JSON payload */ }
      });

      // ── 4. Connect ────────────────────────────────────────────────────
      try {
        await room.connect(livekitUrl, token);
        console.log(`[Student] room.connect() resolved, state=${room.state}`);
      } catch (err) {
        console.error("[Student] room.connect() failed:", err);
        if (activeRef.current) setStatus(`Connection failed: ${err instanceof Error ? err.message : err}`);
        return;
      }

      if (!activeRef.current) {
        console.log("[Student] unmounted before connect resolved");
        void room.disconnect();
        return;
      }

      // ── 5. Publish student camera + mic ───────────────────────────────
      // Browser shows its own permission prompt — no app-level gate.
      try {
        const tracks = await createLocalTracks({ audio: true, video: { facingMode: "user" } });

        if (!activeRef.current) { tracks.forEach((t) => t.stop()); return; }

        const vidTrack = tracks.find((t) => t.kind === Track.Kind.Video) ?? null;
        const audTrack = tracks.find((t) => t.kind === Track.Kind.Audio) ?? null;
        localVideoTrack.current = vidTrack;
        localAudioTrack.current = audTrack;

        // Local self-preview (muted, no echo)
        if (vidTrack && selfVidRef.current) {
          vidTrack.attach(selfVidRef.current);
          void selfVidRef.current.play().catch(() => {});
        }

        for (const track of tracks) {
          await room.localParticipant.publishTrack(track);
        }
        console.log("[Student] camera + mic published to room");

        if (activeRef.current) setCameraReady(true);
      } catch (camErr) {
        console.warn("[Student] camera/mic error:", camErr);
        if (activeRef.current) {
          const msg = camErr instanceof Error ? camErr.message : "Camera unavailable";
          const denied = /permission|denied|notallowed/i.test(msg);
          setCameraError(denied
            ? "Camera access denied — instructor won't see you."
            : `Camera unavailable: ${msg}`
          );
        }
      }
    }

    void connect();

    return () => {
      console.log("[Student] cleanup — disconnecting room");
      activeRef.current = false;
      if (bc) bc.close();
      localVideoTrack.current?.stop();
      localAudioTrack.current?.stop();
      roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
    };
  }, [classId]); // ← ONLY classId — never other deps

  const isStreamActive = instructorLive || !!fallbackFrame;

  const toggleMute = () => {
    if (instructorAudRef.current) {
      instructorAudRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div style={container}>
      {/* Instructor feed */}
      <div style={videoStage}>
        <video
          ref={instructorVidRef}
          autoPlay playsInline muted
          style={{ ...videoEl, display: instructorLive ? "block" : "none" }}
        />
        {!instructorLive && fallbackFrame && (
          <img src={fallbackFrame} alt="Instructor stream" style={videoEl} />
        )}
        {!isStreamActive && (
          <div style={placeholder}>
            <div style={{ fontSize: "1.8rem" }}>📡</div>
            <p style={placeholderText}>Instructor stream offline</p>
            <span style={placeholderSub}>Waiting for broadcast to start</span>
          </div>
        )}
        {needsTap && (
          <button
            type="button"
            onClick={() => {
              void instructorAudRef.current?.play().then(() => setNeedsTap(false)).catch(() => {});
              void instructorVidRef.current?.play().catch(() => {});
            }}
            style={tapBtn}
          >
            Tap to enable audio &amp; video
          </button>
        )}
      </div>

      <audio ref={instructorAudRef} autoPlay style={{
        position: "absolute",
        width: 0,
        height: 0,
        opacity: 0,
        pointerEvents: "none",
      }} />

      <div style={statusRow}>
        <span style={{ ...statusBadge, ...(isStreamActive ? liveBadge : offlineBadge) }}>
          {isStreamActive ? status : status}
        </span>
        {isStreamActive && (
          <button type="button" onClick={toggleMute} style={muteBtn}>
            {isMuted ? "Unmute" : "Mute"}
          </button>
        )}
      </div>

      {/* Self-preview */}
      {cameraReady && (
        <div style={selfWrap}>
          <video ref={selfVidRef} autoPlay playsInline muted style={selfVideo} />
          <span style={selfLabel}>You (live)</span>
        </div>
      )}
      {cameraError && !cameraReady && (
        <p style={camErrNote}>{cameraError}</p>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const container: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.5rem" };

const videoStage: React.CSSProperties = {
  position: "relative",
  background: "#100707",
  border: "1px solid #3b2220",
  borderRadius: 6,
  aspectRatio: "16/9",
  overflow: "hidden",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const videoEl: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

const placeholder: React.CSSProperties = {
  textAlign: "center", padding: "1rem", color: "#a38b80",
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
};

const placeholderText: React.CSSProperties = { margin: 0, fontWeight: 600, fontSize: "0.9rem", color: "#f3eee7" };
const placeholderSub:  React.CSSProperties = { fontSize: "0.72rem", color: "#8c766b" };

const tapBtn: React.CSSProperties = {
  position: "absolute", inset: 0,
  background: "rgba(0,0,0,0.75)",
  color: "#ffd98a", border: "none", cursor: "pointer",
  fontSize: "0.85rem", fontWeight: 600,
};

const statusRow: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem",
};

const statusBadge: React.CSSProperties = {
  fontSize: "0.72rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: 4,
};

const liveBadge: React.CSSProperties = {
  background: "#4d1010", color: "#4dff88", border: "1px solid #2e5938",
};

const offlineBadge: React.CSSProperties = {
  background: "#1a0d0c", color: "#a38b80", border: "1px solid #3b2220",
};

const muteBtn: React.CSSProperties = {
  background: "#241211", color: "#ffd98a", border: "1px solid #98661B",
  borderRadius: 4, padding: "0.18rem 0.45rem", fontSize: "0.72rem", cursor: "pointer", fontWeight: 600,
};

const selfWrap: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" };

const selfVideo: React.CSSProperties = {
  width: "100%", aspectRatio: "16/9",
  objectFit: "cover", borderRadius: 4,
  border: "1px solid #98661B", background: "#100707",
};

const selfLabel: React.CSSProperties = { fontSize: "0.68rem", color: "#4dff88", fontWeight: 600 };

const camErrNote: React.CSSProperties = {
  fontSize: "0.72rem", color: "#ff9a8a", margin: 0,
  background: "#2a0a08", padding: "0.3rem 0.55rem",
  borderRadius: 4, border: "1px solid #5a1c18",
};
