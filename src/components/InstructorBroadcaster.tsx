"use client";

/**
 * InstructorBroadcaster — full live classroom studio for the admin/instructor.
 *
 * KEY ARCHITECTURAL FIXES vs previous version:
 *
 *  1. StudentVideoTile ALWAYS renders <video> and <audio> elements — never
 *     conditionally. This eliminates the race where useEffect runs before the
 *     element exists in the DOM (videoRef.current === null).
 *
 *  2. Track attachment happens in the LiveKit event handler itself (imperative,
 *     using a ref map), NOT deferred to a React useEffect. React effects can
 *     run after a re-render cycle where the element still doesn't exist.
 *     The ref map (tileVideoRefs / tileAudioRefs) maps identity → DOM element
 *     so the event handler can attach immediately.
 *
 *  3. On ParticipantConnected the tile is added to state AND any already-
 *     published tracks that were subscribed before the event are attached.
 *
 *  4. The Room lives in a ref. The main effect runs ONCE per classId only.
 *
 *  5. Presentation state is broadcast via LiveKit data channel (reliable).
 *     Persisted to DB so late-joiners get the current slide.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
  VideoPresets,
  createLocalTracks,
  type LocalTrack,
} from "livekit-client";
import ClassroomChat from "@/components/ClassroomChat";

// ── Audio level meter ─────────────────────────────────────────────────────────

function AudioLevelMeter({ track }: { track: LocalTrack | null }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

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
      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(100, Math.round((avg / 128) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch { /* AudioContext unavailable */ }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx?.close().catch(() => {});
    };
  }, [track]);

  if (!track) return null;
  const barColor = level > 60 ? "#4dff88" : level > 20 ? "#ffd98a" : "#8c766b";

  return (
    <div style={meterWrap} title={`Mic transmitting: ${level}%`}>
      <span style={meterLabel}>🎤 Audio</span>
      <div style={meterTrack}>
        <div style={{ ...meterFill, width: `${level}%`, background: barColor }} />
      </div>
      <span style={{ ...meterLabel, color: barColor, minWidth: 34 }}>{level}%</span>
    </div>
  );
}

const meterWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.4rem",
  background: "#180c0b", border: "1px solid #3b2220",
  borderRadius: 4, padding: "0.3rem 0.55rem",
};
const meterLabel: React.CSSProperties = { fontSize: "0.7rem", color: "#a38b80", whiteSpace: "nowrap" };
const meterTrack: React.CSSProperties = {
  flex: 1, height: 7, background: "#2a1210", borderRadius: 3, overflow: "hidden", minWidth: 60,
};
const meterFill: React.CSSProperties = {
  height: "100%", borderRadius: 3, transition: "width 0.08s ease-out, background 0.2s",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StudentTile = {
  identity: string;
  name: string;
  hasVideo: boolean; // whether a live video track is attached
  hasAudio: boolean;
};

type Material = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
};

