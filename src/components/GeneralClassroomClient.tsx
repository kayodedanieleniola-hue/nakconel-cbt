"use client";

/**
 * GeneralClassroomClient — NAKCONEL Learning Center
 * Dark wine + crisp gold palette. Real SVG icons, no emojis in controls.
 * Share button removed. Mic green when live, red when muted.
 * All LiveKit logic unchanged.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Room, RoomEvent, Track,
  RemoteParticipant, RemoteTrackPublication,
  createLocalTracks, type LocalTrack,
} from "livekit-client";

/* ─── Colour tokens ──────────────────────────────────────────────────────── */
const BG        = "#110505";
const SURFACE   = "#1c0808";
const CARD      = "#250d0d";
const RIM       = "#341414";
const WINE      = "#6b1f1f";
const GOLD      = "#e8b84b";
const GOLD_DIM  = "#c49a2e";
const GOLD_GLOW = "rgba(232,184,75,0.20)";
const WHITE     = "#ffffff";
const OFF_WHITE = "#f8f5f2";
const PANEL_BDR = "#e5e0db";
const PANEL_TXT = "#5c4a40";
const MUTED_TXT = "#9a8070";
const INK       = "#180808";
const RED       = "#e53535";
const MIC_ON    = "#22c55e";   // green — mic is live
const MIC_OFF   = "#e53535";   // red   — mic muted

