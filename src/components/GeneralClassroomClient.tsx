"use client";

/**
 * GeneralClassroomClient — open meeting room (Nalconel brand redesign).
 * No presentation. Full video gallery — everyone sees everyone.
 * All LiveKit logic unchanged; only visual layer redesigned.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  createLocalTracks,
  type LocalTrack,
} from "livekit-client";

// ── Brand tokens ─────────────────────────────────────────────────────────────
const WINE   = "#5c1d1d";
const WINE2  = "#7a2424";
const WINE3  = "#3a1010";
const WINE4  = "#2a0c0c";
const GOLD   = "#c8943a";
const GOLD2  = "#e8b86d";
const INK    = "#f3eee7";
const MUTED  = "#b09080";
const LINE   = "#7a3030";

type Meeting = {
  id: string; title: string; instructor: string | null;
  description: string | null; status: string;
};

type ParticipantTile = {
  identity: string; name: string;
  videoPub: RemoteTrackPublication | null;
  audioPub: RemoteTrackPublication | null;
  isHost?: boolean;
};

// ── Remote participant tile ───────────────────────────────────────────────────

function RemoteTile({ tile }: { tile: ParticipantTile }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  const isHost = tile.identity.startsWith("instructor-");

  return (
    <div style={tileCard}>
      <div style={{ ...tileWrap, ...(isHost ? tileWrapHost : {}) }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ ...tileVid, display: tile.videoPub?.track ? "block" : "none" }} />
        {!tile.videoPub?.track && (
          <div style={tileAvatar}>
            <div style={{ ...avatarCircle, ...(isHost ? avatarHost : {}) }}>
              {tile.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        <audio ref={audioRef} autoPlay style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }} />
        {isHost && <div style={hostBadge}>HOST</div>}
        <div style={micBadge}>🎤</div>
      </div>
      <span style={tileName}>{isHost ? `${tile.name} (Host)` : tile.name}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function GeneralClassroomClient({
  meeting,
  studentName,
}: {
  meeting: Meeting;
  studentName: string;
}) {
  const roomRef      = useRef<Room | null>(null);
  const activeRef    = useRef(true);
  const selfVidRef   = useRef<HTMLVideoElement | null>(null);
  const pendingTrack = useRef<LocalTrack | null>(null);

  const [connStatus,   setConnStatus]   = useState<"connecting"|"live"|"error">("connecting");
  const [statusMsg,    setStatusMsg]    = useState("Connecting…");
  const [cameraReady,  setCameraReady]  = useState(false);
  const [cameraError,  setCameraError]  = useState("");
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(true);
  const [activeTab,    setActiveTab]    = useState<"participants"|"chat">("participants");
  const [participants, setParticipants] = useState<Record<string, ParticipantTile>>({});
  const [elapsed,      setElapsed]      = useState(0);

  const localVideoTrack = useRef<LocalTrack | null>(null);
  const localAudioTrack = useRef<LocalTrack | null>(null);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const selfVideoRef = useCallback((el: HTMLVideoElement | null) => {
    selfVidRef.current = el;
    if (el && pendingTrack.current) {
      pendingTrack.current.attach(el);
      void el.play().catch(() => {});
      pendingTrack.current = null;
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;

    async function connect() {
      const cameraPromise = (async () => {
        try {
          const tracks = await createLocalTracks({ audio: true, video: { facingMode: "user" } });
          if (!activeRef.current) { tracks.forEach((t) => t.stop()); return; }
          const vid = tracks.find((t) => t.kind === Track.Kind.Video) ?? null;
          const aud = tracks.find((t) => t.kind === Track.Kind.Audio) ?? null;
          localVideoTrack.current = vid;
          localAudioTrack.current = aud;
          if (vid) {
            if (selfVidRef.current) { vid.attach(selfVidRef.current); void selfVidRef.current.play().catch(() => {}); }
            else pendingTrack.current = vid;
          }
          if (activeRef.current) setCameraReady(true);
          return { vid, aud };
        } catch {
          if (activeRef.current) setCameraError("Camera access denied.");
          return { vid: null, aud: null };
        }
      })();

      let url: string, token: string;
      try {
        const res  = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(meeting.id)}`);
        const data = await res.json();
        if (!res.ok || !data.url || !data.token) throw new Error(data.error ?? "Token unavailable");
        url   = (data.url as string).replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
        token = data.token as string;
      } catch (err) {
        if (activeRef.current) { setConnStatus("error"); setStatusMsg(err instanceof Error ? err.message : "Connection failed"); }
        return;
      }

      if (!activeRef.current) return;

      const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: false });
      roomRef.current = room;

      room.on(RoomEvent.Connected, () => { if (activeRef.current) { setConnStatus("live"); setStatusMsg("Connected"); } });
      room.on(RoomEvent.Disconnected, () => { if (activeRef.current) { setConnStatus("error"); setStatusMsg("Disconnected"); } });

      room.on(RoomEvent.ParticipantConnected, (rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants((prev) => ({
          ...prev,
          [rp.identity]: { identity: rp.identity, name: rp.name || rp.identity, videoPub: null, audioPub: null },
        }));
      });

      room.on(RoomEvent.ParticipantDisconnected, (rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants((prev) => { const n = { ...prev }; delete n[rp.identity]; return n; });
      });

      room.on(RoomEvent.TrackSubscribed, (track, pub, rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants((prev) => {
          const ex = prev[rp.identity] ?? { identity: rp.identity, name: rp.name || rp.identity, videoPub: null, audioPub: null };
          if (track.kind === Track.Kind.Video) return { ...prev, [rp.identity]: { ...ex, videoPub: pub } };
          if (track.kind === Track.Kind.Audio) return { ...prev, [rp.identity]: { ...ex, audioPub: pub } };
          return prev;
        });
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants((prev) => {
          const ex = prev[rp.identity];
          if (!ex) return prev;
          if (track.kind === Track.Kind.Video) return { ...prev, [rp.identity]: { ...ex, videoPub: null } };
          if (track.kind === Track.Kind.Audio) return { ...prev, [rp.identity]: { ...ex, audioPub: null } };
          return prev;
        });
      });

      try { await room.connect(url, token); }
      catch (err) { if (activeRef.current) { setConnStatus("error"); setStatusMsg(err instanceof Error ? err.message : "Failed"); } return; }
      if (!activeRef.current) { void room.disconnect(); return; }

      // Seed existing participants
      const tiles: Record<string, ParticipantTile> = {};
      for (const [id, rp] of Array.from(room.remoteParticipants.entries())) {
        let vp: RemoteTrackPublication | null = null, ap: RemoteTrackPublication | null = null;
        for (const pub of Array.from(rp.trackPublications.values())) {
          if (pub.kind === Track.Kind.Video && pub.isSubscribed && pub.track) vp = pub;
          if (pub.kind === Track.Kind.Audio && pub.isSubscribed && pub.track) ap = pub;
        }
        tiles[id] = { identity: id, name: rp.name || id, videoPub: vp, audioPub: ap };
      }
      if (Object.keys(tiles).length > 0) setParticipants(tiles);

      const camResult = await cameraPromise;
      if (camResult) {
        for (const t of [camResult.vid, camResult.aud].filter(Boolean) as LocalTrack[]) {
          await room.localParticipant.publishTrack(t).catch(() => {});
        }
      }
    }

    void connect();

    return () => {
      activeRef.current = false;
      localVideoTrack.current?.stop();
      localAudioTrack.current?.stop();
      roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
    };
  }, [meeting.id]);

  const toggleMic = () => {
    const at = localAudioTrack.current;
    if (!at) return;
    if (micOn) { void at.mute(); setMicOn(false); } else { void at.unmute(); setMicOn(true); }
  };
  const toggleCam = () => {
    const vt = localVideoTrack.current;
    if (!vt) return;
    if (camOn) { void vt.mute(); setCamOn(false); } else { void vt.unmute(); setCamOn(true); }
  };

  const remoteList = Object.values(participants);
  const totalCount = remoteList.length + 1;

  return (
    <div style={shell}>

      {/* TOP BAR */}
      <header style={topBar}>
        <div style={topLeft}>
          <div style={logoWrap}>
            <div style={logoMark}>N</div>
            <div>
              <div style={logoName}>Nalconel</div>
              <div style={logoSub}>Learning Center</div>
            </div>
          </div>
          <div style={vDivider} />
          <span style={meetingTitle}>{meeting.title}</span>
        </div>
        <div style={topRight}>
          <div style={liveChip}>
            <span style={liveDot} /> LIVE
          </div>
          <div style={timerChip}>{fmtTime(elapsed)}</div>
          <div style={countChip}>👥 {totalCount}</div>
          <div style={{ ...connChip, ...(connStatus === "live" ? connLive : connStatus === "error" ? connErr : connWait) }}>
            {connStatus === "live" ? "● Connected" : connStatus === "error" ? "✕ " + statusMsg : "◌ Connecting…"}
          </div>
          <Link href="/learning" style={leaveBtn}>Leave</Link>
        </div>
      </header>

      {/* BODY: video gallery + right panel */}
      <div style={body}>

        {/* Video gallery */}
        <div style={gallery}>
          {/* Self tile */}
          <div style={tileCard}>
            <div style={{ ...tileWrap, border: `2px solid ${GOLD}` }}>
              <video ref={selfVideoRef} autoPlay playsInline muted
                style={{ ...tileVid, display: cameraReady && camOn ? "block" : "none" }} />
              {(!cameraReady || !camOn) && (
                <div style={tileAvatar}>
                  <div style={{ ...avatarCircle, background: GOLD, color: WINE }}>
                    {studentName.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div style={youBadge}>You</div>
              <div style={micBadge}>{micOn ? "🎤" : "🔇"}</div>
            </div>
            <span style={tileName}>{studentName}</span>
            {cameraError && <p style={camErrStyle}>{cameraError}</p>}
          </div>

          {/* Remote tiles */}
          {remoteList.map((tile) => (
            <RemoteTile key={tile.identity} tile={tile} />
          ))}

          {/* Waiting placeholder */}
          {remoteList.length === 0 && (
            <div style={waitTile}>
              <div style={{ fontSize: "2.5rem" }}>👥</div>
              <p style={{ margin: "0.5rem 0 0.2rem", color: INK, fontWeight: 700 }}>
                Waiting for others…
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: MUTED }}>
                Share the meeting link to invite participants
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={rightPanel}>
          <div style={rpTabBar}>
            {(["participants", "chat"] as const).map((t) => (
              <button key={t} type="button"
                onClick={() => setActiveTab(t)}
                style={{ ...rpTab, ...(activeTab === t ? rpTabActive : {}) }}>
                {t === "participants" ? `👥 Participants (${totalCount})` : "💬 Chat"}
              </button>
            ))}
          </div>
          <div style={rpBody}>
            {activeTab === "participants" && (
              <div style={participantList}>
                {/* Self */}
                <div style={participantRow}>
                  <div style={{ ...participantAvatar, background: GOLD, color: WINE }}>
                    {studentName.charAt(0).toUpperCase()}
                  </div>
                  <div style={participantInfo}>
                    <span style={participantName}>{studentName}</span>
                    <span style={participantRole}>You · Participant</span>
                  </div>
                  <span style={micIcon}>{micOn ? "🎤" : "🔇"}</span>
                </div>
                {remoteList.map((tile) => {
                  const isHost = tile.identity.startsWith("instructor-");
                  return (
                    <div key={tile.identity} style={participantRow}>
                      <div style={{ ...participantAvatar, ...(isHost ? { background: WINE2, color: GOLD2 } : {}) }}>
                        {tile.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={participantInfo}>
                        <span style={participantName}>{tile.name}</span>
                        <span style={participantRole}>{isHost ? "Host" : "Participant"}</span>
                      </div>
                      <span style={micIcon}>{tile.audioPub?.track ? "🎤" : "🔇"}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {activeTab === "chat" && (
              <div style={{ padding: "0.75rem", color: MUTED, fontSize: "0.82rem" }}>
                <p>Chat is available in the Class view.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROL BAR */}
      <div style={ctrlBar}>
        <div style={ctrlBarCenter}>
          <button type="button" onClick={toggleMic}
            style={{ ...ctrlBtn, ...(micOn ? ctrlOn : ctrlOff) }}>
            <span style={ctrlIcon}>{micOn ? "🎤" : "🔇"}</span>
            <span style={ctrlLabel}>{micOn ? "Mute" : "Unmute"}</span>
          </button>
          <button type="button" onClick={toggleCam}
            style={{ ...ctrlBtn, ...(camOn ? ctrlOn : ctrlOff) }}>
            <span style={ctrlIcon}>{camOn ? "📷" : "🚫"}</span>
            <span style={ctrlLabel}>{camOn ? "Stop Video" : "Start Video"}</span>
          </button>
          <button type="button"
            onClick={() => setActiveTab(activeTab === "participants" ? "chat" : "participants")}
            style={{ ...ctrlBtn, ...ctrlOn }}>
            <span style={ctrlIcon}>👥</span>
            <span style={ctrlLabel}>Participants</span>
          </button>
          <button type="button"
            onClick={() => setActiveTab("chat")}
            style={{ ...ctrlBtn, ...ctrlOn }}>
            <span style={ctrlIcon}>💬</span>
            <span style={ctrlLabel}>Chat</span>
          </button>
        </div>
        <Link href="/learning" style={leaveCtrl}>
          <span>Leave Meeting</span>
        </Link>
      </div>

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  minHeight: "100dvh", background: WINE4, color: INK,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "flex", flexDirection: "column",
};
const topBar: React.CSSProperties = {
  background: WINE, height: 52, padding: "0 1rem",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  boxShadow: "0 2px 10px rgba(0,0,0,0.4)", flexShrink: 0,
  gap: "0.5rem", flexWrap: "wrap",
};
const topLeft: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.75rem" };
const topRight: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" };
const logoWrap: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.45rem" };
const logoMark: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: `linear-gradient(135deg, ${GOLD}, ${GOLD2})`,
  color: WINE, fontWeight: 900, fontSize: "1.1rem",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const logoName: React.CSSProperties = { color: "#fff", fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.1 };
const logoSub: React.CSSProperties = { color: GOLD2, fontSize: "0.58rem", letterSpacing: "0.04em" };
const vDivider: React.CSSProperties = { width: 1, height: 26, background: LINE };
const meetingTitle: React.CSSProperties = {
  color: GOLD2, fontWeight: 700, fontSize: "0.85rem",
  maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const liveChip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.3rem",
  background: "rgba(220,30,30,0.25)", border: "1px solid #e05050",
  color: "#ff7070", padding: "0.18rem 0.5rem", borderRadius: 99,
  fontSize: "0.65rem", fontWeight: 800,
};
const liveDot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: "50%",
  background: "#ff5555", boxShadow: "0 0 5px #ff5555", display: "inline-block",
};
const timerChip: React.CSSProperties = {
  background: WINE2, color: GOLD2, padding: "0.18rem 0.55rem",
  borderRadius: 99, fontSize: "0.7rem", fontWeight: 700, fontVariantNumeric: "tabular-nums",
};
const countChip: React.CSSProperties = {
  background: WINE2, color: INK, padding: "0.18rem 0.55rem",
  borderRadius: 99, fontSize: "0.7rem", fontWeight: 600,
};
const connChip: React.CSSProperties = {
  padding: "0.18rem 0.55rem", borderRadius: 99, fontSize: "0.65rem", fontWeight: 700,
};
const connLive: React.CSSProperties = { background: "rgba(77,255,136,0.15)", color: "#4dff88" };
const connErr:  React.CSSProperties = { background: "rgba(255,80,80,0.15)", color: "#ff8080" };
const connWait: React.CSSProperties = { background: WINE2, color: MUTED };
const leaveBtn: React.CSSProperties = {
  background: "#8b1a1a", border: "1px solid #cc3333",
  color: "#fff", borderRadius: 6,
  padding: "0.3rem 0.75rem", fontSize: "0.78rem", fontWeight: 700,
  textDecoration: "none",
};

// Body
const body: React.CSSProperties = {
  flex: 1, display: "flex", overflow: "hidden",
  minHeight: 0,
};

// Gallery
const gallery: React.CSSProperties = {
  flex: 1, padding: "0.85rem",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(clamp(140px, 28vw, 260px), 1fr))",
  gap: "0.75rem",
  alignContent: "start",
  overflowY: "auto",
};

// Tiles
const tileCard: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
};
const tileWrap: React.CSSProperties = {
  position: "relative", width: "100%", aspectRatio: "16/9",
  background: WINE3, border: `1px solid ${LINE}`,
  borderRadius: 10, overflow: "hidden",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const tileWrapHost: React.CSSProperties = { border: `2px solid ${GOLD}` };
const tileVid: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const tileAvatar: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  position: "absolute", inset: 0,
};
const avatarCircle: React.CSSProperties = {
  width: "45%", aspectRatio: "1",
  maxWidth: 72, borderRadius: "50%",
  background: WINE2, color: GOLD2,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "clamp(1.2rem, 4vw, 2rem)", fontWeight: 800,
};
const avatarHost: React.CSSProperties = { background: GOLD, color: WINE };
const hostBadge: React.CSSProperties = {
  position: "absolute", top: "0.3rem", left: "0.3rem",
  background: GOLD, color: WINE,
  fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.05em",
  padding: "0.1rem 0.35rem", borderRadius: 3,
};
const youBadge: React.CSSProperties = {
  position: "absolute", top: "0.3rem", left: "0.3rem",
  background: `rgba(200,148,58,0.9)`, color: WINE,
  fontSize: "0.55rem", fontWeight: 800,
  padding: "0.1rem 0.35rem", borderRadius: 3,
};
const micBadge: React.CSSProperties = {
  position: "absolute", bottom: "0.3rem", right: "0.3rem",
  background: "rgba(0,0,0,0.55)", borderRadius: 3,
  fontSize: "0.7rem", padding: "0.1rem 0.2rem",
};
const tileName: React.CSSProperties = {
  fontSize: "0.75rem", fontWeight: 600, color: INK,
  textAlign: "center", maxWidth: "100%",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const camErrStyle: React.CSSProperties = { fontSize: "0.65rem", color: "#ff9a8a", margin: 0, textAlign: "center" };
const waitTile: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  background: WINE3, border: `1px dashed ${LINE}`,
  borderRadius: 10, padding: "1.5rem", aspectRatio: "16/9", textAlign: "center",
};

// Right panel
const rightPanel: React.CSSProperties = {
  width: "clamp(200px, 28vw, 300px)", borderLeft: `1px solid ${LINE}`,
  background: WINE3, display: "flex", flexDirection: "column",
  flexShrink: 0,
};
const rpTabBar: React.CSSProperties = {
  display: "flex", background: WINE, borderBottom: `1px solid ${LINE}`,
};
const rpTab: React.CSSProperties = {
  flex: 1, background: "transparent", border: "none",
  borderBottom: "2px solid transparent",
  color: MUTED, padding: "0.6rem 0.4rem",
  fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
};
const rpTabActive: React.CSSProperties = { color: GOLD2, borderBottomColor: GOLD, background: WINE3 };
const rpBody: React.CSSProperties = { flex: 1, overflowY: "auto" };

// Participants list
const participantList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.1rem", padding: "0.5rem" };
const participantRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.6rem",
  padding: "0.45rem 0.5rem", borderRadius: 6,
  background: "rgba(255,255,255,0.04)",
};
const participantAvatar: React.CSSProperties = {
  width: 32, height: 32, borderRadius: "50%",
  background: WINE2, color: GOLD2,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "0.9rem", fontWeight: 700, flexShrink: 0,
};
const participantInfo: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", gap: 0, overflow: "hidden" };
const participantName: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const participantRole: React.CSSProperties = { fontSize: "0.62rem", color: MUTED };
const micIcon: React.CSSProperties = { fontSize: "0.8rem", flexShrink: 0 };

// Control bar
const ctrlBar: React.CSSProperties = {
  background: WINE, borderTop: `1px solid ${LINE}`,
  padding: "0.5rem 1rem", flexShrink: 0,
  display: "flex", justifyContent: "space-between", alignItems: "center",
  gap: "0.75rem",
};
const ctrlBarCenter: React.CSSProperties = { display: "flex", gap: "0.5rem", flexWrap: "wrap" };
const ctrlBtn: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.1rem",
  background: WINE2, border: `1px solid ${LINE}`,
  color: INK, borderRadius: 8,
  padding: "0.35rem 0.65rem", cursor: "pointer", minWidth: 52,
};
const ctrlOn: React.CSSProperties = { background: WINE2, borderColor: LINE, color: INK };
const ctrlOff: React.CSSProperties = { background: "rgba(0,0,0,0.3)", borderColor: "#555", color: "#888" };
const ctrlIcon: React.CSSProperties = { fontSize: "1rem" };
const ctrlLabel: React.CSSProperties = { fontSize: "0.56rem", fontWeight: 600, color: GOLD2, letterSpacing: "0.03em" };
const leaveCtrl: React.CSSProperties = {
  background: "#8b1a1a", border: "1px solid #cc3333",
  color: "#fff", borderRadius: 8,
  padding: "0.5rem 1.2rem", fontWeight: 700, fontSize: "0.85rem",
  textDecoration: "none", display: "flex", alignItems: "center",
};
