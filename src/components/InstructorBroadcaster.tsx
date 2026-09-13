"use client";

/**
 * InstructorBroadcaster — full live classroom studio for the admin/instructor.
 * Fully responsive: mobile takes the whole viewport with bottom-sheet panels.
 * Desktop preserves the two-column studio layout.
 *
 * All LiveKit logic is unchanged from the original.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room, RoomEvent, Track,
  RemoteParticipant, RemoteTrack,
  VideoPresets, createLocalTracks, type LocalTrack,
} from "livekit-client";
import ClassroomChat from "@/components/ClassroomChat";

/* ── tokens ───────────────────────────────────────────────────────────────── */
const DARK    = "#1a0d0c";
const DARK2   = "#180c0b";
const DARK3   = "#120807";
const RIM     = "#3b2220";
const WINE    = "#330808";
const GOLD    = "#ffd98a";
const GOLDB   = "#98661B";
const GOLDD   = "#b8922f";
const WHITE   = "#ffffff";
const GREEN   = "#4dff88";
const RED     = "#ff4d4d";
const MUTED   = "#a38b80";

/* ── Audio level meter ────────────────────────────────────────────────────── */
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
    return () => { cancelAnimationFrame(rafRef.current); ctx?.close().catch(() => {}); };
  }, [track]);

  if (!track) return null;
  const barColor = level > 60 ? GREEN : level > 20 ? GOLD : MUTED;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", background:DARK2, border:`1px solid ${RIM}`, borderRadius:4, padding:"0.3rem 0.55rem" }}>
      <span style={{ fontSize:"0.7rem", color:MUTED, whiteSpace:"nowrap" }}>🎤 Audio</span>
      <div style={{ flex:1, height:7, background:"#2a1210", borderRadius:3, overflow:"hidden", minWidth:60 }}>
        <div style={{ height:"100%", borderRadius:3, transition:"width 0.08s ease-out, background 0.2s", width:`${level}%`, background:barColor }}/>
      </div>
      <span style={{ fontSize:"0.7rem", color:barColor, minWidth:34, whiteSpace:"nowrap" }}>{level}%</span>
    </div>
  );
}

/* ── Types ────────────────────────────────────────────────────────────────── */
type StudentTile = { identity: string; name: string; hasVideo: boolean; hasAudio: boolean };
type Material    = { id: string; title: string; fileName: string; mimeType: string; sizeBytes?: number };
type PresState   = { materialId: string; page: number };