/* ─── SVG icons — all real glyphs, no emoji ─────────────────────────────── */
const Mic = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>
);
const MicOff = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22"/>
    <path d="M18.89 13.23A7 7 0 0 0 19 12"/>
    <path d="M5 10a7 7 0 0 0 11.64 5.23"/>
    <path d="M15 9.34V6a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>
);
const Cam = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7 16 12 23 17z"/>
    <rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
);
const CamOff = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
);
const People = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const Chat = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const More = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
);
const PhoneOff = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/>
    <path d="M14.5 2.23a19.79 19.79 0 0 0-8.63-3.07A2 2 0 0 0 3.69 1.15"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
);
const Bell = ({ s=18, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const Search = ({ s=15, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const Send = ({ s=15, c="currentColor" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

/* ─── NAKCONEL logo ──────────────────────────────────────────────────────── */
function NakLogo({ light = false }: { light?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: `linear-gradient(135deg, ${GOLD} 0%, #f6de88 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 2px 12px ${GOLD_GLOW}`,
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 14V4l5 7V4" stroke={WINE} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="15" y1="4" x2="15" y2="14" stroke={WINE} strokeWidth="2.3" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ color: light ? WHITE : INK, fontWeight: 900, fontSize: "0.9rem", letterSpacing: "0.04em" }}>
          NAKCONEL
        </div>
        <div style={{ color: light ? "rgba(255,255,255,0.45)" : MUTED_TXT, fontSize: "0.52rem", letterSpacing: "0.09em", textTransform: "uppercase" }}>
          Learning Center
        </div>
      </div>
    </div>
  );
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Meeting = { id: string; title: string; instructor: string | null; description: string | null; status: string };
type PTile   = { identity: string; name: string; videoPub: RemoteTrackPublication | null; audioPub: RemoteTrackPublication | null };

/* ─── Remote video tile ──────────────────────────────────────────────────── */
function RemoteTile({ tile, large = false }: { tile: PTile; large?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isHost   = tile.identity.startsWith("instructor-");
  const micLive  = !!tile.audioPub?.track;

  useEffect(() => {
    const vp = tile.videoPub;
    if (!vp?.track || !videoRef.current) return;
    vp.track.attach(videoRef.current);
    void videoRef.current.play().catch(() => {});
    return () => { if (videoRef.current) vp.track?.detach(videoRef.current); };
  }, [tile.videoPub]);

  useEffect(() => {
    const ap = tile.audioPub;
    if (!ap?.track || !audioRef.current) return;
    ap.track.attach(audioRef.current);
    void audioRef.current.play().catch(() => {});
    return () => { if (audioRef.current) ap.track?.detach(audioRef.current); };
  }, [tile.audioPub]);

  return (
    <div style={{
      position: "relative", borderRadius: large ? 14 : 10, overflow: "hidden",
      background: `linear-gradient(160deg, ${RIM} 0%, ${CARD} 100%)`,
      border: isHost ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.07)",
      aspectRatio: large ? "4/3" : "16/9", width: "100%",
      boxShadow: isHost ? `0 0 28px ${GOLD_GLOW}, 0 6px 24px rgba(0,0,0,0.55)` : "0 4px 16px rgba(0,0,0,0.45)",
    }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: tile.videoPub?.track ? "block" : "none" }} />
      {!tile.videoPub?.track && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: large ? 72 : 48, height: large ? 72 : 48, borderRadius: "50%",
            background: isHost ? `linear-gradient(135deg, ${GOLD}, #f6de88)` : `linear-gradient(135deg, ${WINE}, ${RIM})`,
            color: isHost ? INK : WHITE,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: large ? "1.8rem" : "1.2rem", fontWeight: 800,
            boxShadow: isHost ? `0 0 20px ${GOLD_GLOW}` : "none",
          }}>
            {tile.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <audio ref={audioRef} autoPlay style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }} />

      {/* Speaking pill */}
      {isHost && (
        <div style={{
          position: "absolute", top: "0.55rem", left: "0.55rem",
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99,
          padding: "0.18rem 0.5rem",
          display: "flex", alignItems: "center", gap: "0.3rem",
          color: WHITE, fontSize: "0.65rem", fontWeight: 600,
        }}>
          <Mic s={10} c={MIC_ON}/> Speaking
        </div>
      )}

      {/* Bottom name bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)",
        padding: large ? "2rem 0.8rem 0.65rem" : "1.3rem 0.55rem 0.45rem",
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      }}>
        <div>
          <div style={{ color: WHITE, fontSize: large ? "0.88rem" : "0.75rem", fontWeight: 700, lineHeight: 1.2 }}>{tile.name}</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.6rem" }}>{isHost ? "Host" : "Participant"}</div>
        </div>
        <div style={{
          width: large ? 30 : 24, height: large ? 30 : 24, borderRadius: "50%",
          background: micLive ? "rgba(34,197,94,0.22)" : "rgba(229,53,53,0.70)",
          border: micLive ? `1px solid ${MIC_ON}` : `1px solid ${MIC_OFF}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {micLive ? <Mic s={large ? 14 : 11} c={MIC_ON}/> : <MicOff s={large ? 14 : 11} c={WHITE}/>}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function GeneralClassroomClient({ meeting, studentName }: { meeting: Meeting; studentName: string }) {
  const roomRef      = useRef<Room | null>(null);
  const activeRef    = useRef(true);
  const selfVidRef   = useRef<HTMLVideoElement | null>(null);
  const pendingTrack = useRef<LocalTrack | null>(null);

  const [connStatus,   setConnStatus]   = useState<"connecting"|"live"|"error">("connecting");
  const [cameraReady,  setCameraReady]  = useState(false);
  const [cameraError,  setCameraError]  = useState("");
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(true);
  const [activeTab,    setActiveTab]    = useState<"participants"|"chat"|"qa">("participants");
  const [participants, setParticipants] = useState<Record<string, PTile>>({});
  const [chatInput,    setChatInput]    = useState("");
  const [elapsed,      setElapsed]      = useState(0);
  const localVideoTrack = useRef<LocalTrack | null>(null);
  const localAudioTrack = useRef<LocalTrack | null>(null);

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;
  };

  const selfVideoRef = useCallback((el: HTMLVideoElement | null) => {
    selfVidRef.current = el;
    if (el && pendingTrack.current) {
      pendingTrack.current.attach(el);
      void el.play().catch(() => {});
      pendingTrack.current = null;
    }
  }, []);

  /* LiveKit — logic unchanged */
  useEffect(() => {
    activeRef.current = true;
    async function connect() {
      const camP = (async () => {
        try {
          const tracks = await createLocalTracks({ audio: true, video: { facingMode: "user" } });
          if (!activeRef.current) { tracks.forEach(t => t.stop()); return; }
          const vid = tracks.find(t => t.kind === Track.Kind.Video) ?? null;
          const aud = tracks.find(t => t.kind === Track.Kind.Audio) ?? null;
          localVideoTrack.current = vid; localAudioTrack.current = aud;
          if (vid) {
            if (selfVidRef.current) { vid.attach(selfVidRef.current); void selfVidRef.current.play().catch(() => {}); }
            else pendingTrack.current = vid;
          }
          if (activeRef.current) setCameraReady(true);
          return { vid, aud };
        } catch { if (activeRef.current) setCameraError("Camera access denied."); return { vid: null, aud: null }; }
      })();

      let url: string, token: string;
      try {
        const res = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(meeting.id)}`);
        const d   = await res.json();
        if (!res.ok || !d.url || !d.token) throw new Error(d.error ?? "Token unavailable");
        url   = (d.url as string).replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
        token = d.token as string;
      } catch { if (activeRef.current) setConnStatus("error"); return; }
      if (!activeRef.current) return;

      const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: false });
      roomRef.current = room;
      room.on(RoomEvent.Connected,    () => { if (activeRef.current) setConnStatus("live"); });
      room.on(RoomEvent.Disconnected, () => { if (activeRef.current) setConnStatus("error"); });
      room.on(RoomEvent.ParticipantConnected, (rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants(p => ({ ...p, [rp.identity]: { identity: rp.identity, name: rp.name || rp.identity, videoPub: null, audioPub: null } }));
      });
      room.on(RoomEvent.ParticipantDisconnected, (rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants(p => { const n = { ...p }; delete n[rp.identity]; return n; });
      });
      room.on(RoomEvent.TrackSubscribed, (track, pub, rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants(p => {
          const ex = p[rp.identity] ?? { identity: rp.identity, name: rp.name || rp.identity, videoPub: null, audioPub: null };
          if (track.kind === Track.Kind.Video) return { ...p, [rp.identity]: { ...ex, videoPub: pub } };
          if (track.kind === Track.Kind.Audio) return { ...p, [rp.identity]: { ...ex, audioPub: pub } };
          return p;
        });
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants(p => {
          const ex = p[rp.identity]; if (!ex) return p;
          if (track.kind === Track.Kind.Video) return { ...p, [rp.identity]: { ...ex, videoPub: null } };
          if (track.kind === Track.Kind.Audio) return { ...p, [rp.identity]: { ...ex, audioPub: null } };
          return p;
        });
      });

      try { await room.connect(url, token); }
      catch { if (activeRef.current) setConnStatus("error"); return; }
      if (!activeRef.current) { void room.disconnect(); return; }

      const tiles: Record<string, PTile> = {};
      for (const [id, rp] of Array.from(room.remoteParticipants.entries())) {
        let vp: RemoteTrackPublication | null = null, ap: RemoteTrackPublication | null = null;
        for (const pub of Array.from(rp.trackPublications.values())) {
          if (pub.kind === Track.Kind.Video && pub.isSubscribed && pub.track) vp = pub;
          if (pub.kind === Track.Kind.Audio && pub.isSubscribed && pub.track) ap = pub;
        }
        tiles[id] = { identity: id, name: rp.name || id, videoPub: vp, audioPub: ap };
      }
      if (Object.keys(tiles).length > 0) setParticipants(tiles);

      const cr = await camP;
      if (cr) for (const t of [cr.vid, cr.aud].filter(Boolean) as LocalTrack[]) await room.localParticipant.publishTrack(t).catch(() => {});
    }
    void connect();
    return () => {
      activeRef.current = false;
      localVideoTrack.current?.stop(); localAudioTrack.current?.stop();
      roomRef.current?.disconnect().catch(() => {}); roomRef.current = null;
    };
  }, [meeting.id]);

  const toggleMic = () => {
    const at = localAudioTrack.current; if (!at) return;
    if (micOn) { void at.mute(); setMicOn(false); } else { void at.unmute(); setMicOn(true); }
  };
  const toggleCam = () => {
    const vt = localVideoTrack.current; if (!vt) return;
    if (camOn) { void vt.mute(); setCamOn(false); } else { void vt.unmute(); setCamOn(true); }
  };

  const remoteList = Object.values(participants);
  const totalCount = remoteList.length + 1;
  const hostTile   = remoteList.find(t => t.identity.startsWith("instructor-"));
  const otherTiles = remoteList.filter(t => !t.identity.startsWith("instructor-"));

  const connColor = connStatus === "live" ? MIC_ON : connStatus === "error" ? RED : GOLD;

  /* ─── control button helper ─────────────────────────────────────────── */
  function CtrlBtn({ icon, label, onClick, active, danger, color }:
    { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean; danger?: boolean; color?: string }) {
    return (
      <button type="button" onClick={onClick} style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.22rem",
        background: danger ? RED : active ? "rgba(232,184,75,0.14)" : "rgba(255,255,255,0.05)",
        border: active ? `1px solid ${GOLD_DIM}` : danger ? "none" : "1px solid rgba(255,255,255,0.08)",
        color: color ?? (danger ? WHITE : active ? GOLD : "rgba(255,255,255,0.82)"),
        borderRadius: 10, padding: "0.5rem 0.85rem",
        cursor: "pointer", minWidth: 56,
        transition: "background 0.15s, border-color 0.15s",
      }}>
        {icon}
        <span style={{ fontSize: "0.59rem", fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap", marginTop: 1 }}>
          {label}
        </span>
      </button>
    );
  }

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100dvh", background: BG, color: WHITE, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <header style={{
        height: 58, padding: "0 1.5rem", flexShrink: 0,
        background: `linear-gradient(180deg, ${SURFACE} 0%, rgba(28,8,8,0.97) 100%)`,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
        backdropFilter: "blur(10px)",
      }}>
        {/* left */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <NakLogo light />
          <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: RIM, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <People s={16} c={GOLD} />
            </div>
            <div>
              <div style={{ color: WHITE, fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.2 }}>General Meeting</div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.62rem" }}>NAKCONEL Learning Center Community</div>
            </div>
          </div>
        </div>

        {/* center */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div style={{ background: RED, color: WHITE, fontWeight: 800, fontSize: "0.68rem", padding: "0.25rem 0.7rem", borderRadius: 99, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: WHITE, display: "inline-block", boxShadow: `0 0 5px ${WHITE}` }}/>
            LIVE
          </div>
          <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.22rem 0.75rem", fontWeight: 700, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums", color: WHITE }}>
            {fmt(elapsed)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.22rem 0.7rem", fontSize: "0.78rem", color: "rgba(255,255,255,0.75)" }}>
            <People s={13} c="rgba(255,255,255,0.6)"/> {totalCount}
          </div>
        </div>

        {/* right */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connColor, boxShadow: `0 0 6px ${connColor}` }}/>
            <span style={{ color: connColor, fontSize: "0.68rem", fontWeight: 600 }}>
              {connStatus === "live" ? "Connected" : connStatus === "error" ? "Disconnected" : "Connecting…"}
            </span>
          </div>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }}/>
          <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", padding: "0.3rem" }}>
            <Bell s={18} c="rgba(255,255,255,0.65)"/>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${GOLD}, #f6de88)`, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem", boxShadow: `0 0 10px ${GOLD_GLOW}` }}>
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ color: WHITE, fontSize: "0.78rem", fontWeight: 700, lineHeight: 1.2 }}>{studentName}</div>
              <div style={{ color: GOLD, fontSize: "0.6rem" }}>Participant</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Video gallery */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "0.9rem", gap: "0.75rem" }}>

          {/* Top: large + stacked */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.48fr", gap: "0.75rem" }}>
            {/* Large tile */}
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: `linear-gradient(160deg, ${RIM}, ${CARD})`, aspectRatio: "4/3", border: `2px solid ${GOLD}`, boxShadow: `0 0 28px ${GOLD_GLOW}, 0 6px 24px rgba(0,0,0,0.55)` }}>
              {hostTile ? (
                <RemoteTile tile={hostTile} large />
              ) : (
                <>
                  <video ref={selfVideoRef} autoPlay playsInline muted
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: cameraReady && camOn ? "block" : "none" }} />
                  {(!cameraReady || !camOn) && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${GOLD}, #f6de88)`, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: 800, boxShadow: `0 0 20px ${GOLD_GLOW}` }}>
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: "0.55rem", left: "0.55rem", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "0.18rem 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem", color: WHITE, fontSize: "0.65rem", fontWeight: 600 }}>
                    <Mic s={10} c={MIC_ON}/> Speaking
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)", padding: "2rem 0.8rem 0.65rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ color: WHITE, fontSize: "0.88rem", fontWeight: 700 }}>{studentName}</div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem" }}>You · Participant</div>
                    </div>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: micOn ? "rgba(34,197,94,0.22)" : "rgba(229,53,53,0.7)", border: micOn ? `1px solid ${MIC_ON}` : `1px solid ${MIC_OFF}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {micOn ? <Mic s={14} c={MIC_ON}/> : <MicOff s={14} c={WHITE}/>}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right stack */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {hostTile && (
                <div style={{ flex: 1, position: "relative", borderRadius: 10, overflow: "hidden", background: `linear-gradient(160deg,${RIM},${CARD})`, border: `2px solid ${GOLD}`, boxShadow: `0 0 18px ${GOLD_GLOW}` }}>
                  <video ref={selfVideoRef} autoPlay playsInline muted
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: cameraReady && camOn ? "block" : "none" }} />
                  {(!cameraReady || !camOn) && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${GOLD},#f6de88)`, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 800 }}>
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top,rgba(0,0,0,0.82) 0%,transparent 100%)", padding: "1rem 0.55rem 0.45rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ color: WHITE, fontSize: "0.72rem", fontWeight: 700 }}>{studentName}</div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.58rem" }}>You</div>
                    </div>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: micOn ? "rgba(34,197,94,0.22)" : "rgba(229,53,53,0.7)", border: micOn ? `1px solid ${MIC_ON}` : `1px solid ${MIC_OFF}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {micOn ? <Mic s={11} c={MIC_ON}/> : <MicOff s={11} c={WHITE}/>}
                    </div>
                  </div>
                </div>
              )}
              {otherTiles[0] && <div style={{ flex: 1 }}><RemoteTile tile={otherTiles[0]} /></div>}
              {!otherTiles[0] && !hostTile && (
                <div style={{ flex: 1, borderRadius: 10, background: CARD, border: "1px dashed rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.35rem" }}>
                  <People s={20} c="rgba(255,255,255,0.18)"/>
                  <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>Waiting…</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom row */}
          {(hostTile ? otherTiles : otherTiles.slice(1)).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "0.75rem" }}>
              {(hostTile ? otherTiles : otherTiles.slice(1)).map(t => <RemoteTile key={t.identity} tile={t}/>)}
            </div>
          )}

          {remoteList.length === 0 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.9rem", opacity: 0.55 }}>
              <People s={48} c="rgba(255,255,255,0.3)"/>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>Waiting for others to join…</div>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>Share the meeting link to invite participants</div>
            </div>
          )}
        </div>

        {/* ── Right panel ───────────────────────────────────────────── */}
        <div style={{ width: 308, flexShrink: 0, background: OFF_WHITE, borderLeft: `1px solid ${PANEL_BDR}`, display: "flex", flexDirection: "column", boxShadow: "-4px 0 28px rgba(0,0,0,0.3)" }}>
          {/* Tabs */}
          <div style={{ display: "flex", background: WHITE, borderBottom: `1px solid ${PANEL_BDR}`, padding: "0 0.3rem" }}>
            {(["participants","chat","qa"] as const).map(t => (
              <button key={t} type="button" onClick={() => setActiveTab(t)} style={{
                flex: 1, background: "transparent", border: "none",
                borderBottom: activeTab === t ? `2px solid ${GOLD_DIM}` : "2px solid transparent",
                color: activeTab === t ? GOLD_DIM : MUTED_TXT,
                padding: "0.72rem 0.2rem", fontSize: "0.68rem", fontWeight: 700,
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem",
              }}>
                {t === "participants" && <><People s={14} c={activeTab==="participants"?GOLD_DIM:MUTED_TXT}/><span>Participants ({totalCount})</span></>}
                {t === "chat"         && <><Chat   s={14} c={activeTab==="chat"?GOLD_DIM:MUTED_TXT}/><span>Chat</span></>}
                {t === "qa"           && <><span style={{ fontSize:"0.85rem", lineHeight:1 }}>?</span><span>Q&A</span></>}
              </button>
            ))}
          </div>

          {activeTab === "participants" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "0.65rem", borderBottom: `1px solid ${PANEL_BDR}` }}>
                <div style={{ display: "flex", alignItems: "center", background: WHITE, border: `1px solid ${PANEL_BDR}`, borderRadius: 8, padding: "0.38rem 0.6rem", gap: "0.35rem" }}>
                  <Search s={14} c={MUTED_TXT}/>
                  <input placeholder="Search participants…" style={{ flex: 1, border: "none", outline: "none", fontSize: "0.78rem", color: INK, background: "transparent" }}/>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {/* self */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.52rem 0.85rem", borderBottom: `1px solid ${PANEL_BDR}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${GOLD},#f6de88)`, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.88rem", flexShrink: 0 }}>
                    {studentName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.8rem", color: INK }}>{studentName}</div>
                    <div style={{ fontSize: "0.62rem", color: MUTED_TXT }}>Participant</div>
                  </div>
                  <div title={micOn?"Mic on":"Muted"}>
                    {micOn ? <Mic s={15} c={MIC_ON}/> : <MicOff s={15} c={MIC_OFF}/>}
                  </div>
                  <More s={14} c={MUTED_TXT}/>
                </div>
                {remoteList.map(tile => {
                  const isHost = tile.identity.startsWith("instructor-");
                  const micLive = !!tile.audioPub?.track;
                  return (
                    <div key={tile.identity} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.52rem 0.85rem", borderBottom: `1px solid ${PANEL_BDR}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: isHost ? `linear-gradient(135deg,${WINE},#8b3030)` : "#ede8e2", color: isHost ? WHITE : INK, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.88rem", flexShrink: 0 }}>
                        {tile.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: INK }}>{tile.name}</div>
                        <div style={{ fontSize: "0.62rem", color: MUTED_TXT }}>{isHost ? "Host" : "Participant"}</div>
                      </div>
                      <div title={micLive?"Mic on":"Muted"}>
                        {micLive ? <Mic s={15} c={MIC_ON}/> : <MicOff s={15} c={MIC_OFF}/>}
                      </div>
                      <More s={14} c={MUTED_TXT}/>
                    </div>
                  );
                })}
                <button style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", background: "transparent", border: "none", padding: "0.65rem 0.85rem", cursor: "pointer", color: WINE, fontSize: "0.78rem", fontWeight: 600 }}>
                  <People s={13} c={WINE}/> View all participants <span style={{ marginLeft: "auto" }}>›</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "0.6rem 0.85rem", borderBottom: `1px solid ${PANEL_BDR}` }}>
                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: INK }}>Meeting Chat</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 0.85rem" }}>
                <p style={{ margin: 0, fontSize: "0.78rem", color: MUTED_TXT, textAlign: "center" }}>Chat messages will appear here.</p>
              </div>
              <div style={{ padding: "0.6rem", borderTop: `1px solid ${PANEL_BDR}`, display: "flex", gap: "0.45rem" }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message…"
                  style={{ flex: 1, border: `1px solid ${PANEL_BDR}`, borderRadius: 8, padding: "0.48rem 0.7rem", fontSize: "0.8rem", color: INK, outline: "none" }}/>
                <button style={{ width: 36, height: 36, borderRadius: 8, background: GOLD_DIM, border: "none", color: WHITE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send s={14} c={WHITE}/>
                </button>
              </div>
            </div>
          )}

          {activeTab === "qa" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
              <p style={{ color: MUTED_TXT, fontSize: "0.82rem", textAlign: "center" }}>No questions yet. Be the first to ask!</p>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM BAR ─────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "0.5rem 1.5rem",
        background: `linear-gradient(0deg, ${SURFACE} 0%, rgba(28,8,8,0.97) 100%)`,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(10px)",
      }}>
        {/* meeting pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "0.42rem 0.85rem", cursor: "pointer" }}>
          <People s={14} c={GOLD}/>
          <div>
            <div style={{ color: WHITE, fontSize: "0.72rem", fontWeight: 700 }}>General Meeting</div>
            <div style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.56rem" }}>NAKCONEL Learning Center</div>
          </div>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem", marginLeft: "0.15rem" }}>▾</span>
        </div>

        {/* controls — Share button removed */}
        <div style={{ display: "flex", gap: "0.28rem" }}>
          <CtrlBtn icon={micOn ? <Mic s={20} c={MIC_ON}/> : <MicOff s={20} c={MIC_OFF}/>}
            label={micOn ? "Mute" : "Unmute"} onClick={toggleMic} active={micOn}
            color={micOn ? MIC_ON : MIC_OFF}/>
          <CtrlBtn icon={camOn ? <Cam s={20} c={WHITE}/> : <CamOff s={20} c="rgba(255,255,255,0.4)"/>}
            label={camOn ? "Stop Video" : "Start Video"} onClick={toggleCam} active={camOn}/>
          <CtrlBtn icon={<People s={20} c={activeTab==="participants" ? GOLD : WHITE}/>}
            label="Participants" onClick={() => setActiveTab("participants")} active={activeTab==="participants"}/>
          <CtrlBtn icon={<Chat s={20} c={activeTab==="chat" ? GOLD : WHITE}/>}
            label="Chat" onClick={() => setActiveTab("chat")} active={activeTab==="chat"}/>
          <CtrlBtn icon={<More s={20} c="rgba(255,255,255,0.75)"/>} label="More"/>
        </div>

        {/* leave */}
        <Link href="/learning" style={{ display: "flex", alignItems: "center", gap: "0.45rem", background: RED, color: WHITE, borderRadius: 10, padding: "0.55rem 1.3rem", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none", boxShadow: "0 2px 14px rgba(229,53,53,0.38)" }}>
          <PhoneOff s={16} c={WHITE}/> Leave Meeting
        </Link>
      </div>

      {cameraError && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#fee2e2", color: "#991b1b", padding: "0.55rem 1rem", borderRadius: 8, fontSize: "0.8rem", zIndex: 100 }}>
          {cameraError}
        </div>
      )}
    </div>
  );
}
