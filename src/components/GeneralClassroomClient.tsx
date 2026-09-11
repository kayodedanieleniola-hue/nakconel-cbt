"use client";

/**
 * GeneralClassroomClient — open meeting room for all students.
 *
 * No presentation stage. Every participant (instructor + students) appears
 * as a live video tile. The student's own camera publishes automatically
 * after the browser grants permission.
 *
 * Uses the same /api/learning/livekit/token endpoint as the regular class —
 * the general meeting's classId produces a room named classroom-<id>.
 * The LiveKit token grants canPublish + canSubscribe to everyone.
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

type Meeting = {
  id: string;
  title: string;
  instructor: string | null;
  description: string | null;
  status: string;
};

// ── Per-participant video tile ─────────────────────────────────────────────

type ParticipantTile = {
  identity: string;
  name: string;
  videoPub: RemoteTrackPublication | null;
  audioPub: RemoteTrackPublication | null;
};

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

  return (
    <div style={tileCard}>
      <div style={tileVideoWrap}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ ...tileVideo, display: tile.videoPub?.track ? "block" : "none" }} />
        {!tile.videoPub?.track && (
          <div style={tileAvatar}>
            <span style={{ fontSize: "2.5rem" }}>👤</span>
          </div>
        )}
        <audio ref={audioRef} autoPlay
          style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }} />
        <span style={tileLive}>● LIVE</span>
      </div>
      <span style={tileName}>{tile.name}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function GeneralClassroomClient({
  meeting,
  studentName,
}: {
  meeting: Meeting;
  studentName: string;
}) {
  const roomRef       = useRef<Room | null>(null);
  const activeRef     = useRef(true);
  const selfVidRef    = useRef<HTMLVideoElement | null>(null);
  const pendingTrack  = useRef<LocalTrack | null>(null);

  const [status,        setStatus]        = useState("Connecting…");
  const [cameraReady,   setCameraReady]   = useState(false);
  const [cameraError,   setCameraError]   = useState("");
  const [micOn,         setMicOn]         = useState(true);
  const [camOn,         setCamOn]         = useState(true);
  const [participants,  setParticipants]  = useState<Record<string, ParticipantTile>>({});

  const localVideoTrack = useRef<LocalTrack | null>(null);
  const localAudioTrack = useRef<LocalTrack | null>(null);

  // Callback ref — attaches track the instant <video> mounts
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
      // 1. Camera + token in parallel
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
        } catch (e) {
          if (activeRef.current) setCameraError("Camera access denied — others won't see you.");
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
        if (activeRef.current) setStatus(`Offline · ${err instanceof Error ? err.message : "error"}`);
        return;
      }

      if (!activeRef.current) return;

      // 2. Create Room
      const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: false });
      roomRef.current = room;

      room.on(RoomEvent.Connected, () => {
        if (activeRef.current) setStatus("● Live");
      });
      room.on(RoomEvent.Disconnected, () => {
        if (activeRef.current) setStatus("Disconnected");
      });

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
          const existing = prev[rp.identity] ?? { identity: rp.identity, name: rp.name || rp.identity, videoPub: null, audioPub: null };
          if (track.kind === Track.Kind.Video) return { ...prev, [rp.identity]: { ...existing, videoPub: pub } };
          if (track.kind === Track.Kind.Audio) return { ...prev, [rp.identity]: { ...existing, audioPub: pub } };
          return prev;
        });
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, rp: RemoteParticipant) => {
        if (!activeRef.current) return;
        setParticipants((prev) => {
          const existing = prev[rp.identity];
          if (!existing) return prev;
          if (track.kind === Track.Kind.Video) return { ...prev, [rp.identity]: { ...existing, videoPub: null } };
          if (track.kind === Track.Kind.Audio) return { ...prev, [rp.identity]: { ...existing, audioPub: null } };
          return prev;
        });
      });

      // 3. Connect
      try {
        await room.connect(url, token);
      } catch (err) {
        if (activeRef.current) setStatus(`Failed: ${err instanceof Error ? err.message : "error"}`);
        return;
      }
      if (!activeRef.current) { void room.disconnect(); return; }

      // Seed pre-existing participants
      const tiles: Record<string, ParticipantTile> = {};
      for (const [identity, rp] of Array.from(room.remoteParticipants.entries())) {
        let videoPub: RemoteTrackPublication | null = null;
        let audioPub: RemoteTrackPublication | null = null;
        for (const pub of Array.from(rp.trackPublications.values())) {
          if (pub.kind === Track.Kind.Video && pub.isSubscribed && pub.track) videoPub = pub;
          if (pub.kind === Track.Kind.Audio && pub.isSubscribed && pub.track) audioPub = pub;
        }
        tiles[identity] = { identity, name: rp.name || identity, videoPub, audioPub };
      }
      if (Object.keys(tiles).length > 0) setParticipants(tiles);

      // 4. Publish local tracks
      const camResult = await cameraPromise;
      if (camResult) {
        const toPublish = [camResult.vid, camResult.aud].filter(Boolean) as LocalTrack[];
        for (const t of toPublish) {
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
    if (micOn) { void at.mute(); setMicOn(false); }
    else       { void at.unmute(); setMicOn(true); }
  };

  const toggleCam = () => {
    const vt = localVideoTrack.current;
    if (!vt) return;
    if (camOn) { void vt.mute(); setCamOn(false); }
    else       { void vt.unmute(); setCamOn(true); }
  };

  const remoteCount = Object.keys(participants).length;

  return (
    <div style={shell}>
      {/* Top bar */}
      <header style={topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/learning" style={brandLink}>Nak Learning Center</Link>
          <span style={livePill}>🌐 GENERAL MEETING</span>
          <span style={statusPill}>{status}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={titleText}>{meeting.title}</span>
          <Link href="/learning" style={leaveBtn}>Leave</Link>
        </div>
      </header>

      {/* Video grid */}
      <div style={gridWrap}>
        {/* Self tile */}
        <div style={tileCard}>
          <div style={tileVideoWrap}>
            <video ref={selfVideoRef} autoPlay playsInline muted
              style={{ ...tileVideo, display: cameraReady && camOn ? "block" : "none" }} />
            {(!cameraReady || !camOn) && (
              <div style={tileAvatar}>
                <span style={{ fontSize: "2.5rem" }}>👤</span>
              </div>
            )}
            <span style={{ ...tileLive, background: "rgba(152,102,27,0.85)", color: "#fff" }}>You</span>
          </div>
          <span style={tileName}>{studentName}</span>
          {cameraError && <p style={camErr}>{cameraError}</p>}
        </div>

        {/* Remote tiles */}
        {Object.values(participants).map((tile) => (
          <RemoteTile key={tile.identity} tile={tile} />
        ))}

        {remoteCount === 0 && (
          <div style={waitingTile}>
            <span style={{ fontSize: "2rem" }}>👥</span>
            <p style={{ margin: "0.5rem 0 0", color: "#f3eee7", fontWeight: 600 }}>Waiting for others…</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#8c766b" }}>
              Share this link so others can join
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={controls}>
        <button type="button" onClick={toggleMic}
          style={{ ...ctrlBtn, ...(micOn ? ctrlOn : ctrlOff) }}>
          {micOn ? "🎤 Mic ON" : "🎤 Muted"}
        </button>
        <button type="button" onClick={toggleCam}
          style={{ ...ctrlBtn, ...(camOn ? ctrlOn : ctrlOff) }}>
          {camOn ? "📷 Camera ON" : "📷 Camera OFF"}
        </button>
        <Link href="/learning" style={{ ...ctrlBtn, ...leaveCtrl, textDecoration: "none", textAlign: "center" }}>
          Leave Meeting
        </Link>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  minHeight: "100dvh", background: "#1a0d0c", color: "#f3eee7",
  fontFamily: "system-ui, -apple-system, sans-serif",
  display: "flex", flexDirection: "column",
};
const topBar: React.CSSProperties = {
  background: "#330808", borderBottom: "1px solid #4a1919",
  padding: "0.6rem 1rem", display: "flex",
  justifyContent: "space-between", alignItems: "center",
  gap: "0.5rem", flexWrap: "wrap", flexShrink: 0,
};
const brandLink: React.CSSProperties = { color: "#fff", fontStyle: "italic", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" };
const livePill: React.CSSProperties = { background: "#98661B", color: "#fff", padding: "0.15rem 0.5rem", borderRadius: 20, fontSize: "0.68rem", fontWeight: 700 };
const statusPill: React.CSSProperties = { color: "#4dff88", fontSize: "0.72rem", fontWeight: 600 };
const titleText: React.CSSProperties = { color: "#ffd98a", fontSize: "0.85rem", fontWeight: 600 };
const leaveBtn: React.CSSProperties = { color: "#fff", textDecoration: "none", background: "transparent", border: "1px solid #ff4d4d", borderRadius: 4, padding: "0.3rem 0.6rem", fontSize: "0.78rem", fontWeight: 600 };

const gridWrap: React.CSSProperties = {
  flex: 1, padding: "1rem",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(clamp(140px, 30vw, 280px), 1fr))",
  gap: "0.75rem",
  alignContent: "start",
  overflowY: "auto",
};

const tileCard: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" };
const tileVideoWrap: React.CSSProperties = {
  position: "relative", width: "100%", aspectRatio: "16/9",
  background: "#100707", border: "1px solid #3b2220", borderRadius: 8,
  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
};
const tileVideo: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const tileAvatar: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", color: "#8c766b" };
const tileLive: React.CSSProperties = { position: "absolute", top: "0.3rem", right: "0.3rem", background: "rgba(0,0,0,0.65)", color: "#4dff88", fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.3rem", borderRadius: 3 };
const tileName: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 600, color: "#f3eee7", textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const camErr: React.CSSProperties = { fontSize: "0.68rem", color: "#ff9a8a", margin: 0, textAlign: "center" };

const waitingTile: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  background: "#241211", border: "1px dashed #3b2220", borderRadius: 8,
  padding: "1.5rem", aspectRatio: "16/9", textAlign: "center",
};

const controls: React.CSSProperties = {
  background: "#120807", borderTop: "1px solid #3b2220",
  padding: "0.75rem 1rem", display: "flex", gap: "0.6rem",
  justifyContent: "center", flexWrap: "wrap", flexShrink: 0,
};
const ctrlBtn: React.CSSProperties = { padding: "0.55rem 1.2rem", borderRadius: 6, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", border: "1px solid transparent" };
const ctrlOn: React.CSSProperties = { background: "#331614", borderColor: "#98661B", color: "#ffd98a" };
const ctrlOff: React.CSSProperties = { background: "#180c0b", borderColor: "#3b2220", color: "#8c766b" };
const leaveCtrl: React.CSSProperties = { background: "#4d1010", borderColor: "#ff4d4d", color: "#fff" };
