"use client";

/**
 * ClassroomVideoFeed — student-side LiveKit connection.
 *
 * KEY FIXES vs previous version:
 *  1. Self-preview starts IMMEDIATELY when camera tracks are captured —
 *     before publishTrack() — so the student sees themselves even if
 *     LiveKit cloud is unavailable.
 *  2. AudioLevelMeter shows a real-time bar so the student knows their
 *     mic is capturing audio.
 *  3. Room stays alive; connection status is surfaced clearly.
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

// ── Audio level meter component ────────────────────────────────────────────

function AudioLevelMeter({ track }: { track: LocalTrack | null }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!track || track.kind !== Track.Kind.Audio) return;
    const mediaTrack = track.mediaStreamTrack;
    if (!mediaTrack) return;

    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(new MediaStream([mediaTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(100, Math.round((avg / 128) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext unavailable
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx?.close().catch(() => {});
    };
  }, [track]);

  if (!track) return null;

  const barColor = level > 60 ? "#4dff88" : level > 20 ? "#ffd98a" : "#8c766b";

  return (
    <div style={meterWrap} title={`Mic level: ${level}%`}>
      <span style={meterLabel}>🎤</span>
      <div style={meterTrack}>
        <div style={{ ...meterFill, width: `${level}%`, background: barColor }} />
      </div>
      <span style={{ ...meterLabel, color: barColor, minWidth: 30 }}>{level}%</span>
    </div>
  );
}

const meterWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.4rem",
  background: "#180c0b", border: "1px solid #3b2220",
  borderRadius: 4, padding: "0.25rem 0.5rem",
};
const meterLabel: React.CSSProperties = { fontSize: "0.7rem", color: "#a38b80" };
const meterTrack: React.CSSProperties = {
  flex: 1, height: 6, background: "#2a1210",
  borderRadius: 3, overflow: "hidden",
};
const meterFill: React.CSSProperties = {
  height: "100%", borderRadius: 3,
  transition: "width 0.08s ease-out, background 0.2s",
};

// ── Main component ─────────────────────────────────────────────────────────

export default function ClassroomVideoFeed({
  classId,
  onRoomReady,
  onPresentationState,
}: {
  classId: string;
  onRoomReady?: (room: Room) => void;
  onPresentationState?: (state: PresentationState) => void;
}) {
  const roomRef          = useRef<Room | null>(null);
  const activeRef        = useRef(true);
  const instructorVidRef = useRef<HTMLVideoElement>(null);
  const instructorAudRef = useRef<HTMLAudioElement>(null);
  const selfVidRef       = useRef<HTMLVideoElement>(null);
  const localVideoTrack  = useRef<LocalTrack | null>(null);
  const localAudioTrack  = useRef<LocalTrack | null>(null);

  const onRoomReadyRef    = useRef(onRoomReady);
  const onPresentationRef = useRef(onPresentationState);
  useEffect(() => { onRoomReadyRef.current = onRoomReady; });
  useEffect(() => { onPresentationRef.current = onPresentationState; });

  const [instructorLive,  setInstructorLive]  = useState(false);
  const [needsTap,        setNeedsTap]        = useState(false);
  const [status,          setStatus]          = useState("Connecting…");
  // cameraReady = camera captured (shows self-preview), NOT gated on LiveKit
  const [cameraReady,     setCameraReady]     = useState(false);
  const [cameraPublished, setCameraPublished] = useState(false); // published to LiveKit
  const [cameraError,     setCameraError]     = useState("");
  const [isMuted,         setIsMuted]         = useState(false);
  const [micTrack,        setMicTrack]        = useState<LocalTrack | null>(null);

  // BroadcastChannel fallback
  const [fallbackFrame, setFallbackFrame] = useState<string | null>(null);

  useEffect(() => {
    activeRef.current = true;
    let bc: BroadcastChannel | undefined;

    try {
      bc = new BroadcastChannel(`nak-classroom-${classId}`);
      bc.onmessage = (e) => {
        if (!activeRef.current) return;
        const d = e.data;
        if (!d) return;
        if (d.type === "FRAME" && d.frame) {
          setFallbackFrame(d.frame);
          setStatus("LIVE (local)");
        } else if (d.type === "STOP") {
          setFallbackFrame(null);
        }
      };
    } catch { /* BroadcastChannel unavailable */ }

    async function connect() {
      console.log(`[Student] connecting — classId=${classId}`);

      // ── STEP 1: Capture camera + mic FIRST (before network) ───────────────
      // This way the student sees themselves immediately regardless of
      // whether LiveKit cloud is reachable.
      let vidTrack: LocalTrack | null = null;
      let audTrack: LocalTrack | null = null;
      try {
        const tracks = await createLocalTracks({ audio: true, video: { facingMode: "user" } });
        if (!activeRef.current) { tracks.forEach((t) => t.stop()); return; }

        vidTrack = tracks.find((t) => t.kind === Track.Kind.Video) ?? null;
        audTrack = tracks.find((t) => t.kind === Track.Kind.Audio) ?? null;
        localVideoTrack.current = vidTrack;
        localAudioTrack.current = audTrack;

        // Show self-preview immediately — before any network calls
        if (vidTrack && selfVidRef.current) {
          vidTrack.attach(selfVidRef.current);
          void selfVidRef.current.play().catch(() => {});
        }

        if (activeRef.current) {
          setCameraReady(true);
          setMicTrack(audTrack);
          console.log("[Student] camera + mic captured — self-preview active");
        }
      } catch (camErr) {
        console.warn("[Student] camera/mic capture failed:", camErr);
        if (activeRef.current) {
          const msg = camErr instanceof Error ? camErr.message : "Camera unavailable";
          const denied = /permission|denied|notallowed/i.test(msg);
          setCameraError(
            denied
              ? "Camera access denied — instructor won't see you. Click the camera icon in your browser address bar to allow."
              : `Camera unavailable: ${msg}`
          );
        }
      }

      // ── STEP 2: Get LiveKit token ─────────────────────────────────────────
      let livekitUrl: string, token: string;
      try {
        const res  = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`);
        const data = await res.json();
        if (!res.ok || !data.url || !data.token) throw new Error(data.error || "Token unavailable");
        livekitUrl = data.url as string;
        token      = data.token as string;
        // Normalise URL: LiveKit SDK needs wss:// not https://
        if (livekitUrl.startsWith("https://")) livekitUrl = livekitUrl.replace("https://", "wss://");
        if (livekitUrl.startsWith("http://"))  livekitUrl = livekitUrl.replace("http://",  "ws://");
        console.log(`[Student] token obtained — room=${data.room} url=${livekitUrl}`);
      } catch (err) {
        if (activeRef.current) {
          const msg = err instanceof Error ? err.message : "Could not connect";
          const localMode = msg.includes("503") || msg.includes("not configured");
          setStatus(localMode ? "Local mode (no cloud)" : `Offline · ${msg}`);
          console.warn("[Student] token error:", msg);
        }
        return; // Camera preview still shows — only LiveKit is skipped
      }

      if (!activeRef.current) return;

      // ── STEP 3: Connect to LiveKit room ───────────────────────────────────
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: false,
      });
      roomRef.current = room;

      room.on(RoomEvent.Connected, () => {
        console.log(`[Student] connected — room=${room.name}`);
        if (activeRef.current) { setStatus("● Connected to room"); onRoomReadyRef.current?.(room); }
      });
      room.on(RoomEvent.Disconnected, () => {
        console.log("[Student] disconnected");
        if (activeRef.current) { setInstructorLive(false); setStatus("Disconnected"); }
      });
      room.on(RoomEvent.Reconnecting, () => { if (activeRef.current) setStatus("Reconnecting…"); });
      room.on(RoomEvent.Reconnected,  () => { if (activeRef.current) setStatus("● Reconnected"); });

      // Instructor tracks
      room.on(RoomEvent.TrackSubscribed, async (track, _pub, participant: RemoteParticipant) => {
        console.log(`[Student] TrackSubscribed — from=${participant.identity} kind=${track.kind}`);
        if (!activeRef.current) return;

        if (participant.identity.startsWith("instructor-")) {
          if (track.kind === Track.Kind.Video && instructorVidRef.current) {
            track.attach(instructorVidRef.current);
            setInstructorLive(true);
            setStatus("● LIVE");
            console.log("[Student] instructor video attached");
            try { await instructorVidRef.current.play(); setNeedsTap(false); }
            catch { setNeedsTap(true); }
          }
          if (track.kind === Track.Kind.Audio && instructorAudRef.current) {
            track.attach(instructorAudRef.current);
            console.log("[Student] instructor audio attached");
            try { await instructorAudRef.current.play(); }
            catch { setNeedsTap(true); }
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant: RemoteParticipant) => {
        console.log(`[Student] TrackUnsubscribed — from=${participant.identity} kind=${track.kind}`);
        track.detach();
        if (participant.identity.startsWith("instructor-") && track.kind === Track.Kind.Video) {
          if (activeRef.current) setInstructorLive(false);
        }
      });

      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          console.log(`[Student] data received — from=${participant?.identity}`, msg);
          if (msg.type === "PRESENTATION_STATE" && msg.materialId) {
            onPresentationRef.current?.({ materialId: msg.materialId, page: msg.page ?? 1 });
          }
        } catch { /* non-JSON */ }
      });

      try {
        await room.connect(livekitUrl, token);
        console.log(`[Student] room.connect() resolved — state=${room.state}`);
      } catch (err) {
        console.error("[Student] room.connect() failed:", err);
        if (activeRef.current) {
          setStatus(`LiveKit failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      if (!activeRef.current) { void room.disconnect(); return; }

      // ── STEP 4: Publish tracks to LiveKit ─────────────────────────────────
      if (vidTrack || audTrack) {
        try {
          const toPublish = [vidTrack, audTrack].filter(Boolean) as LocalTrack[];
          for (const track of toPublish) {
            await room.localParticipant.publishTrack(track);
          }
          console.log("[Student] camera + mic published to LiveKit room");
          if (activeRef.current) setCameraPublished(true);
        } catch (pubErr) {
          console.error("[Student] publishTrack failed:", pubErr);
        }
      }
    }

    void connect();

    return () => {
      console.log("[Student] cleanup — disconnecting");
      activeRef.current = false;
      if (bc) bc.close();
      localVideoTrack.current?.stop();
      localAudioTrack.current?.stop();
      roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
    };
  }, [classId]);

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

      {/* Hidden audio element for instructor — NOT display:none (blocks autoplay) */}
      <audio
        ref={instructorAudRef}
        autoPlay
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />

      {/* Status + mute */}
      <div style={statusRow}>
        <span style={{ ...statusBadge, ...(isStreamActive ? liveBadgeStyle : offlineBadge) }}>
          {status}
        </span>
        {isStreamActive && (
          <button type="button" onClick={toggleMute} style={muteBtn}>
            {isMuted ? "🔇 Unmute" : "🔊 Mute"}
          </button>
        )}
      </div>

      {/* Self-preview — shown as soon as camera is captured, not gated on LiveKit */}
      {cameraReady && (
        <div style={selfWrap}>
          <video ref={selfVidRef} autoPlay playsInline muted style={selfVideo} />
          <div style={selfFooter}>
            <span style={selfLabel}>
              You (live){cameraPublished ? " · ✓ Connected" : " · connecting…"}
            </span>
          </div>
          {/* Audio level meter — shows mic is capturing */}
          <AudioLevelMeter track={micTrack} />
        </div>
      )}

      {cameraError && (
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
const liveBadgeStyle: React.CSSProperties = {
  background: "#4d1010", color: "#4dff88", border: "1px solid #2e5938",
};
const offlineBadge: React.CSSProperties = {
  background: "#1a0d0c", color: "#a38b80", border: "1px solid #3b2220",
};
const muteBtn: React.CSSProperties = {
  background: "#241211", color: "#ffd98a", border: "1px solid #98661B",
  borderRadius: 4, padding: "0.18rem 0.45rem", fontSize: "0.72rem", cursor: "pointer", fontWeight: 600,
};

const selfWrap: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "0.3rem",
};
const selfVideo: React.CSSProperties = {
  width: "100%", aspectRatio: "16/9",
  objectFit: "cover", borderRadius: 4,
  border: "1px solid #98661B", background: "#100707",
};
const selfFooter: React.CSSProperties = {
  display: "flex", justifyContent: "center",
};
const selfLabel: React.CSSProperties = { fontSize: "0.68rem", color: "#4dff88", fontWeight: 600 };
const camErrNote: React.CSSProperties = {
  fontSize: "0.72rem", color: "#ff9a8a", margin: 0,
  background: "#2a0a08", padding: "0.35rem 0.6rem",
  borderRadius: 4, border: "1px solid #5a1c18",
};