type PresentationState = {
  materialId: string;
  page: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// StudentVideoTile
//
// CRITICAL: <video> and <audio> are ALWAYS rendered — never conditional.
// This ensures videoRef and audioRef are always populated when the LiveKit
// event handler calls attachTrack(). If we rendered them conditionally on
// hasVideo/hasAudio we'd get a race: the event fires, videoRef.current is
// null because React hasn't committed the newly-rendered element yet.
// ─────────────────────────────────────────────────────────────────────────────

function StudentVideoTile({
  tile,
  onVideoRef,
  onAudioRef,
}: {
  tile: StudentTile;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onAudioRef: (el: HTMLAudioElement | null) => void;
}) {
  return (
    <div style={tileCard}>
      <div style={tileVideoWrap}>
        {/* Video element is ALWAYS in the DOM; hidden via CSS when no track */}
        <video
          ref={onVideoRef}
          autoPlay
          playsInline
          muted
          style={{ ...tileVideo, display: tile.hasVideo ? "block" : "none" }}
        />
        {/* Placeholder shown when no video track yet */}
        {!tile.hasVideo && (
          <div style={tileNoVideo}>
            <span style={{ fontSize: "1.8rem" }}>👤</span>
            <span style={tileNoVideoText}>Camera connecting…</span>
          </div>
        )}
        {/* Audio element: always in DOM, zero-size (not display:none so autoplay works) */}
        <audio
          ref={onAudioRef}
          autoPlay
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
        <span style={tileLiveDot}>● LIVE</span>
      </div>
      <span style={tileName}>{tile.name}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function InstructorBroadcaster({
  classId,
  classTitle,
  materials,
  onClose,
}: {
  classId: string;
  classTitle: string;
  materials: Material[];
  onClose: () => void;
}) {
  // ── Stable refs ───────────────────────────────────────────────────────────
  const roomRef          = useRef<Room | null>(null);
  const localVideoRef    = useRef<HTMLVideoElement | null>(null);
  const pendingVideoTrack = useRef<LocalTrack | null>(null); // waiting to attach to self-preview
  const videoTrackRef    = useRef<LocalTrack | null>(null);
  const audioTrackRef    = useRef<LocalTrack | null>(null);
  const bcRef            = useRef<BroadcastChannel | null>(null);
  const activeRef        = useRef(true);

  // Maps identity → DOM element for imperative track attachment
  const tileVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const tileAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Callback ref for instructor self-preview — same pattern as student side.
  // Attaches the captured video track the instant the <video> element mounts.
  const selfVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && pendingVideoTrack.current) {
      pendingVideoTrack.current.attach(el);
      void el.play().catch(() => {});
      pendingVideoTrack.current = null;
    }
  }, []);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [cameraOn,   setCameraOn]   = useState(true);
  const [micOn,      setMicOn]      = useState(true);
  const [quality,    setQuality]    = useState<"4k" | "1080p" | "720p" | "480p">("1080p");
  // Exposed to AudioLevelMeter — set once tracks are captured
  const [micTrackForMeter, setMicTrackForMeter] = useState<LocalTrack | null>(null);

  // Student tiles: keyed by identity
  const [studentTiles, setStudentTiles] = useState<Record<string, StudentTile>>({});
  const [raisedHands,  setRaisedHands]  = useState<Record<string, string>>({});

  // Presentation
  const initialMaterialId = materials[0]?.id ?? "";
  const [presState, setPresState] = useState<PresentationState>({ materialId: initialMaterialId, page: 1 });
  const presStateRef = useRef(presState);
  useEffect(() => { presStateRef.current = presState; }, [presState]);

  const [activeTab, setActiveTab] = useState<"presentation" | "students" | "chat">("presentation");
  const [showPollModal,  setShowPollModal]  = useState(false);
  const [pollQuestion,   setPollQuestion]   = useState("");
  const [pollOptionsStr, setPollOptionsStr] = useState("Yes, No, Needs Clarification");

  const selectedMaterial = materials.find((m) => m.id === presState.materialId);
  const previewable = selectedMaterial?.mimeType === "application/pdf" ||
                      !!selectedMaterial?.mimeType?.startsWith("image/");

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getResolution = (q: typeof quality) => {
    switch (q) {
      case "4k":    return VideoPresets.h2160.resolution;
      case "1080p": return VideoPresets.h1080.resolution;
      case "720p":  return VideoPresets.h720.resolution;
      case "480p":  return { width: 854, height: 480, frameRate: 30 };
    }
  };

  // ── Attach / detach a track to a tile element imperatively ────────────────
  const attachTrack = useCallback((track: RemoteTrack, identity: string) => {
    if (track.kind === Track.Kind.Video) {
      const el = tileVideoRefs.current.get(identity);
      if (el) {
        track.attach(el);
        void el.play().catch(() => {});
        console.log(`[Instructor] video track attached to tile for ${identity}`);
        setStudentTiles((prev) => {
          const t = prev[identity];
          if (!t) return prev;
          return { ...prev, [identity]: { ...t, hasVideo: true } };
        });
      } else {
        console.warn(`[Instructor] video ref not ready for ${identity} — will retry`);
        // Retry after next paint
        requestAnimationFrame(() => {
          const el2 = tileVideoRefs.current.get(identity);
          if (el2) {
            track.attach(el2);
            void el2.play().catch(() => {});
            setStudentTiles((prev) => {
              const t = prev[identity];
              if (!t) return prev;
              return { ...prev, [identity]: { ...t, hasVideo: true } };
            });
          }
        });
      }
    } else if (track.kind === Track.Kind.Audio) {
      const el = tileAudioRefs.current.get(identity);
      if (el) {
        track.attach(el);
        void el.play().catch(() => {});
        console.log(`[Instructor] audio track attached to tile for ${identity}`);
        setStudentTiles((prev) => {
          const t = prev[identity];
          if (!t) return prev;
          return { ...prev, [identity]: { ...t, hasAudio: true } };
        });
      }
    }
  }, []);

  // ── Presentation broadcast ────────────────────────────────────────────────
  const broadcastPresentation = useCallback((ps: PresentationState) => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    const payload = JSON.stringify({ type: "PRESENTATION_STATE", ...ps });
    room.localParticipant
      .publishData(new TextEncoder().encode(payload), { reliable: true })
      .catch(() => {});
    console.log("[Instructor] broadcast presentation:", ps);
  }, []);

  const persistPresentation = useCallback(async (ps: PresentationState) => {
    try {
      await fetch("/api/admin/learning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "class",
          id: classId,
          title: classTitle,
          activeMaterialId: ps.materialId,
          presentationPage: ps.page,
        }),
      });
    } catch { /* non-critical */ }
  }, [classId, classTitle]);

  const selectMaterial = useCallback((materialId: string) => {
    const ps: PresentationState = { materialId, page: 1 };
    setPresState(ps);
    broadcastPresentation(ps);
    void persistPresentation(ps);
  }, [broadcastPresentation, persistPresentation]);

  const changePage = useCallback((delta: number) => {
    setPresState((prev) => {
      const next = { ...prev, page: Math.max(1, prev.page + delta) };
      broadcastPresentation(next);
      void persistPresentation(next);
      return next;
    });
  }, [broadcastPresentation, persistPresentation]);

  // ── Helper: ensure tile entry exists in state ────────────────────────────
  const ensureTile = useCallback((rp: RemoteParticipant) => {
    setStudentTiles((prev) => {
      if (prev[rp.identity]) return prev;
      return {
        ...prev,
        [rp.identity]: {
          identity: rp.identity,
          name: rp.name || rp.identity.replace(/^student-/, ""),
          hasVideo: false,
          hasAudio: false,
        },
      };
    });
  }, []);

  // ── Main LiveKit effect — ONCE per classId ────────────────────────────────
  useEffect(() => {
    activeRef.current = true;
    let fallbackInterval: ReturnType<typeof setInterval> | undefined;
    let bc: BroadcastChannel | undefined;

    try {
      bc = new BroadcastChannel(`nak-classroom-${classId}`);
      bcRef.current = bc;
      bc.onmessage = (event) => {
        if (!activeRef.current) return;
        const d = event.data;
        if (!d) return;
        if (d.type === "RAISE_HAND" && d.identity) {
          setRaisedHands((prev) => ({ ...prev, [d.identity]: d.name || d.identity }));
        } else if (d.type === "LOWER_HAND" && d.identity) {
          setRaisedHands((prev) => { const n = { ...prev }; delete n[d.identity]; return n; });
        }
      };
    } catch { /* BroadcastChannel unsupported */ }

    async function start() {
      console.log(`[Instructor] starting — classId=${classId}`);

      // 1. Get token
      let livekitUrl: string, token: string;
      try {
        const res = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`);
        const data = await res.json();
        if (!res.ok || !data.url || !data.token) throw new Error(data.error || "LiveKit not configured");
        livekitUrl = data.url as string;
        token = data.token as string;
        // Normalise: LiveKit SDK needs wss:// not https://
        if (livekitUrl.startsWith("https://")) livekitUrl = livekitUrl.replace("https://", "wss://");
        if (livekitUrl.startsWith("http://"))  livekitUrl = livekitUrl.replace("http://",  "ws://");
        console.log(`[Instructor] token obtained — room=${data.room} url=${livekitUrl}`);
      } catch (err) {
        if (activeRef.current) {
          setErrorMsg(err instanceof Error ? err.message : "Could not get token");
          setConnectionStatus("error");
        }
        return;
      }

      if (!activeRef.current) return;

      // 2. Create Room
      const room = new Room({
        adaptiveStream: false,
        dynacast: true,
        disconnectOnPageLeave: false,
      });
      roomRef.current = room;

      // 3. Register ALL events BEFORE connect()

      room.on(RoomEvent.Connected, () => {
        console.log(`[Instructor] connected — room=${room.name} numParticipants=${room.numParticipants}`);
        if (activeRef.current) { setConnectionStatus("live"); setErrorMsg(""); }
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        console.log(`[Instructor] disconnected — reason=${reason ?? "unknown"}`);
        if (activeRef.current) {
          setConnectionStatus("error");
          setErrorMsg(`Disconnected: ${reason ?? "unknown reason"}`);
        }
      });

      room.on(RoomEvent.Reconnecting, () => console.log("[Instructor] reconnecting…"));
      room.on(RoomEvent.Reconnected,  () => {
        console.log("[Instructor] reconnected");
        if (activeRef.current) setConnectionStatus("live");
      });

      room.on(RoomEvent.ParticipantConnected, (rp: RemoteParticipant) => {
        console.log(`[Instructor] participant connected: identity=${rp.identity} name=${rp.name}`);
        if (!activeRef.current || rp.identity.startsWith("instructor-")) return;

        // Add tile to state
        setStudentTiles((prev) => ({
          ...prev,
          [rp.identity]: {
            identity: rp.identity,
            name: rp.name || rp.identity.replace(/^student-/, ""),
            hasVideo: false,
            hasAudio: false,
          },
        }));

        // Send current presentation state so this student gets the right slide
        const ps = presStateRef.current;
        setTimeout(() => {
          if (!roomRef.current || roomRef.current.state !== "connected") return;
          const payload = JSON.stringify({ type: "PRESENTATION_STATE", ...ps });
          roomRef.current.localParticipant
            .publishData(new TextEncoder().encode(payload), { reliable: true })
            .catch(() => {});
        }, 800);
      });

      room.on(RoomEvent.ParticipantDisconnected, (rp: RemoteParticipant) => {
        console.log(`[Instructor] participant disconnected: ${rp.identity}`);
        if (!activeRef.current) return;
        setStudentTiles((prev) => { const n = { ...prev }; delete n[rp.identity]; return n; });
        // Clean up DOM ref maps
        tileVideoRefs.current.delete(rp.identity);
        tileAudioRefs.current.delete(rp.identity);
      });

      room.on(RoomEvent.TrackPublished, (pub, rp) => {
        console.log(`[Instructor] track published — identity=${rp.identity} kind=${pub.kind} sid=${pub.trackSid}`);
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, rp: RemoteParticipant) => {
        console.log(`[Instructor] track subscribed — identity=${rp.identity} kind=${track.kind} sid=${track.sid}`);
        if (!activeRef.current || rp.identity.startsWith("instructor-")) return;

        // Tile may not be in state yet if ParticipantConnected hasn't fired.
        // ensureTile is safe to call regardless — it's a no-op if tile exists.
        ensureTile(rp);

        // Attach imperatively — use rAF to ensure DOM has committed
        requestAnimationFrame(() => {
          if (!activeRef.current) return;
          attachTrack(track, rp.identity);
        });
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, rp: RemoteParticipant) => {
        console.log(`[Instructor] track unsubscribed — identity=${rp.identity} kind=${track.kind}`);
        if (!activeRef.current) return;
        track.detach();
        if (track.kind === Track.Kind.Video) {
          setStudentTiles((prev) => {
            const t = prev[rp.identity];
            if (!t) return prev;
            return { ...prev, [rp.identity]: { ...t, hasVideo: false } };
          });
        } else if (track.kind === Track.Kind.Audio) {
          setStudentTiles((prev) => {
            const t = prev[rp.identity];
            if (!t) return prev;
            return { ...prev, [rp.identity]: { ...t, hasAudio: false } };
          });
        }
      });

      // 4. Connect
      try {
        await room.connect(livekitUrl, token);
        console.log(`[Instructor] room.connect() resolved — state=${room.state}`);
      } catch (err) {
        console.error("[Instructor] room.connect() failed:", err);
        if (activeRef.current) {
          const msg = err instanceof Error ? err.message : "Connection failed";
          setErrorMsg(`LiveKit error: ${msg}`);
          setConnectionStatus("error");
        }
        return;
      }

      if (!activeRef.current) {
        void room.disconnect();
        return;
      }

      // 5. Publish instructor camera + mic
      try {
        const tracks = await createLocalTracks({
          audio: true,
          video: { resolution: getResolution(quality) },
        });
        const videoTrack = tracks.find((t) => t.kind === Track.Kind.Video) ?? null;
        const audioTrack = tracks.find((t) => t.kind === Track.Kind.Audio) ?? null;
        videoTrackRef.current = videoTrack;
        audioTrackRef.current = audioTrack;
        if (activeRef.current && audioTrack) setMicTrackForMeter(audioTrack);

        if (videoTrack) {
          if (localVideoRef.current) {
            videoTrack.attach(localVideoRef.current);
            void localVideoRef.current.play().catch(() => {});
          } else {
            pendingVideoTrack.current = videoTrack;
          }
        }

        for (const track of tracks) {
          if (track.kind === Track.Kind.Video) {
            await room.localParticipant.publishTrack(track, { simulcast: true });
          } else {
            await room.localParticipant.publishTrack(track);
          }
        }
        console.log("[Instructor] camera + mic published");

        // BroadcastChannel JPEG fallback for same-machine students
        const canvas = document.createElement("canvas");
        const ctx2d = canvas.getContext("2d");
        fallbackInterval = setInterval(() => {
          const vid = localVideoRef.current;
          if (vid && bcRef.current) {
            canvas.width = 640; canvas.height = 360;
            ctx2d?.drawImage(vid, 0, 0, 640, 360);
            const frame = canvas.toDataURL("image/jpeg", 0.5);
            if (frame.length > 100) bcRef.current.postMessage({ type: "FRAME", frame });
          }
        }, 150);

      } catch (camErr) {
        console.error("[Instructor] camera/mic error:", camErr);
        if (activeRef.current) setErrorMsg("Camera/mic unavailable — audio-only mode");
      }

      // 6. Mark class LIVE
      void fetch("/api/admin/learning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "class", id: classId, title: classTitle, status: "LIVE" }),
      }).catch(() => {});

      // 7. Seed pre-existing participants (student joined before instructor)
      if (activeRef.current) {
        const tiles: Record<string, StudentTile> = {};
        for (const [identity, rp] of Array.from(room.remoteParticipants.entries())) {
          if (identity.startsWith("instructor-")) continue;
          console.log(`[Instructor] seeding pre-existing participant: ${identity} (${rp.name})`);
          tiles[identity] = {
            identity,
            name: rp.name || identity.replace(/^student-/, ""),
            hasVideo: false,
            hasAudio: false,
          };
        }
        if (Object.keys(tiles).length > 0) {
          setStudentTiles(tiles);
          // Attach any tracks already subscribed
          requestAnimationFrame(() => {
            for (const [identity, rp] of Array.from(room.remoteParticipants.entries())) {
              if (identity.startsWith("instructor-")) continue;
              for (const pub of Array.from(rp.trackPublications.values())) {
                if (pub.isSubscribed && pub.track) {
                  attachTrack(pub.track as RemoteTrack, identity);
                }
              }
            }
          });
        }
        console.log(`[Instructor] seeded ${Object.keys(tiles).length} pre-existing student(s)`);
      }
    }

    void start();

    return () => {
      console.log("[Instructor] cleanup — disconnecting");
      activeRef.current = false;
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (bc) { bc.postMessage({ type: "STOP" }); bc.close(); }
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
      roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
    };
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quality change: restart video track without reconnecting
  useEffect(() => {
    const vt = videoTrackRef.current;
    if (!vt || !roomRef.current) return;
    const restartable = vt as { restartTrack?: (c: unknown) => Promise<void> };
    if (typeof restartable.restartTrack === "function") {
      void restartable.restartTrack({ resolution: getResolution(quality) }).catch(() => {});
    }
  }, [quality]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Camera / mic mute ─────────────────────────────────────────────────────
  const toggleCamera = () => {
    const vt = videoTrackRef.current;
    if (!vt) return;
    if (cameraOn) { void vt.mute(); setCameraOn(false); }
    else          { void vt.unmute(); setCameraOn(true); }
  };

  const toggleMic = () => {
    const at = audioTrackRef.current;
    if (!at) return;
    if (micOn) { void at.mute(); setMicOn(false); }
    else       { void at.unmute(); setMicOn(true); }
  };

  const studentCount = Object.keys(studentTiles).length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={overlay}>
      <div style={studioShell}>

        {/* Header */}
        <div style={studioHeader}>
          <div>
            <span style={liveTag}>
              {connectionStatus === "live"
                ? "● LIVE STUDIO"
                : connectionStatus === "connecting"
                ? "◌ CONNECTING…"
                : "✕ DISCONNECTED"}
            </span>
            <h3 style={studioTitle}>{classTitle}</h3>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as typeof quality)}
              style={qualitySelect}
            >
              <option value="4k">4K</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch("/api/admin/learning", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "class", id: classId, title: classTitle, status: "COMPLETED" }),
                  });
                } catch { /* non-critical */ }
                onClose();
              }}
              style={endBtn}
            >
              End Broadcast
            </button>
            <button type="button" onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </div>

        {errorMsg && <p style={errorNotice}>{errorMsg}</p>}

        {/* Body */}
        <div style={studioBody}>
          {/* LEFT COLUMN */}
          <div style={leftCol}>
            <div style={tabBar}>
              {(["presentation", "students", "chat"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  style={{ ...tabBtn, ...(activeTab === t ? activeTabBtn : {}) }}
                >
                  {t === "presentation" && "📊 Presentation"}
                  {t === "students"     && `👥 Students (${studentCount})`}
                  {t === "chat"         && "💬 Chat"}
                </button>
              ))}
            </div>

            {/* PRESENTATION TAB */}
            {activeTab === "presentation" && (
              <div style={presTabContent}>
                <div style={materialList}>
                  <p style={sectionLabel}>Materials — click to present:</p>
                  {materials.length === 0
                    ? <p style={emptyNote}>No materials uploaded for this class yet.</p>
                    : materials.map((m) => {
                        const active = m.id === presState.materialId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => selectMaterial(m.id)}
                            style={{ ...matBtn, ...(active ? matBtnActive : {}) }}
                          >
                            <span>
                              {m.mimeType === "application/pdf" ? "📄"
                               : m.mimeType?.startsWith("image/") ? "🖼️"
                               : "📁"}
                            </span>
                            <span style={matTitle}>{m.title}</span>
                            <span style={matSize}>{Math.ceil((m.sizeBytes ?? 0) / 1024)} KB</span>
                            {active && <span style={activeBadge}>▶ Presenting</span>}
                          </button>
                        );
                      })
                  }
                </div>

                <div style={presStageWrap}>
                  <div style={presStageToolbar}>
                    <span style={presTitle}>{selectedMaterial?.title ?? "No material selected"}</span>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => changePage(-1)}
                        disabled={presState.page <= 1}
                        style={pageBtn}
                      >◄ Prev</button>
                      <span style={pageIndicator}>Page {presState.page}</span>
                      <button
                        type="button"
                        onClick={() => changePage(1)}
                        style={pageBtn}
                      >Next ►</button>
                    </div>
                  </div>

                  <div style={presViewport}>
                    {selectedMaterial && previewable ? (
                      <iframe
                        key={`${selectedMaterial.id}-p${presState.page}`}
                        title={selectedMaterial.title}
                        src={`/api/admin/learning/materials/preview?id=${selectedMaterial.id}&page=${presState.page}`}
                        style={presIframe}
                      />
                    ) : selectedMaterial ? (
                      <div style={presEmpty}>
                        <span style={{ fontSize: "2.5rem" }}>📁</span>
                        <p style={{ color: "#fff", margin: "0.5rem 0" }}>{selectedMaterial.title}</p>
                        <p style={{ color: "#a38b80", fontSize: "0.85rem" }}>
                          This format cannot be previewed inline.
                        </p>
                        <a
                          href={`/api/admin/learning/materials/preview?id=${selectedMaterial.id}`}
                          style={downloadBtn}
                          download
                        >↓ Download</a>
                      </div>
                    ) : (
                      <div style={presEmpty}>
                        <span style={{ fontSize: "2.5rem" }}>📊</span>
                        <p style={{ color: "#a38b80" }}>Select a material above to begin presenting</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STUDENTS TAB */}
            {activeTab === "students" && (
              <div style={studentsTabContent}>
                {Object.keys(raisedHands).length > 0 && (
                  <div style={handBanner}>
                    <strong style={{ color: "#ffd98a" }}>
                      ✋ {Object.values(raisedHands).join(", ")} raised their hand
                    </strong>
                  </div>
                )}

                {studentCount === 0 ? (
                  <div style={waitingNote}>
                    <span style={{ fontSize: "2rem" }}>👥</span>
                    <p>Waiting for students to join…</p>
                    <p style={{ fontSize: "0.78rem", color: "#8c766b" }}>
                      Students join at /learning/class/{classId}
                    </p>
                  </div>
                ) : (
                  <div style={studentGrid}>
                    {Object.values(studentTiles).map((tile) => (
                      <StudentVideoTile
                        key={tile.identity}
                        tile={tile}
                        onVideoRef={(el) => {
                          if (el) tileVideoRefs.current.set(tile.identity, el);
                          else tileVideoRefs.current.delete(tile.identity);
                        }}
                        onAudioRef={(el) => {
                          if (el) tileAudioRefs.current.set(tile.identity, el);
                          else tileAudioRefs.current.delete(tile.identity);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CHAT TAB */}
            {activeTab === "chat" && (
              <div style={chatTabContent}>
                <ClassroomChat
                  classId={classId}
                  room={roomRef.current}
                  isInstructor={true}
                  userId="instructor-admin"
                  userName="Instructor (Host)"
                />
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div style={rightCol}>
            <div style={selfPreviewWrap}>
              <div style={selfPreviewStage}>
                <video ref={selfVideoCallbackRef} autoPlay playsInline muted style={selfPreviewVideo} />
                {!cameraOn && (
                  <div style={cameraOffOverlay}>
                    <p style={{ margin: 0, color: "#a38b80", fontSize: "0.85rem" }}>Camera OFF</p>
                  </div>
                )}
                <span style={selfStatusBadge}>
                  {connectionStatus === "live"
                    ? "● LIVE"
                    : connectionStatus === "connecting"
                    ? "◌ CONNECTING"
                    : "✕ OFFLINE"}
                </span>
              </div>
              <p style={selfLabel}>You (Instructor)</p>
            </div>

            {/* Audio level meter — confirms mic is transmitting */}
            <AudioLevelMeter track={micTrackForMeter} />

            <div style={controlsCol}>
              <button
                type="button"
                onClick={toggleCamera}
                style={{ ...ctrlBtn, ...(cameraOn ? ctrlActive : ctrlMuted) }}
              >
                {cameraOn ? "📷 Camera ON" : "📷 Camera OFF"}
              </button>
              <button
                type="button"
                onClick={toggleMic}
                style={{ ...ctrlBtn, ...(micOn ? ctrlActive : ctrlMuted) }}
              >
                {micOn ? "🎤 Mic ON" : "🎤 Mic Muted"}
              </button>
              <button
                type="button"
                onClick={() => setShowPollModal(true)}
                style={{ ...ctrlBtn, background: "#98661B", color: "#fff", borderColor: "#b57d26" }}
              >
                📊 Launch Poll
              </button>
            </div>

            <div style={statsBox}>
              <span style={statsLabel}>CONNECTED</span>
              <span style={statsCount}>{studentCount}</span>
              <span style={statsLabel}>students</span>
            </div>
          </div>
        </div>
      </div>

      {/* Poll Modal */}
      {showPollModal && (
        <div style={pollOverlay}>
          <div style={pollCard}>
            <h4 style={{ margin: "0 0 0.5rem", color: "#ffd98a" }}>Launch Live Poll</h4>
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask students a question…"
              style={pollInput}
            />
            <label style={{ fontSize: "0.75rem", color: "#ffd98a", display: "block", margin: "0.5rem 0 0.2rem" }}>
              Options (comma-separated):
            </label>
            <input
              type="text"
              value={pollOptionsStr}
              onChange={(e) => setPollOptionsStr(e.target.value)}
              placeholder="Yes, No, Partially"
              style={pollInput}
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowPollModal(false)} style={pollCancelBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const options = pollOptionsStr.split(",").map((s) => s.trim()).filter(Boolean);
                  if (!pollQuestion.trim() || options.length < 2) return;
                  try {
                    const res = await fetch("/api/learning/polls", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "CREATE_POLL", classId, question: pollQuestion.trim(), options }),
                    });
                    const d = await res.json();
                    if (d.poll && bcRef.current) bcRef.current.postMessage({ type: "LIVE_POLL", poll: d.poll });
                  } catch { /* poll error */ }
                  setShowPollModal(false);
                  setPollQuestion("");
                }}
                style={pollSubmitBtn}
              >
                Broadcast Poll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
  zIndex: 9999,
  display: "flex", alignItems: "stretch", justifyContent: "center",
  padding: "0.5rem", overflowY: "auto",
};
const studioShell: React.CSSProperties = {
  background: "#1a0d0c", border: "1px solid #98661B", borderRadius: 10,
  width: "100%", maxWidth: 1400,
  display: "flex", flexDirection: "column",
  overflow: "hidden", maxHeight: "98vh",
};
const studioHeader: React.CSSProperties = {
  background: "#330808", borderBottom: "1px solid #4a1919",
  padding: "0.75rem 1.2rem",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  gap: "1rem", flexWrap: "wrap",
};
const liveTag: React.CSSProperties = {
  color: "#4dff88", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.05em", display: "block",
};
const studioTitle: React.CSSProperties = { margin: "0.15rem 0 0", fontSize: "1.1rem", color: "#fff" };
const studioBody: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px",
  flex: 1, overflow: "hidden",
};
const leftCol: React.CSSProperties = {
  display: "flex", flexDirection: "column",
  borderRight: "1px solid #3b2220", overflow: "hidden",
};
const rightCol: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "0.75rem",
  padding: "0.85rem", background: "#120807", overflow: "auto",
};
const tabBar: React.CSSProperties = {
  display: "flex", background: "#180c0b",
  borderBottom: "1px solid #3b2220", flexShrink: 0,
};
const tabBtn: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none",
  borderBottom: "2px solid transparent",
  color: "#a38b80", padding: "0.6rem 0.5rem",
  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
};
const activeTabBtn: React.CSSProperties = {
  color: "#ffd98a", borderBottomColor: "#98661B", background: "#1e1312",
};
const presTabContent: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "220px minmax(0,1fr)",
  flex: 1, overflow: "hidden",
};
const materialList: React.CSSProperties = {
  borderRight: "1px solid #3b2220", padding: "0.75rem 0.6rem",
  overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem",
};
const sectionLabel: React.CSSProperties = {
  fontSize: "0.72rem", color: "#98661B", fontWeight: 700,
  letterSpacing: "0.04em", margin: "0 0 0.4rem",
};
const emptyNote: React.CSSProperties = { fontSize: "0.78rem", color: "#8c766b", fontStyle: "italic" };
const matBtn: React.CSSProperties = {
  textAlign: "left", background: "#1a0d0c", border: "1px solid #3b2220",
  borderRadius: 5, padding: "0.5rem 0.6rem", cursor: "pointer",
  color: "#f3eee7", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem",
};
const matBtnActive: React.CSSProperties = {
  borderColor: "#98661B", background: "#2a1210",
  boxShadow: "0 0 6px rgba(152,102,27,0.3)",
};
const matTitle: React.CSSProperties = {
  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const matSize: React.CSSProperties = { color: "#8c766b", fontSize: "0.68rem", whiteSpace: "nowrap" };
const activeBadge: React.CSSProperties = {
  background: "#98661B", color: "#fff", fontSize: "0.62rem",
  fontWeight: 700, padding: "0.1rem 0.3rem", borderRadius: 3, whiteSpace: "nowrap",
};
const presStageWrap: React.CSSProperties = { display: "flex", flexDirection: "column", overflow: "hidden" };
const presStageToolbar: React.CSSProperties = {
  background: "#261312", borderBottom: "1px solid #3b2220",
  padding: "0.5rem 0.85rem",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  gap: "0.75rem", flexShrink: 0,
};
const presTitle: React.CSSProperties = { color: "#fff", fontSize: "0.9rem", fontWeight: 600 };
const pageBtn: React.CSSProperties = {
  background: "#2b1615", color: "#ffd98a", border: "1px solid #4a2725",
  borderRadius: 4, padding: "0.25rem 0.55rem", fontSize: "0.78rem",
  cursor: "pointer", fontWeight: 600,
};
const pageIndicator: React.CSSProperties = { color: "#d4b684", fontSize: "0.8rem", padding: "0 0.3rem" };
const presViewport: React.CSSProperties = {
  flex: 1, background: "#0c0605", overflow: "auto",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const presIframe: React.CSSProperties = {
  width: "100%", height: "100%", minHeight: "60vh", border: 0, background: "#fff",
};
const presEmpty: React.CSSProperties = {
  textAlign: "center", color: "#a38b80", padding: "2rem",
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
};
const downloadBtn: React.CSSProperties = {
  display: "inline-block", background: "#98661B", color: "#fff",
  textDecoration: "none", padding: "0.45rem 0.9rem",
  borderRadius: 4, fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem",
};
const studentsTabContent: React.CSSProperties = { flex: 1, overflow: "auto", padding: "0.85rem" };
const handBanner: React.CSSProperties = {
  background: "#3d1f05", border: "1px solid #98661B",
  borderRadius: 6, padding: "0.5rem 0.75rem", marginBottom: "0.75rem",
};
const waitingNote: React.CSSProperties = {
  textAlign: "center", color: "#a38b80", padding: "2rem 1rem",
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
};
const studentGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: "0.75rem",
};
const tileCard: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem",
};
const tileVideoWrap: React.CSSProperties = {
  position: "relative", width: "100%", aspectRatio: "16/9",
  background: "#100707", border: "1px solid #3b2220", borderRadius: 6,
  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
};
const tileVideo: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const tileNoVideo: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  gap: "0.3rem", color: "#8c766b",
  position: "absolute", inset: 0, justifyContent: "center",
};
const tileNoVideoText: React.CSSProperties = { fontSize: "0.68rem", color: "#8c766b" };
const tileLiveDot: React.CSSProperties = {
  position: "absolute", top: "0.3rem", right: "0.3rem",
  fontSize: "0.6rem", fontWeight: 700, color: "#4dff88",
  background: "rgba(0,0,0,0.65)", padding: "0.1rem 0.3rem", borderRadius: 3,
};
const tileName: React.CSSProperties = {
  fontSize: "0.78rem", fontWeight: 600, color: "#f3eee7",
  textAlign: "center", maxWidth: "100%",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const chatTabContent: React.CSSProperties = { flex: 1, overflow: "auto", padding: "0.85rem" };
const selfPreviewWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.3rem" };
const selfPreviewStage: React.CSSProperties = {
  position: "relative", background: "#100707", border: "1px solid #3b2220",
  borderRadius: 6, aspectRatio: "16/9", overflow: "hidden",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const selfPreviewVideo: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const cameraOffOverlay: React.CSSProperties = {
  position: "absolute", inset: 0, background: "#120a09",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const selfStatusBadge: React.CSSProperties = {
  position: "absolute", top: "0.35rem", left: "0.35rem",
  background: "rgba(0,0,0,0.7)", color: "#4dff88",
  fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.3rem", borderRadius: 3,
};
const selfLabel: React.CSSProperties = {
  fontSize: "0.72rem", color: "#d4b684", textAlign: "center", margin: 0,
};
const controlsCol: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.4rem" };
const ctrlBtn: React.CSSProperties = {
  width: "100%", padding: "0.55rem", borderRadius: 6,
  fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", border: "1px solid transparent",
};
const ctrlActive: React.CSSProperties = { background: "#331614", borderColor: "#98661B", color: "#ffd98a" };
const ctrlMuted: React.CSSProperties = { background: "#180c0b", borderColor: "#3b2220", color: "#8c766b" };
const statsBox: React.CSSProperties = {
  background: "#180c0b", border: "1px solid #3b2220", borderRadius: 6,
  padding: "0.65rem", textAlign: "center",
  display: "flex", flexDirection: "column", gap: "0.2rem",
};
const statsLabel: React.CSSProperties = {
  fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", color: "#98661B",
};
const statsCount: React.CSSProperties = { fontSize: "2rem", fontWeight: 700, color: "#ffd98a", lineHeight: 1 };
const qualitySelect: React.CSSProperties = {
  background: "#180c0b", color: "#ffd98a", border: "1px solid #98661B",
  borderRadius: 4, padding: "0.3rem 0.5rem", fontSize: "0.8rem", cursor: "pointer",
};
const endBtn: React.CSSProperties = {
  background: "#4d1010", border: "1px solid #ff4d4d", color: "#fff",
  borderRadius: 4, padding: "0.35rem 0.75rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
};
const closeBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid #4a2725", color: "#a38b80",
  borderRadius: 4, padding: "0.35rem 0.55rem", fontSize: "0.85rem", cursor: "pointer",
};
const errorNotice: React.CSSProperties = {
  color: "#ff9a8a", background: "#2a0808", padding: "0.4rem 1rem",
  margin: 0, fontSize: "0.82rem", borderBottom: "1px solid #5a1c18",
};
const pollOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
};
const pollCard: React.CSSProperties = {
  background: "#220c0c", border: "1px solid #98661B", borderRadius: 10,
  padding: "1.25rem", width: "400px", maxWidth: "100%", color: "#fff",
};
const pollInput: React.CSSProperties = {
  width: "100%", background: "#120505", border: "1px solid #4d1c1c",
  borderRadius: 6, padding: "0.55rem 0.75rem", color: "#fff",
  fontSize: "0.85rem", boxSizing: "border-box",
};
const pollCancelBtn: React.CSSProperties = {
  background: "#331010", color: "#ff9999", border: "none",
  borderRadius: 6, padding: "0.4rem 0.8rem", fontSize: "0.82rem", cursor: "pointer",
};
const pollSubmitBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #98661B, #d4af37)", color: "#1a0808",
  border: "none", borderRadius: 6, padding: "0.4rem 0.9rem",
  fontSize: "0.82rem", fontWeight: 800, cursor: "pointer",
};