/* ── Student video tile ───────────────────────────────────────────────────── */
function StudentVideoTile({ tile, onVideoRef, onAudioRef, rootVideoRefs }: {
  tile: StudentTile;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onAudioRef: (el: HTMLAudioElement | null) => void;
  rootVideoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}) {
  const tileVideoCallbackRef = (el: HTMLVideoElement | null) => {
    onVideoRef(el);
    if (el) {
      const rootEl = rootVideoRefs.current.get(tile.identity);
      if (rootEl?.srcObject) { el.srcObject = rootEl.srcObject; void el.play().catch(() => {}); }
    }
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.35rem" }}>
      <div style={{ position:"relative", width:"100%", aspectRatio:"16/9", background:"#100707", border:`1px solid ${RIM}`, borderRadius:6, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <video ref={tileVideoCallbackRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:tile.hasVideo?"block":"none" }}/>
        {!tile.hasVideo && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.3rem", color:MUTED, position:"absolute", inset:0, justifyContent:"center" }}>
            <span style={{ fontSize:"1.8rem" }}>👤</span>
            <span style={{ fontSize:"0.68rem", color:MUTED }}>Camera connecting…</span>
          </div>
        )}
        <audio ref={onAudioRef} autoPlay style={{ position:"absolute", width:0, height:0, opacity:0, pointerEvents:"none" }}/>
        <span style={{ position:"absolute", top:"0.3rem", right:"0.3rem", fontSize:"0.6rem", fontWeight:700, color:GREEN, background:"rgba(0,0,0,0.65)", padding:"0.1rem 0.3rem", borderRadius:3 }}>● LIVE</span>
      </div>
      <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#f3eee7", textAlign:"center", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tile.name}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* Main component                                                             */
/* ══════════════════════════════════════════════════════════════════════════ */
export default function InstructorBroadcaster({ classId, classTitle, materials, onClose }: {
  classId: string; classTitle: string; materials: Material[]; onClose: () => void;
}) {
  /* ── refs ────────────────────────────────────────────────────────────── */
  const roomRef           = useRef<Room | null>(null);
  const localVideoRef     = useRef<HTMLVideoElement | null>(null);
  const pendingVideoTrack = useRef<LocalTrack | null>(null);
  const videoTrackRef     = useRef<LocalTrack | null>(null);
  const audioTrackRef     = useRef<LocalTrack | null>(null);
  const bcRef             = useRef<BroadcastChannel | null>(null);
  const activeRef         = useRef(true);
  const tileVideoRefs     = useRef<Map<string, HTMLVideoElement>>(new Map());
  const tileAudioRefs     = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rootAudioRefs     = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rootVideoRefs     = useRef<Map<string, HTMLVideoElement>>(new Map());

  const selfVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && pendingVideoTrack.current) {
      pendingVideoTrack.current.attach(el);
      void el.play().catch(() => {});
      pendingVideoTrack.current = null;
    }
  }, []);

  /* ── state ───────────────────────────────────────────────────────────── */
  const [connectionStatus, setConnectionStatus] = useState<"connecting"|"live"|"error">("connecting");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [cameraOn,   setCameraOn]   = useState(true);
  const [micOn,      setMicOn]      = useState(true);
  const [quality,    setQuality]    = useState<"4k"|"1080p"|"720p"|"480p">("1080p");
  const [micTrackForMeter, setMicTrackForMeter] = useState<LocalTrack | null>(null);
  const [studentTiles, setStudentTiles] = useState<Record<string, StudentTile>>({});
  const [raisedHands,  setRaisedHands]  = useState<Record<string, string>>({});
  const initialMaterialId = materials[0]?.id ?? "";
  const [presState, setPresState] = useState<PresState>({ materialId: initialMaterialId, page: 1 });
  const presStateRef = useRef(presState);
  useEffect(() => { presStateRef.current = presState; }, [presState]);

  const [activeTab,      setActiveTab]      = useState<"presentation"|"students"|"chat">("presentation");
  const [showPollModal,  setShowPollModal]  = useState(false);
  const [pollQuestion,   setPollQuestion]   = useState("");
  const [pollOptionsStr, setPollOptionsStr] = useState("Yes, No, Needs Clarification");

  /* responsive */
  const [isMobile,   setIsMobile]   = useState(false);
  const [showSheet,  setShowSheet]  = useState(false);
  const [sheetTab,   setSheetTab]   = useState<"presentation"|"students"|"chat">("presentation");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const selectedMaterial = materials.find((m) => m.id === presState.materialId);
  const previewable = selectedMaterial?.mimeType === "application/pdf" || !!selectedMaterial?.mimeType?.startsWith("image/");
  const studentCount = Object.keys(studentTiles).length;

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const getResolution = (q: typeof quality) => {
    switch (q) {
      case "4k":    return VideoPresets.h2160.resolution;
      case "1080p": return VideoPresets.h1080.resolution;
      case "720p":  return VideoPresets.h720.resolution;
      case "480p":  return { width: 854, height: 480, frameRate: 30 };
    }
  };

  const attachTrack = useCallback((track: RemoteTrack, identity: string) => {
    if (track.kind === Track.Kind.Video) {
      const attachTo = (el: HTMLVideoElement) => {
        track.attach(el);
        void el.play().catch(() => {});
        setStudentTiles((prev) => {
          const t = prev[identity]; if (!t) return prev;
          return { ...prev, [identity]: { ...t, hasVideo: true } };
        });
      };
      const rootEl = rootVideoRefs.current.get(identity);
      if (rootEl) {
        attachTo(rootEl);
        const tileEl = tileVideoRefs.current.get(identity);
        if (tileEl && tileEl !== rootEl) { track.attach(tileEl); void tileEl.play().catch(() => {}); }
      } else {
        requestAnimationFrame(() => {
          const el2 = rootVideoRefs.current.get(identity);
          if (el2) { attachTo(el2); return; }
          setTimeout(() => { const el3 = rootVideoRefs.current.get(identity); if (el3) attachTo(el3); }, 400);
        });
      }
    } else if (track.kind === Track.Kind.Audio) {
      const attach = (el: HTMLAudioElement) => {
        track.attach(el);
        void el.play().catch(() => {});
        setStudentTiles((prev) => {
          const t = prev[identity]; if (!t) return prev;
          return { ...prev, [identity]: { ...t, hasAudio: true } };
        });
      };
      const el = rootAudioRefs.current.get(identity);
      if (el) { attach(el); }
      else {
        requestAnimationFrame(() => {
          const el2 = rootAudioRefs.current.get(identity);
          if (el2) { attach(el2); return; }
          setTimeout(() => { const el3 = rootAudioRefs.current.get(identity); if (el3) attach(el3); }, 300);
        });
      }
    }
  }, []);

  const broadcastPresentation = useCallback((ps: PresState) => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    const payload = JSON.stringify({ type: "PRESENTATION_STATE", ...ps });
    room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true }).catch(() => {});
  }, []);

  const persistPresentation = useCallback(async (ps: PresState) => {
    try {
      await fetch("/api/admin/learning", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type:"class", id:classId, title:classTitle, activeMaterialId:ps.materialId, presentationPage:ps.page }) });
    } catch { /* non-critical */ }
  }, [classId, classTitle]);

  const selectMaterial = useCallback((materialId: string) => {
    const ps: PresState = { materialId, page: 1 };
    setPresState(ps); broadcastPresentation(ps); void persistPresentation(ps);
  }, [broadcastPresentation, persistPresentation]);

  const changePage = useCallback((delta: number) => {
    setPresState((prev) => {
      const next = { ...prev, page: Math.max(1, prev.page + delta) };
      broadcastPresentation(next); void persistPresentation(next);
      return next;
    });
  }, [broadcastPresentation, persistPresentation]);

  const ensureTile = useCallback((rp: RemoteParticipant) => {
    setStudentTiles((prev) => {
      if (prev[rp.identity]) return prev;
      return { ...prev, [rp.identity]: { identity:rp.identity, name:rp.name || rp.identity.replace(/^student-/,""), hasVideo:false, hasAudio:false } };
    });
  }, []);

  /* ── LiveKit — unchanged ──────────────────────────────────────────────── */
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
        if (d.type === "RAISE_HAND" && d.identity) setRaisedHands((prev) => ({ ...prev, [d.identity]: d.name || d.identity }));
        else if (d.type === "LOWER_HAND" && d.identity) setRaisedHands((prev) => { const n = { ...prev }; delete n[d.identity]; return n; });
      };
    } catch { /* BroadcastChannel unsupported */ }

    async function start() {
      let livekitUrl: string, token: string;
      try {
        const res  = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`);
        const data = await res.json();
        if (!res.ok || !data.url || !data.token) throw new Error(data.error || "LiveKit not configured");
        livekitUrl = (data.url as string).startsWith("https://") ? (data.url as string).replace("https://","wss://") : (data.url as string).replace("http://","ws://");
        token = data.token as string;
      } catch (err) {
        if (activeRef.current) { setErrorMsg(err instanceof Error ? err.message : "Could not get token"); setConnectionStatus("error"); }
        return;
      }
      if (!activeRef.current) return;

      const room = new Room({ adaptiveStream:false, dynacast:true, disconnectOnPageLeave:false });
      roomRef.current = room;

      room.on(RoomEvent.Connected,    () => { if (activeRef.current) { setConnectionStatus("live"); setErrorMsg(""); } });
      room.on(RoomEvent.Disconnected, (reason) => { if (activeRef.current) { setConnectionStatus("error"); setErrorMsg(`Disconnected: ${reason ?? "unknown reason"}`); } });
      room.on(RoomEvent.Reconnecting, () => {});
      room.on(RoomEvent.Reconnected, () => {
        if (!activeRef.current) return;
        setConnectionStatus("live");
        setTimeout(() => {
          for (const [identity, rp] of Array.from(room.remoteParticipants.entries())) {
            if (identity.startsWith("instructor-")) continue;
            for (const pub of Array.from(rp.trackPublications.values())) {
              if (pub.isSubscribed && pub.track) attachTrack(pub.track as RemoteTrack, identity);
            }
          }
        }, 500);
      });
      room.on(RoomEvent.ParticipantConnected, (rp: RemoteParticipant) => {
        if (!activeRef.current || rp.identity.startsWith("instructor-")) return;
        setStudentTiles((prev) => ({ ...prev, [rp.identity]: { identity:rp.identity, name:rp.name || rp.identity.replace(/^student-/,""), hasVideo:false, hasAudio:false } }));
        const ps = presStateRef.current;
        setTimeout(() => {
          if (!roomRef.current || roomRef.current.state !== "connected") return;
          roomRef.current.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type:"PRESENTATION_STATE", ...ps })), { reliable:true }).catch(() => {});
        }, 800);
      });
      room.on(RoomEvent.ParticipantDisconnected, (rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setStudentTiles((prev) => { const n = { ...prev }; delete n[rp.identity]; return n; });
        tileVideoRefs.current.delete(rp.identity); tileAudioRefs.current.delete(rp.identity);
        rootAudioRefs.current.delete(rp.identity); rootVideoRefs.current.delete(rp.identity);
      });
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, rp: RemoteParticipant) => {
        if (!activeRef.current || rp.identity.startsWith("instructor-")) return;
        ensureTile(rp);
        requestAnimationFrame(() => { if (activeRef.current) attachTrack(track, rp.identity); });
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        track.detach();
        if (track.kind === Track.Kind.Video) setStudentTiles((prev) => { const t = prev[rp.identity]; if (!t) return prev; return { ...prev, [rp.identity]: { ...t, hasVideo:false } }; });
        else if (track.kind === Track.Kind.Audio) setStudentTiles((prev) => { const t = prev[rp.identity]; if (!t) return prev; return { ...prev, [rp.identity]: { ...t, hasAudio:false } }; });
      });

      try { await room.connect(livekitUrl, token); }
      catch (err) {
        if (activeRef.current) { setErrorMsg(`LiveKit error: ${err instanceof Error ? err.message : "Connection failed"}`); setConnectionStatus("error"); }
        return;
      }
      if (!activeRef.current) { void room.disconnect(); return; }

      try {
        const tracks = await createLocalTracks({ audio:true, video:{ resolution:getResolution(quality) } });
        const videoTrack = tracks.find((t) => t.kind === Track.Kind.Video) ?? null;
        const audioTrack = tracks.find((t) => t.kind === Track.Kind.Audio) ?? null;
        videoTrackRef.current = videoTrack; audioTrackRef.current = audioTrack;
        if (activeRef.current && audioTrack) setMicTrackForMeter(audioTrack);
        if (videoTrack) {
          if (localVideoRef.current) { videoTrack.attach(localVideoRef.current); void localVideoRef.current.play().catch(() => {}); }
          else pendingVideoTrack.current = videoTrack;
        }
        for (const track of tracks) {
          if (track.kind === Track.Kind.Video) await room.localParticipant.publishTrack(track, { simulcast:true });
          else await room.localParticipant.publishTrack(track);
        }
        const canvas = document.createElement("canvas");
        const ctx2d  = canvas.getContext("2d");
        fallbackInterval = setInterval(() => {
          const vid = localVideoRef.current;
          if (vid && bcRef.current) {
            canvas.width = 640; canvas.height = 360;
            ctx2d?.drawImage(vid, 0, 0, 640, 360);
            const frame = canvas.toDataURL("image/jpeg", 0.5);
            if (frame.length > 100) bcRef.current.postMessage({ type:"FRAME", frame });
          }
        }, 150);
      } catch (camErr) {
        if (activeRef.current) setErrorMsg("Camera/mic unavailable — audio-only mode");
      }

      void fetch("/api/admin/learning", { method:"PATCH", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ type:"class", id:classId, title:classTitle, status:"LIVE" }) }).catch(() => {});

      if (activeRef.current) {
        const tiles: Record<string, StudentTile> = {};
        for (const [identity, rp] of Array.from(room.remoteParticipants.entries())) {
          if (identity.startsWith("instructor-")) continue;
          tiles[identity] = { identity, name:rp.name || identity.replace(/^student-/,""), hasVideo:false, hasAudio:false };
        }
        if (Object.keys(tiles).length > 0) {
          setStudentTiles(tiles);
          requestAnimationFrame(() => {
            for (const [identity, rp] of Array.from(room.remoteParticipants.entries())) {
              if (identity.startsWith("instructor-")) continue;
              for (const pub of Array.from(rp.trackPublications.values())) {
                if (pub.isSubscribed && pub.track) attachTrack(pub.track as RemoteTrack, identity);
              }
            }
          });
        }
      }
    }

    void start();
    return () => {
      activeRef.current = false;
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (bc) { bc.postMessage({ type:"STOP" }); bc.close(); }
      videoTrackRef.current?.stop(); audioTrackRef.current?.stop();
      roomRef.current?.disconnect().catch(() => {}); roomRef.current = null;
    };
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const vt = videoTrackRef.current;
    if (!vt || !roomRef.current) return;
    const r = vt as { restartTrack?: (c: unknown) => Promise<void> };
    if (typeof r.restartTrack === "function") void r.restartTrack({ resolution: getResolution(quality) }).catch(() => {});
  }, [quality]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCamera = () => {
    const vt = videoTrackRef.current; if (!vt) return;
    if (cameraOn) { void vt.mute(); setCameraOn(false); } else { void vt.unmute(); setCameraOn(true); }
  };
  const toggleMic = () => {
    const at = audioTrackRef.current; if (!at) return;
    if (micOn) { void at.mute(); setMicOn(false); } else { void at.unmute(); setMicOn(true); }
  };

  const endBroadcast = async () => {
    try { await fetch("/api/admin/learning", { method:"PATCH", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ type:"class", id:classId, title:classTitle, status:"COMPLETED" }) }); } catch { /* non-critical */ }
    onClose();
  };

  /* ── always-on hidden media elements ─────────────────────────────────── */
  const HiddenMedia = () => (
    <>
      {Object.values(studentTiles).map((tile) => (
        <div key={`root-${tile.identity}`} style={{ position:"absolute", width:0, height:0, overflow:"hidden", pointerEvents:"none" }}>
          <video ref={(el) => { if (el) rootVideoRefs.current.set(tile.identity, el); else rootVideoRefs.current.delete(tile.identity); }} autoPlay playsInline muted style={{ width:1, height:1 }}/>
          <audio ref={(el) => { if (el) rootAudioRefs.current.set(tile.identity, el); else rootAudioRefs.current.delete(tile.identity); }} autoPlay style={{ width:1, height:1 }}/>
        </div>
      ))}
    </>
  );

  /* ── shared tab content ───────────────────────────────────────────────── */
  function TabContent({ tab }: { tab: "presentation"|"students"|"chat" }) {
    /* Presentation */
    if (tab === "presentation") return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        {/* material picker */}
        <div style={{ padding:"0.65rem 0.6rem", borderBottom:`1px solid ${RIM}`, overflowY:"auto", maxHeight:isMobile?140:180 }}>
          <p style={{ fontSize:"0.72rem", color:GOLDB, fontWeight:700, letterSpacing:"0.04em", margin:"0 0 0.4rem" }}>Materials — tap to present:</p>
          {materials.length === 0
            ? <p style={{ fontSize:"0.78rem", color:MUTED, fontStyle:"italic" }}>No materials uploaded yet.</p>
            : materials.map((m) => {
                const active = m.id === presState.materialId;
                return (
                  <button key={m.id} type="button" onClick={() => selectMaterial(m.id)} style={{ textAlign:"left", width:"100%", background:active?"#2a1210":DARK, border:`1px solid ${active?GOLDB:RIM}`, borderRadius:5, padding:"0.5rem 0.6rem", cursor:"pointer", color:"#f3eee7", display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.8rem", marginBottom:"0.3rem", boxShadow:active?`0 0 6px rgba(152,102,27,0.3)`:"none" }}>
                    <span>{m.mimeType === "application/pdf" ? "📄" : m.mimeType?.startsWith("image/") ? "🖼️" : "📁"}</span>
                    <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.title}</span>
                    <span style={{ color:MUTED, fontSize:"0.68rem", whiteSpace:"nowrap" }}>{Math.ceil((m.sizeBytes??0)/1024)} KB</span>
                    {active && <span style={{ background:GOLDB, color:WHITE, fontSize:"0.62rem", fontWeight:700, padding:"0.1rem 0.3rem", borderRadius:3, whiteSpace:"nowrap" }}>▶ Live</span>}
                  </button>
                );
              })
          }
        </div>
        {/* slide toolbar */}
        <div style={{ background:"#261312", borderBottom:`1px solid ${RIM}`, padding:"0.5rem 0.85rem", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.75rem", flexShrink:0 }}>
          <span style={{ color:WHITE, fontSize:"0.88rem", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{selectedMaterial?.title ?? "No material selected"}</span>
          <div style={{ display:"flex", gap:"0.4rem", alignItems:"center", flexShrink:0 }}>
            <button type="button" onClick={() => changePage(-1)} disabled={presState.page <= 1} style={{ background:"#2b1615", color:GOLD, border:`1px solid #4a2725`, borderRadius:4, padding:"0.25rem 0.55rem", fontSize:"0.78rem", cursor:"pointer", fontWeight:600 }}>◄ Prev</button>
            <span style={{ color:"#d4b684", fontSize:"0.8rem", padding:"0 0.3rem" }}>Page {presState.page}</span>
            <button type="button" onClick={() => changePage(1)} style={{ background:"#2b1615", color:GOLD, border:`1px solid #4a2725`, borderRadius:4, padding:"0.25rem 0.55rem", fontSize:"0.78rem", cursor:"pointer", fontWeight:600 }}>Next ►</button>
          </div>
        </div>
        {/* iframe */}
        <div style={{ flex:1, background:"#0c0605", overflow:"auto", display:"flex", alignItems:"center", justifyContent:"center", minHeight:0 }}>
          {selectedMaterial && previewable ? (
            <iframe key={`${selectedMaterial.id}-p${presState.page}`} title={selectedMaterial.title} src={`/api/admin/learning/materials/preview?id=${selectedMaterial.id}&page=${presState.page}`} style={{ width:"100%", height:"100%", minHeight:"40vh", border:0, background:WHITE }}/>
          ) : selectedMaterial ? (
            <div style={{ textAlign:"center", color:MUTED, padding:"2rem", display:"flex", flexDirection:"column", alignItems:"center", gap:"0.5rem" }}>
              <span style={{ fontSize:"2.5rem" }}>📁</span>
              <p style={{ color:WHITE, margin:"0.5rem 0" }}>{selectedMaterial.title}</p>
              <p style={{ color:MUTED, fontSize:"0.85rem" }}>This format cannot be previewed inline.</p>
              <a href={`/api/admin/learning/materials/preview?id=${selectedMaterial.id}`} style={{ display:"inline-block", background:GOLDB, color:WHITE, textDecoration:"none", padding:"0.45rem 0.9rem", borderRadius:4, fontSize:"0.82rem", fontWeight:600, marginTop:"0.5rem" }} download>↓ Download</a>
            </div>
          ) : (
            <div style={{ textAlign:"center", color:MUTED, padding:"2rem" }}>
              <span style={{ fontSize:"2.5rem" }}>📊</span>
              <p style={{ color:MUTED }}>Select a material above to begin presenting</p>
            </div>
          )}
        </div>
      </div>
    );

    /* Students */
    if (tab === "students") return (
      <div style={{ flex:1, overflow:"auto", padding:"0.85rem" }}>
        {Object.keys(raisedHands).length > 0 && (
          <div style={{ background:"#3d1f05", border:`1px solid ${GOLDB}`, borderRadius:6, padding:"0.5rem 0.75rem", marginBottom:"0.75rem" }}>
            <strong style={{ color:"#ffd98a" }}>✋ {Object.values(raisedHands).join(", ")} raised their hand</strong>
          </div>
        )}
        {studentCount === 0 ? (
          <div style={{ textAlign:"center", color:MUTED, padding:"2rem 1rem", display:"flex", flexDirection:"column", alignItems:"center", gap:"0.5rem" }}>
            <span style={{ fontSize:"2rem" }}>👥</span>
            <p>Waiting for students to join…</p>
            <p style={{ fontSize:"0.78rem", color:MUTED }}>Students join at /learning/class/{classId}</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:"0.75rem" }}>
            {Object.values(studentTiles).map((tile) => (
              <StudentVideoTile key={tile.identity} tile={tile} rootVideoRefs={rootVideoRefs}
                onVideoRef={(el) => { if (el) tileVideoRefs.current.set(tile.identity, el); else tileVideoRefs.current.delete(tile.identity); }}
                onAudioRef={(el)  => { if (el) tileAudioRefs.current.set(tile.identity, el);  else tileAudioRefs.current.delete(tile.identity); }}
              />
            ))}
          </div>
        )}
      </div>
    );

    /* Chat */
    return (
      <div style={{ flex:1, overflow:"auto", padding:"0.85rem" }}>
        <ClassroomChat classId={classId} room={roomRef.current} isInstructor userId="instructor-admin" userName="Instructor (Host)"/>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /* MOBILE LAYOUT                                                            */
  /* ════════════════════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div style={{ position:"fixed", inset:0, background:DARK, color:WHITE, fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif", display:"flex", flexDirection:"column", zIndex:9999, overflow:"hidden" }}>
        <HiddenMedia/>

        {/* ── mobile top bar ─────────────────────────────────────────── */}
        <div style={{ background:WINE, borderBottom:`1px solid #4a1919`, padding:"0.6rem 0.85rem", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.5rem", flexShrink:0 }}>
          <div>
            <span style={{ color:connectionStatus==="live"?GREEN:connectionStatus==="connecting"?GOLD:RED, fontSize:"0.7rem", fontWeight:700, letterSpacing:"0.05em", display:"block" }}>
              {connectionStatus==="live" ? "● LIVE STUDIO" : connectionStatus==="connecting" ? "◌ CONNECTING…" : "✕ DISCONNECTED"}
            </span>
            <h3 style={{ margin:"0.1rem 0 0", fontSize:"0.9rem", color:WHITE, fontWeight:700, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{classTitle}</h3>
          </div>
          <div style={{ display:"flex", gap:"0.4rem", alignItems:"center" }}>
            <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)}
              style={{ background:DARK2, color:GOLD, border:`1px solid ${GOLDB}`, borderRadius:4, padding:"0.28rem 0.45rem", fontSize:"0.75rem", cursor:"pointer" }}>
              <option value="4k">4K</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>
            <button type="button" onClick={endBroadcast}
              style={{ background:"#4d1010", border:`1px solid ${RED}`, color:WHITE, borderRadius:6, padding:"0.3rem 0.65rem", fontSize:"0.75rem", fontWeight:700, cursor:"pointer" }}>
              End
            </button>
            <button type="button" onClick={onClose}
              style={{ background:"transparent", border:`1px solid #4a2725`, color:MUTED, borderRadius:6, padding:"0.3rem 0.5rem", fontSize:"0.85rem", cursor:"pointer" }}>✕</button>
          </div>
        </div>

        {errorMsg && <p style={{ color:"#ff9a8a", background:"#2a0808", padding:"0.4rem 1rem", margin:0, fontSize:"0.8rem", borderBottom:`1px solid #5a1c18`, flexShrink:0 }}>{errorMsg}</p>}

        {/* ── self preview (prominent on mobile) ─────────────────────── */}
        <div style={{ padding:"0.6rem", display:"flex", gap:"0.6rem", alignItems:"stretch", flexShrink:0, borderBottom:`1px solid ${RIM}` }}>
          {/* camera preview */}
          <div style={{ flex:1, position:"relative", background:"#100707", border:`1px solid ${RIM}`, borderRadius:10, aspectRatio:"16/9", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", minWidth:0 }}>
            <video ref={selfVideoCallbackRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            {!cameraOn && (
              <div style={{ position:"absolute", inset:0, background:"#120a09", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <p style={{ margin:0, color:MUTED, fontSize:"0.82rem" }}>Camera OFF</p>
              </div>
            )}
            <span style={{ position:"absolute", top:"0.35rem", left:"0.35rem", background:"rgba(0,0,0,0.7)", color:connectionStatus==="live"?GREEN:GOLD, fontSize:"0.6rem", fontWeight:700, padding:"0.1rem 0.3rem", borderRadius:3 }}>
              {connectionStatus==="live" ? "● LIVE" : connectionStatus==="connecting" ? "◌ CONNECTING" : "✕ OFFLINE"}
            </span>
            <span style={{ position:"absolute", bottom:"0.35rem", left:"0.4rem", color:WHITE, fontSize:"0.62rem", fontWeight:600 }}>You (Instructor)</span>
          </div>
          {/* right: meter + stats */}
          <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem", justifyContent:"center", flexShrink:0, width:100 }}>
            <AudioLevelMeter track={micTrackForMeter}/>
            <div style={{ background:DARK2, border:`1px solid ${RIM}`, borderRadius:6, padding:"0.45rem", textAlign:"center" }}>
              <span style={{ fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.05em", color:GOLDB, display:"block" }}>STUDENTS</span>
              <span style={{ fontSize:"1.6rem", fontWeight:700, color:GOLD, lineHeight:1 }}>{studentCount}</span>
            </div>
          </div>
        </div>

        {/* ── mobile quick controls ───────────────────────────────────── */}
        <div style={{ display:"flex", gap:"0.3rem", padding:"0.5rem 0.65rem", borderBottom:`1px solid ${RIM}`, flexShrink:0, overflowX:"auto" }}>
          <button type="button" onClick={toggleCamera} style={{ flex:1, background:cameraOn?"#331614":DARK2, border:`1px solid ${cameraOn?GOLDB:RIM}`, borderRadius:8, padding:"0.5rem 0.4rem", fontSize:"0.72rem", fontWeight:600, cursor:"pointer", color:cameraOn?GOLD:MUTED, WebkitTapHighlightColor:"transparent" }}>
            {cameraOn ? "📷 ON" : "📷 OFF"}
          </button>
          <button type="button" onClick={toggleMic} style={{ flex:1, background:micOn?"#331614":DARK2, border:`1px solid ${micOn?GOLDB:RIM}`, borderRadius:8, padding:"0.5rem 0.4rem", fontSize:"0.72rem", fontWeight:600, cursor:"pointer", color:micOn?GOLD:MUTED, WebkitTapHighlightColor:"transparent" }}>
            {micOn ? "🎤 ON" : "🎤 OFF"}
          </button>
          <button type="button" onClick={() => setShowPollModal(true)} style={{ flex:1, background:GOLDB, border:"none", borderRadius:8, padding:"0.5rem 0.4rem", fontSize:"0.72rem", fontWeight:700, cursor:"pointer", color:WHITE, WebkitTapHighlightColor:"transparent" }}>
            📊 Poll
          </button>
        </div>

        {/* ── tab strip ──────────────────────────────────────────────── */}
        <div style={{ display:"flex", background:DARK2, borderBottom:`1px solid ${RIM}`, flexShrink:0 }}>
          {(["presentation","students","chat"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setSheetTab(t)}
              style={{ flex:1, background:"transparent", border:"none", borderBottom:sheetTab===t?`2px solid ${GOLDB}`:"2px solid transparent", color:sheetTab===t?GOLD:MUTED, padding:"0.6rem 0.3rem", fontSize:"0.72rem", fontWeight:600, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
              {t === "presentation" && "📊 Slides"}
              {t === "students"     && `👥 Students (${studentCount})`}
              {t === "chat"         && "💬 Chat"}
            </button>
          ))}
        </div>

        {/* ── tab body ───────────────────────────────────────────────── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
          <TabContent tab={sheetTab}/>
        </div>

        {/* Poll modal */}
        {showPollModal && <PollModal/>}

        <style>{`@keyframes nakSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /* DESKTOP LAYOUT                                                           */
  /* ════════════════════════════════════════════════════════════════════════ */
  function PollModal() {
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
        <div style={{ background:"#220c0c", border:`1px solid ${GOLDB}`, borderRadius:10, padding:"1.25rem", width:400, maxWidth:"100%", color:WHITE }}>
          <h4 style={{ margin:"0 0 0.5rem", color:GOLD }}>Launch Live Poll</h4>
          <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Ask students a question…"
            style={{ width:"100%", background:"#120505", border:"1px solid #4d1c1c", borderRadius:6, padding:"0.55rem 0.75rem", color:WHITE, fontSize:"0.85rem", boxSizing:"border-box", marginBottom:"0.5rem" }}/>
          <label style={{ fontSize:"0.75rem", color:GOLD, display:"block", margin:"0.5rem 0 0.2rem" }}>Options (comma-separated):</label>
          <input type="text" value={pollOptionsStr} onChange={(e) => setPollOptionsStr(e.target.value)} placeholder="Yes, No, Partially"
            style={{ width:"100%", background:"#120505", border:"1px solid #4d1c1c", borderRadius:6, padding:"0.55rem 0.75rem", color:WHITE, fontSize:"0.85rem", boxSizing:"border-box" }}/>
          <div style={{ display:"flex", gap:"0.5rem", marginTop:"1rem", justifyContent:"flex-end" }}>
            <button type="button" onClick={() => setShowPollModal(false)} style={{ background:"#331010", color:"#ff9999", border:"none", borderRadius:6, padding:"0.4rem 0.8rem", fontSize:"0.82rem", cursor:"pointer" }}>Cancel</button>
            <button type="button" onClick={async () => {
              const options = pollOptionsStr.split(",").map((s) => s.trim()).filter(Boolean);
              if (!pollQuestion.trim() || options.length < 2) return;
              try {
                const res = await fetch("/api/learning/polls", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ action:"CREATE_POLL", classId, question:pollQuestion.trim(), options }) });
                const d = await res.json();
                if (d.poll && bcRef.current) bcRef.current.postMessage({ type:"LIVE_POLL", poll:d.poll });
              } catch { /* poll error */ }
              setShowPollModal(false); setPollQuestion("");
            }} style={{ background:`linear-gradient(135deg,${GOLDB},#d4af37)`, color:"#1a0808", border:"none", borderRadius:6, padding:"0.4rem 0.9rem", fontSize:"0.82rem", fontWeight:800, cursor:"pointer" }}>
              Broadcast Poll
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(4px)", zIndex:9999, display:"flex", alignItems:"stretch", justifyContent:"center", padding:"0.5rem", overflowY:"auto" }}>
      <div style={{ background:DARK, border:`1px solid ${GOLDB}`, borderRadius:10, width:"100%", maxWidth:1400, display:"flex", flexDirection:"column", overflow:"hidden", maxHeight:"98vh" }}>
        <HiddenMedia/>

        {/* header */}
        <div style={{ background:WINE, borderBottom:`1px solid #4a1919`, padding:"0.75rem 1.2rem", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
          <div>
            <span style={{ color:connectionStatus==="live"?GREEN:connectionStatus==="connecting"?GOLD:RED, fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.05em", display:"block" }}>
              {connectionStatus==="live" ? "● LIVE STUDIO" : connectionStatus==="connecting" ? "◌ CONNECTING…" : "✕ DISCONNECTED"}
            </span>
            <h3 style={{ margin:"0.15rem 0 0", fontSize:"1.1rem", color:WHITE }}>{classTitle}</h3>
          </div>
          <div style={{ display:"flex", gap:"0.6rem", alignItems:"center", flexWrap:"wrap" }}>
            <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)}
              style={{ background:DARK2, color:GOLD, border:`1px solid ${GOLDB}`, borderRadius:4, padding:"0.3rem 0.5rem", fontSize:"0.8rem", cursor:"pointer" }}>
              <option value="4k">4K</option><option value="1080p">1080p</option><option value="720p">720p</option><option value="480p">480p</option>
            </select>
            <button type="button" onClick={endBroadcast}
              style={{ background:"#4d1010", border:`1px solid ${RED}`, color:WHITE, borderRadius:4, padding:"0.35rem 0.75rem", fontSize:"0.8rem", fontWeight:600, cursor:"pointer" }}>
              End Broadcast
            </button>
            <button type="button" onClick={onClose}
              style={{ background:"transparent", border:"1px solid #4a2725", color:MUTED, borderRadius:4, padding:"0.35rem 0.55rem", fontSize:"0.85rem", cursor:"pointer" }}>✕</button>
          </div>
        </div>

        {errorMsg && <p style={{ color:"#ff9a8a", background:"#2a0808", padding:"0.4rem 1rem", margin:0, fontSize:"0.82rem", borderBottom:"1px solid #5a1c18" }}>{errorMsg}</p>}

        {/* body */}
        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 280px", flex:1, overflow:"hidden" }}>
          {/* LEFT */}
          <div style={{ display:"flex", flexDirection:"column", borderRight:`1px solid ${RIM}`, overflow:"hidden" }}>
            <div style={{ display:"flex", background:DARK2, borderBottom:`1px solid ${RIM}`, flexShrink:0 }}>
              {(["presentation","students","chat"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setActiveTab(t)} style={{ flex:1, background:"transparent", border:"none", borderBottom:activeTab===t?`2px solid ${GOLDB}`:"2px solid transparent", color:activeTab===t?GOLD:MUTED, padding:"0.6rem 0.5rem", fontSize:"0.8rem", fontWeight:600, cursor:"pointer" }}>
                  {t==="presentation" && "📊 Presentation"}
                  {t==="students"     && `👥 Students (${studentCount})`}
                  {t==="chat"         && "💬 Chat"}
                </button>
              ))}
            </div>
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <TabContent tab={activeTab}/>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", padding:"0.85rem", background:DARK3, overflow:"auto" }}>
            {/* self preview */}
            <div style={{ display:"flex", flexDirection:"column", gap:"0.3rem" }}>
              <div style={{ position:"relative", background:"#100707", border:`1px solid ${RIM}`, borderRadius:6, aspectRatio:"16/9", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <video ref={selfVideoCallbackRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                {!cameraOn && (
                  <div style={{ position:"absolute", inset:0, background:"#120a09", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <p style={{ margin:0, color:MUTED, fontSize:"0.85rem" }}>Camera OFF</p>
                  </div>
                )}
                <span style={{ position:"absolute", top:"0.35rem", left:"0.35rem", background:"rgba(0,0,0,0.7)", color:connectionStatus==="live"?GREEN:GOLD, fontSize:"0.6rem", fontWeight:700, padding:"0.1rem 0.3rem", borderRadius:3 }}>
                  {connectionStatus==="live" ? "● LIVE" : connectionStatus==="connecting" ? "◌ CONNECTING" : "✕ OFFLINE"}
                </span>
              </div>
              <p style={{ fontSize:"0.72rem", color:"#d4b684", textAlign:"center", margin:0 }}>You (Instructor)</p>
            </div>

            <AudioLevelMeter track={micTrackForMeter}/>

            <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
              <button type="button" onClick={toggleCamera} style={{ width:"100%", padding:"0.55rem", borderRadius:6, fontSize:"0.82rem", fontWeight:600, cursor:"pointer", border:"1px solid transparent", background:cameraOn?"#331614":DARK2, borderColor:cameraOn?GOLDB:RIM, color:cameraOn?GOLD:MUTED }}>
                {cameraOn ? "📷 Camera ON" : "📷 Camera OFF"}
              </button>
              <button type="button" onClick={toggleMic} style={{ width:"100%", padding:"0.55rem", borderRadius:6, fontSize:"0.82rem", fontWeight:600, cursor:"pointer", border:"1px solid transparent", background:micOn?"#331614":DARK2, borderColor:micOn?GOLDB:RIM, color:micOn?GOLD:MUTED }}>
                {micOn ? "🎤 Mic ON" : "🎤 Mic Muted"}
              </button>
              <button type="button" onClick={() => setShowPollModal(true)} style={{ width:"100%", padding:"0.55rem", borderRadius:6, fontSize:"0.82rem", fontWeight:600, cursor:"pointer", background:GOLDB, color:WHITE, border:`1px solid #b57d26` }}>
                📊 Launch Poll
              </button>
            </div>

            <div style={{ background:DARK2, border:`1px solid ${RIM}`, borderRadius:6, padding:"0.65rem", textAlign:"center", display:"flex", flexDirection:"column", gap:"0.2rem" }}>
              <span style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.05em", color:GOLDB }}>CONNECTED</span>
              <span style={{ fontSize:"2rem", fontWeight:700, color:GOLD, lineHeight:1 }}>{studentCount}</span>
              <span style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.05em", color:GOLDB }}>students</span>
            </div>
          </div>
        </div>
      </div>

      {showPollModal && <PollModal/>}
    </div>
  );
}
