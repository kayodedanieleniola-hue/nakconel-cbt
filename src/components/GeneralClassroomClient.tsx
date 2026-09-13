"use client";

/**
 * GeneralClassroomClient — NAK Learning Center brand redesign.
 * Matches the mockup: dark wine background, white right panel, gold accents,
 * large speaking tile + grid layout, bottom control bar with icon+label.
 * No left sidebar. All LiveKit logic unchanged.
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

// ── Brand tokens ──────────────────────────────────────────────────────────────
const BG       = "#1a0808";   // darkest wine background
const BG2      = "#2d1010";   // card/tile background
const BG3      = "#3d1515";   // hover/lighter wine
const WINE     = "#5c1d1d";   // header wine
const GOLD     = "#d4a843";   // gold accent
const GOLDD    = "#b8922f";   // darker gold
const WHITE    = "#ffffff";
const OFF_W    = "#f8f5f2";   // off-white panel
const GRAY     = "#e5e0db";   // panel borders
const GRAY2    = "#8a7a72";   // muted text
const INK      = "#1a1210";   // dark text on light bg
const RED_BTN  = "#dc2626";

type Meeting = {
  id: string; title: string; instructor: string | null;
  description: string | null; status: string;
};

type ParticipantTile = {
  identity: string; name: string;
  videoPub: RemoteTrackPublication | null;
  audioPub: RemoteTrackPublication | null;
};

// ── NAK Logo ──────────────────────────────────────────────────────────────────
function NakLogo({ light = false }: { light?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `linear-gradient(135deg, ${GOLD} 0%, #e8c878 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "1rem" }}>✦</span>
      </div>
      <div>
        <div style={{ color: light ? WHITE : INK, fontWeight: 900, fontSize: "1rem", lineHeight: 1 }}>NAK</div>
        <div style={{ color: light ? "rgba(255,255,255,0.7)" : GRAY2, fontSize: "0.58rem", letterSpacing: "0.06em", lineHeight: 1.2 }}>
          Learning Center
        </div>
      </div>
    </div>
  );
}

// ── Remote participant video tile ─────────────────────────────────────────────
function RemoteTile({
  tile, large = false,
}: {
  tile: ParticipantTile; large?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isHost   = tile.identity.startsWith("instructor-");
  const micOn    = !!tile.audioPub?.track;

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
      position: "relative", borderRadius: 12,
      overflow: "hidden", background: BG2,
      border: isHost ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.08)",
      aspectRatio: large ? "4/3" : "16/9",
      width: "100%",
    }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ width: "100%", height: "100%", objectFit: "cover",
          display: tile.videoPub?.track ? "block" : "none" }} />
      {!tile.videoPub?.track && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(160deg, ${BG3} 0%, ${BG2} 100%)`,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: isHost ? GOLD : BG3,
            color: isHost ? INK : WHITE,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.6rem", fontWeight: 800,
          }}>
            {tile.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <audio ref={audioRef} autoPlay style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }} />

      {/* Speaking badge */}
      {isHost && (
        <div style={{
          position: "absolute", top: "0.6rem", left: "0.6rem",
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: WHITE, fontSize: "0.68rem", fontWeight: 600,
          padding: "0.2rem 0.5rem", borderRadius: 99,
          display: "flex", alignItems: "center", gap: "0.3rem",
        }}>
          🎤 Speaking
        </div>
      )}

      {/* Name + role bar at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
        padding: "1.5rem 0.65rem 0.5rem",
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      }}>
        <div>
          <div style={{ color: WHITE, fontSize: "0.82rem", fontWeight: 700, lineHeight: 1.2 }}>{tile.name}</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.65rem" }}>
            {isHost ? "Host" : "Participant"}
          </div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: micOn ? "rgba(255,255,255,0.2)" : "rgba(220,38,38,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.75rem",
        }}>
          {micOn ? "🎤" : "🔇"}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
  const [cameraReady,  setCameraReady]  = useState(false);
  const [cameraError,  setCameraError]  = useState("");
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(true);
  const [activeTab,    setActiveTab]    = useState<"participants"|"chat"|"qa">("participants");
  const [participants, setParticipants] = useState<Record<string, ParticipantTile>>({});
  const [chatInput,    setChatInput]    = useState("");
  const [elapsed,      setElapsed]      = useState(0);

  const localVideoTrack = useRef<LocalTrack | null>(null);
  const localAudioTrack = useRef<LocalTrack | null>(null);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
  };

  const selfVideoRef = useCallback((el: HTMLVideoElement | null) => {
    selfVidRef.current = el;
    if (el && pendingTrack.current) {
      pendingTrack.current.attach(el);
      void el.play().catch(() => {});
      pendingTrack.current = null;
    }
  }, []);

  // ── LiveKit connection (unchanged logic) ───────────────────────────────────
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
        if (activeRef.current) setConnStatus("error");
        return;
      }
      if (!activeRef.current) return;

      const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: false });
      roomRef.current = room;

      room.on(RoomEvent.Connected,    () => { if (activeRef.current) setConnStatus("live"); });
      room.on(RoomEvent.Disconnected, () => { if (activeRef.current) setConnStatus("error"); });

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
      catch { if (activeRef.current) setConnStatus("error"); return; }
      if (!activeRef.current) { void room.disconnect(); return; }

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

  const remoteList  = Object.values(participants);
  const totalCount  = remoteList.length + 1;
  // Find the "speaking" / host participant for the large tile
  const hostTile    = remoteList.find((t) => t.identity.startsWith("instructor-"));
  const otherTiles  = remoteList.filter((t) => !t.identity.startsWith("instructor-"));

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: WHITE, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header style={{
        background: BG, borderBottom: "1px solid rgba(255,255,255,0.08)",
        height: 56, padding: "0 1.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "1rem", flexShrink: 0,
      }}>
        {/* Left: logo + divider + meeting info */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <NakLogo light />
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.15)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: BG3,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
            }}>👥</div>
            <div>
              <div style={{ color: WHITE, fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.2 }}>General Meeting</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}>NAK Learning Center Community</div>
            </div>
          </div>
        </div>

        {/* Center: LIVE + timer + count */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            background: RED_BTN, color: WHITE, fontWeight: 800, fontSize: "0.7rem",
            padding: "0.3rem 0.7rem", borderRadius: 99, letterSpacing: "0.06em",
            display: "flex", alignItems: "center", gap: "0.3rem",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: WHITE, display: "inline-block" }} />
            LIVE
          </div>
          <div style={{ color: WHITE, fontWeight: 700, fontSize: "0.92rem", fontVariantNumeric: "tabular-nums" }}>
            {fmtTime(elapsed)}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.35rem",
            color: "rgba(255,255,255,0.75)", fontSize: "0.8rem",
          }}>
            👥 {totalCount} participants
          </div>
        </div>

        {/* Right: bell + profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            position: "relative", width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}>
            <span style={{ fontSize: "1.2rem" }}>🔔</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: GOLD, color: INK,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "0.9rem",
            }}>
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ color: WHITE, fontSize: "0.8rem", fontWeight: 700 }}>{studentName}</div>
              <div style={{ color: GOLD, fontSize: "0.62rem" }}>
                {typeof window !== "undefined" && window.location.pathname.includes("/admin/") ? "Host" : "Participant"}
              </div>
            </div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>▾</span>
          </div>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Video gallery — left + center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "1rem", gap: "0.75rem" }}>

          {/* Top row: large speaking tile + 2 stacked */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.48fr", gap: "0.75rem", flex: hostTile ? "0 0 auto" : 1 }}>
            {/* Large / speaking tile */}
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: BG2, aspectRatio: "4/3", border: `2px solid ${GOLD}` }}>
              {hostTile ? (
                <>
                  <RemoteTile tile={hostTile} large />
                </>
              ) : (
                /* self tile as large when no host */
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  <video ref={selfVideoRef} autoPlay playsInline muted
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraReady && camOn ? "block" : "none" }} />
                  {(!cameraReady || !camOn) && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${BG3}, ${BG2})` }}>
                      <div style={{ width: 80, height: 80, borderRadius: "50%", background: GOLD, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: 800 }}>
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)", color: WHITE, fontSize: "0.68rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: 99, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    🎤 Speaking
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)", padding: "1.5rem 0.65rem 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ color: WHITE, fontSize: "0.88rem", fontWeight: 700 }}>{studentName}</div>
                      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.65rem" }}>You (Participant)</div>
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: micOn ? "rgba(255,255,255,0.2)" : "rgba(220,38,38,0.75)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>
                      {micOn ? "🎤" : "🔇"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2 stacked small tiles (first 2 non-host remote or self) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Self tile when there's a host */}
              {hostTile && (
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: BG2, flex: 1, border: `2px solid ${GOLD}` }}>
                  <video ref={selfVideoRef} autoPlay playsInline muted
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraReady && camOn ? "block" : "none" }} />
                  {(!cameraReady || !camOn) && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${BG3}, ${BG2})` }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: GOLD, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 800 }}>
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)", padding: "1rem 0.5rem 0.4rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ color: WHITE, fontSize: "0.72rem", fontWeight: 700 }}>{studentName}</div>
                      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.6rem" }}>You</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: micOn ? "rgba(255,255,255,0.2)" : "rgba(220,38,38,0.75)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem" }}>
                      {micOn ? "🎤" : "🔇"}
                    </div>
                  </div>
                </div>
              )}
              {/* First other tile */}
              {otherTiles[0] && (
                <div style={{ flex: 1 }}><RemoteTile tile={otherTiles[0]} /></div>
              )}
              {/* Waiting placeholder if no second tile */}
              {!otherTiles[0] && !hostTile && (
                <div style={{ flex: 1, borderRadius: 12, background: BG2, border: "1px dashed rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>👥</span>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>Waiting…</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom row: remaining tiles */}
          {(hostTile ? otherTiles : otherTiles.slice(1)).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
              {(hostTile ? otherTiles : otherTiles.slice(1)).map((tile) => (
                <RemoteTile key={tile.identity} tile={tile} />
              ))}
            </div>
          )}

          {/* Waiting state */}
          {remoteList.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.75rem", opacity: 0.6 }}>
              <span style={{ fontSize: "3rem" }}>👥</span>
              <p style={{ margin: 0, fontWeight: 700, color: WHITE }}>Waiting for others to join…</p>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Share the meeting link to invite participants</p>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL (white card) ─────────────────────────────────── */}
        <div style={{ width: 320, borderLeft: "1px solid rgba(255,255,255,0.08)", background: OFF_W, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Tab header */}
          <div style={{ display: "flex", background: WHITE, borderBottom: `1px solid ${GRAY}`, padding: "0 0.5rem" }}>
            {(["participants", "chat", "qa"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setActiveTab(t)} style={{
                flex: 1, background: "transparent", border: "none",
                borderBottom: activeTab === t ? `2px solid ${GOLDD}` : "2px solid transparent",
                color: activeTab === t ? GOLDD : GRAY2,
                padding: "0.75rem 0.3rem", fontSize: "0.75rem", fontWeight: 700,
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem",
              }}>
                {t === "participants" && <><span>👥</span><span>Participants ({totalCount})</span></>}
                {t === "chat" && <><span>💬</span><span>Chat</span></>}
                {t === "qa" && <><span>❓</span><span>Q&A</span></>}
              </button>
            ))}
          </div>

          {/* Participants tab */}
          {activeTab === "participants" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Search */}
              <div style={{ padding: "0.75rem", borderBottom: `1px solid ${GRAY}` }}>
                <div style={{ display: "flex", alignItems: "center", background: WHITE, border: `1px solid ${GRAY}`, borderRadius: 8, padding: "0.4rem 0.65rem", gap: "0.4rem" }}>
                  <span style={{ color: GRAY2, fontSize: "0.85rem" }}>🔍</span>
                  <input placeholder="Search participants…" style={{ flex: 1, border: "none", outline: "none", fontSize: "0.8rem", color: INK, background: "transparent" }} />
                </div>
              </div>
              {/* List */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
                {/* Self */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.5rem 0.9rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: GOLD, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem", flexShrink: 0 }}>
                    {studentName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: INK }}>{studentName}</div>
                    <div style={{ fontSize: "0.65rem", color: GRAY2 }}>Participant</div>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: micOn ? GRAY2 : RED_BTN }}>{micOn ? "🎤" : "🔇"}</span>
                  <span style={{ fontSize: "0.75rem", color: GRAY2 }}>⋯</span>
                </div>
                {remoteList.map((tile) => {
                  const isHost = tile.identity.startsWith("instructor-");
                  return (
                    <div key={tile.identity} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.5rem 0.9rem" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: isHost ? WINE : GRAY, color: isHost ? WHITE : INK, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem", flexShrink: 0 }}>
                        {tile.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: INK }}>{tile.name}</div>
                        <div style={{ fontSize: "0.65rem", color: GRAY2 }}>{isHost ? "Host" : "Participant"}</div>
                      </div>
                      <span style={{ fontSize: "0.85rem", color: tile.audioPub?.track ? GRAY2 : RED_BTN }}>
                        {tile.audioPub?.track ? "🎤" : "🔇"}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: GRAY2 }}>⋯</span>
                    </div>
                  );
                })}
                <button style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", background: "transparent", border: "none", padding: "0.6rem 0.9rem", cursor: "pointer", color: WINE, fontSize: "0.8rem", fontWeight: 600 }}>
                  👥 View all participants <span style={{ marginLeft: "auto" }}>›</span>
                </button>
              </div>
            </div>
          )}

          {/* Chat tab */}
          {activeTab === "chat" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "0.65rem 0.9rem", borderBottom: `1px solid ${GRAY}` }}>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: INK }}>Meeting Chat</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 0.9rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <p style={{ margin: 0, fontSize: "0.8rem", color: GRAY2, textAlign: "center" }}>Chat messages will appear here.</p>
              </div>
              <div style={{ padding: "0.65rem", borderTop: `1px solid ${GRAY}`, display: "flex", gap: "0.5rem" }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message…"
                  style={{ flex: 1, border: `1px solid ${GRAY}`, borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: INK, outline: "none" }}
                />
                <button style={{ width: 36, height: 36, borderRadius: 8, background: GOLDD, border: "none", color: WHITE, cursor: "pointer", fontSize: "1rem" }}>
                  ➤
                </button>
              </div>
            </div>
          )}

          {/* Q&A tab */}
          {activeTab === "qa" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
              <p style={{ color: GRAY2, fontSize: "0.85rem", textAlign: "center" }}>No questions yet. Be the first to ask!</p>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ──────────────────────────────────────────── */}
      <div style={{ background: BG, borderTop: "1px solid rgba(255,255,255,0.08)", padding: "0.5rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        {/* Meeting name pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: BG2, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer" }}>
          <span style={{ fontSize: "0.85rem" }}>👥</span>
          <div>
            <div style={{ color: WHITE, fontSize: "0.75rem", fontWeight: 700 }}>General Meeting</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6rem" }}>NAK Learning Center Community</div>
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", marginLeft: "0.3rem" }}>▾</span>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          {[
            { icon: micOn ? "🎤" : "🔇",  label: "Mic",          action: toggleMic,    active: micOn },
            { icon: camOn ? "📷" : "🚫",  label: "Camera",       action: toggleCam,    active: camOn },
            { icon: "📤",                  label: "Share",        action: () => {},     active: false },
            { icon: "👥",                  label: "Participants", action: () => setActiveTab("participants"), active: activeTab === "participants" },
            { icon: "💬",                  label: "Chat",         action: () => setActiveTab("chat"), active: activeTab === "chat" },
            { icon: "⋯",                   label: "More",         action: () => {},     active: false },
          ].map(({ icon, label, action, active }) => (
            <button key={label} type="button" onClick={action} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
              background: active ? BG3 : "transparent",
              border: active ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
              color: WHITE, borderRadius: 8,
              padding: "0.45rem 0.7rem", cursor: "pointer", minWidth: 52,
            }}>
              <span style={{ fontSize: "1.15rem" }}>{icon}</span>
              <span style={{ fontSize: "0.58rem", fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.02em" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Leave button */}
        <Link href="/learning" style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          background: RED_BTN, color: WHITE,
          borderRadius: 8, padding: "0.55rem 1.2rem",
          fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
          border: "none",
        }}>
          📞 Leave Meeting
        </Link>
      </div>

      {cameraError && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#fee2e2", color: "#991b1b", padding: "0.5rem 1rem", borderRadius: 8, fontSize: "0.8rem", zIndex: 100 }}>
          {cameraError}
        </div>
      )}
    </div>
  );
}
