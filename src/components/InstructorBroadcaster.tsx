"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createLocalTracks,
  LocalTrack,
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  VideoPresets,
} from "livekit-client";
import ClassroomChat from "@/components/ClassroomChat";
import { LocalClassroomPeer } from "@/lib/localP2P";

// ── Per-student live video tile ───────────────────────────────────────────────
// Isolated component so the <video> element is stable across re-renders.
// React never re-creates it on unrelated state changes, which would
// detach the LiveKit track and blank the feed.

type StudentTile = {
  identity: string;
  name: string;
  videoPublication: RemoteTrackPublication | null;
};

function StudentVideoTile({ tile }: { tile: StudentTile }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const pub = tile.videoPublication;
    if (!pub?.track) return;
    if (videoRef.current) {
      pub.track.attach(videoRef.current);
      void videoRef.current.play().catch(() => {});
    }
    return () => {
      if (videoRef.current) pub.track?.detach(videoRef.current);
    };
  }, [tile.videoPublication]);

  return (
    <div style={tileCard}>
      <div style={tileVideoWrap}>
        {tile.videoPublication?.track ? (
          <video ref={videoRef} autoPlay playsInline muted style={tileVideo} />
        ) : (
          <div style={tileNoVideo}>
            <span style={tileAvatarIcon}>👤</span>
            <span style={tileNoVideoText}>Camera connecting…</span>
          </div>
        )}
        <span style={tileLiveDot}>● LIVE</span>
      </div>
      <span style={tileName}>{tile.name}</span>
    </div>
  );
}

// ── Main InstructorBroadcaster ────────────────────────────────────────────────

export default function InstructorBroadcaster({
  classId,
  classTitle,
  onClose,
}: {
  classId: string;
  classTitle: string;
  onClose: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const p2pRef = useRef<LocalClassroomPeer | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  const [quality, setQuality] = useState<"4k" | "1080p" | "720p" | "480p">("1080p");
  const [status, setStatus] = useState("Initializing camera & microphone…");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Live student tiles keyed by participant identity
  const [studentTiles, setStudentTiles] = useState<Record<string, StudentTile>>({});

  // Hand-raise (BroadcastChannel / same-machine signalling)
  const [raisedHands, setRaisedHands] = useState<Record<string, string>>({});

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsStr, setPollOptionsStr] = useState("Yes, No, Needs Clarification");

  const getResolutionPreset = (preset: "4k" | "1080p" | "720p" | "480p") => {
    switch (preset) {
      case "4k":    return VideoPresets.h2160.resolution;
      case "1080p": return VideoPresets.h1080.resolution;
      case "720p":  return VideoPresets.h720.resolution;
      case "480p":  return { width: 854, height: 480, frameRate: 30 };
    }
  };

  // Seed tile map from participants already in the room when we join
  const syncTiles = useCallback((room: Room) => {
    setStudentTiles(() => {
      const next: Record<string, StudentTile> = {};
      for (const [identity, rp] of Array.from(room.remoteParticipants.entries())) {
        if (identity.startsWith("instructor-")) continue;
        let videoPub: RemoteTrackPublication | null = null;
        for (const pub of Array.from(rp.trackPublications.values())) {
          if (pub.kind === Track.Kind.Video && pub.isSubscribed && pub.track) {
            videoPub = pub;
            break;
          }
        }
        next[identity] = {
          identity,
          name: rp.name || identity.replace(/^student-/, ""),
          videoPublication: videoPub,
        };
      }
      return next;
    });
  }, []);

  // ── Broadcast effect ──────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    let fallbackInterval: NodeJS.Timeout | undefined;
    let pingInterval: NodeJS.Timeout | undefined;
    let bc: BroadcastChannel | undefined;

    // BroadcastChannel — same-machine tab signalling + JPEG fallback frames
    try {
      bc = new BroadcastChannel(`nak-classroom-${classId}`);
      bcRef.current = bc;
      bc.postMessage({ type: "INSTRUCTOR_PING" });

      pingInterval = setInterval(() => {
        bc?.postMessage({ type: "INSTRUCTOR_PING" });
      }, 3000);

      bc.onmessage = (event) => {
        if (!active) return;
        const d = event.data;
        if (!d) return;
        if (d.type === "RAISE_HAND" && d.identity) {
          setRaisedHands((prev) => ({ ...prev, [d.identity]: d.name || d.identity }));
        } else if (d.type === "LOWER_HAND" && d.identity) {
          setRaisedHands((prev) => {
            const next = { ...prev };
            delete next[d.identity];
            return next;
          });
        }
      };
    } catch {
      // BroadcastChannel unsupported
    }

    async function startBroadcast() {
      try {
        // 1. Capture instructor camera + mic
        const tracks = await createLocalTracks({
          audio: true,
          video: { resolution: getResolutionPreset(quality) },
        });
        localTracksRef.current = tracks;

        const mediaTracks = tracks.map((t) => t.mediaStreamTrack);
        const localStream = new MediaStream(mediaTracks);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          void localVideoRef.current.play().catch(() => {});
        }
        for (const track of tracks) {
          if (track.kind === "video" && localVideoRef.current) {
            track.attach(localVideoRef.current);
            void localVideoRef.current.play().catch(() => {});
          }
        }

        // 2. Local P2P for same-machine student audio
        try {
          const peer = new LocalClassroomPeer(classId, "instructor");
          p2pRef.current = peer;
          peer.addLocalStream(localStream);
          peer.onRemoteStream = (remoteStream) => {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
              void remoteAudioRef.current.play().catch(() => {});
            }
          };
        } catch {
          // P2P not available
        }

        if (active) {
          setStatus("BROADCASTING LIVE");
          setIsBroadcasting(true);
          void fetch("/api/admin/learning", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "class", id: classId, title: classTitle, status: "LIVE" }),
          }).catch(() => {});
        }

        // 3. BroadcastChannel JPEG frames for same-machine students
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        fallbackInterval = setInterval(() => {
          try {
            const video = localVideoRef.current;
            if (video && bcRef.current) {
              canvas.width = 640;
              canvas.height = 360;
              ctx?.drawImage(video, 0, 0, 640, 360);
              const frame = canvas.toDataURL("image/jpeg", 0.6);
              if (frame && frame.length > 100) {
                bcRef.current.postMessage({ type: "FRAME", frame, quality });
              }
            }
          } catch {
            // Frame capture retry
          }
        }, 100);

        // 4. Connect to LiveKit and subscribe to student tracks
        try {
          const res = await fetch(
            `/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`
          );
          const data = await res.json();
          if (!res.ok || !data.url || !data.token) throw new Error("LiveKit not configured");

          const room = new Room();
          roomRef.current = room;

          // New student joins → add tile immediately, no manual accept needed
          room.on(RoomEvent.ParticipantConnected, (rp: RemoteParticipant) => {
            if (!active || rp.identity.startsWith("instructor-")) return;
            setStudentTiles((prev) => ({
              ...prev,
              [rp.identity]: {
                identity: rp.identity,
                name: rp.name || rp.identity.replace(/^student-/, ""),
                videoPublication: null,
              },
            }));
          });

          // Student disconnects → remove tile
          room.on(RoomEvent.ParticipantDisconnected, (rp: RemoteParticipant) => {
            if (!active) return;
            setStudentTiles((prev) => {
              const next = { ...prev };
              delete next[rp.identity];
              return next;
            });
          });

          // Student's video track becomes available → attach to their tile
          room.on(RoomEvent.TrackSubscribed, (_track, pub, rp: RemoteParticipant) => {
            if (!active || rp.identity.startsWith("instructor-")) return;
            if (pub.kind !== Track.Kind.Video) return;
            setStudentTiles((prev) => {
              if (!prev[rp.identity]) return prev;
              return { ...prev, [rp.identity]: { ...prev[rp.identity], videoPublication: pub } };
            });
          });

          // Student's video removed → show placeholder
          room.on(RoomEvent.TrackUnsubscribed, (_track, pub, rp: RemoteParticipant) => {
            if (!active || pub.kind !== Track.Kind.Video) return;
            setStudentTiles((prev) => {
              if (!prev[rp.identity]) return prev;
              return { ...prev, [rp.identity]: { ...prev[rp.identity], videoPublication: null } };
            });
          });

          await room.connect(data.url, data.token);

          // Publish instructor tracks
          for (const track of tracks) {
            if (track.kind === "video") {
              await room.localParticipant.publishTrack(track, { simulcast: true });
            } else {
              await room.localParticipant.publishTrack(track);
            }
          }

          // Seed tiles for students already in the room when we join
          if (active) syncTiles(room);
        } catch {
          // LiveKit not configured — BroadcastChannel fallback continues
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : "Failed to start broadcast";
          setErrorMsg(msg);
          setStatus("Broadcast failed");
        }
      }
    }

    void startBroadcast();

    return () => {
      active = false;
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (pingInterval) clearInterval(pingInterval);
      if (p2pRef.current) { p2pRef.current.destroy(); p2pRef.current = null; }
      if (bc) { bc.postMessage({ type: "STOP" }); bc.close(); }
      for (const track of localTracksRef.current) { track.stop(); track.detach(); }
      localTracksRef.current = [];
      roomRef.current?.removeAllListeners();
      void roomRef.current?.disconnect();
    };
  }, [classId, quality, syncTiles]);

  // ── Camera / mic controls ─────────────────────────────────────────────────

  const toggleCamera = () => {
    const vt = localTracksRef.current.find((t) => t.kind === "video");
    if (!vt) return;
    if (cameraOn) { vt.mute(); setCameraOn(false); }
    else          { vt.unmute(); setCameraOn(true); }
  };

  const toggleMic = () => {
    const at = localTracksRef.current.find((t) => t.kind === "audio");
    if (!at) return;
    if (micOn) { at.mute(); setMicOn(false); }
    else       { at.unmute(); setMicOn(true); }
  };

  const studentCount = Object.keys(studentTiles).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={overlay}>
      <div style={modalCard}>

        {/* Header */}
        <div style={modalHeader}>
          <div>
            <span style={liveTag}>INSTRUCTOR LIVE STUDIO</span>
            <h3 style={modalTitle}>{classTitle}</h3>
          </div>
          <button type="button" onClick={onClose} style={closeBtn}>
            Close
          </button>
        </div>

        <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />

        {/* Hand-raise notifications */}
        {Object.keys(raisedHands).length > 0 && (
          <div style={handRaiseBanner}>
            <div style={{ flex: 1 }}>
              <strong style={{ color: "#ffd98a", fontSize: "0.85rem" }}>
                ✋ Hand Raised ({Object.keys(raisedHands).length})
              </strong>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "#f3eee7" }}>
                {Object.values(raisedHands).join(", ")} raised their hand
              </p>
            </div>
          </div>
        )}

        {/* Instructor preview */}
        <div style={previewStage}>
          <video ref={localVideoRef} autoPlay playsInline muted style={previewVideo} />
          {!cameraOn && (
            <div style={cameraOffOverlay}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#a38b80" }}>Camera is OFF</p>
            </div>
          )}
          <div style={statusOverlay}>
            <span style={{ ...statusBadge, ...(isBroadcasting ? liveBadge : alertBadge) }}>
              {isBroadcasting ? `● LIVE (${quality.toUpperCase()} · SIMULCAST)` : status}
            </span>
          </div>
        </div>

        {errorMsg && <p style={errorNotice}>{errorMsg}</p>}

        {/* ── Live student video grid ───────────────────────────────────── */}
        <div style={studentGridSection}>
          <div style={studentGridHeader}>
            <span style={sectionLabel}>Connected Students ({studentCount})</span>
            {studentCount === 0 && (
              <span style={noStudentsNote}>Waiting for students to join…</span>
            )}
          </div>

          {studentCount > 0 && (
            <div style={studentGrid}>
              {Object.values(studentTiles).map((tile) => (
                <StudentVideoTile key={tile.identity} tile={tile} />
              ))}
            </div>
          )}
        </div>

        {/* Resolution selector */}
        <div style={qualitySelectorRow}>
          <label style={sectionLabel}>Broadcast Resolution:</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as "4k" | "1080p" | "720p" | "480p")}
            style={qualitySelect}
          >
            <option value="4k">4K Ultra HD (3840 × 2160) — Max Clarity</option>
            <option value="1080p">1080p Full HD (1920 × 1080)</option>
            <option value="720p">720p HD (1280 × 720) — Balanced</option>
            <option value="480p">480p SD (854 × 480) — Low Bandwidth</option>
          </select>
        </div>

        {/* Chat */}
        <div style={chatSection}>
          <label style={sectionLabel}>Live Studio Chat &amp; Q&amp;A:</label>
          <ClassroomChat
            classId={classId}
            room={roomRef.current}
            isInstructor={true}
            userId="instructor-admin"
            userName="Instructor (Host)"
          />
        </div>

        {/* Controls */}
        <div style={controlsRow}>
          <button
            type="button"
            onClick={toggleCamera}
            style={{ ...ctrlBtn, ...(cameraOn ? activeCtrlBtn : mutedCtrlBtn) }}
          >
            {cameraOn ? "Camera ON" : "Camera OFF"}
          </button>
          <button
            type="button"
            onClick={toggleMic}
            style={{ ...ctrlBtn, ...(micOn ? activeCtrlBtn : mutedCtrlBtn) }}
          >
            {micOn ? "Microphone ON" : "Microphone Muted"}
          </button>
          <button
            type="button"
            onClick={() => setShowPollModal(true)}
            style={{ ...ctrlBtn, background: "#98661B", color: "#fff" }}
          >
            Launch Live Poll
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/admin/learning", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "class",
                    id: classId,
                    title: classTitle,
                    status: "COMPLETED",
                    recordingUrl: "/sample-replay.mp4",
                  }),
                });
              } catch { /* DB sync error */ }
              onClose();
            }}
            style={endBtn}
          >
            End Broadcast
          </button>
        </div>

        {/* Live Poll Modal */}
        {showPollModal && (
          <div style={pollOverlay}>
            <div style={pollCard}>
              <h4 style={{ margin: "0 0 0.5rem", color: "#ffd98a", fontSize: "1.1rem" }}>
                Launch In-Class Live Poll
              </h4>
              <p style={{ margin: "0 0 0.8rem", fontSize: "0.8rem", color: "#b08585" }}>
                Ask enrolled students a question in real-time during your live lecture.
              </p>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="e.g., Do you understand the concept covered so far?"
                style={pollInput}
              />
              <label style={{ display: "block", fontSize: "0.75rem", color: "#ffd98a", margin: "0.6rem 0 0.2rem" }}>
                Answer Options (comma-separated):
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
                        body: JSON.stringify({
                          action: "CREATE_POLL",
                          classId,
                          question: pollQuestion.trim(),
                          options,
                        }),
                      });
                      const data = await res.json();
                      if (data.poll && bcRef.current) {
                        bcRef.current.postMessage({ type: "LIVE_POLL", poll: data.poll });
                      }
                      setShowPollModal(false);
                      setPollQuestion("");
                    } catch { /* Poll launch error */ }
                  }}
                  style={pollSubmitBtn}
                >
                  Broadcast Poll Live
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "1rem",
  overflowY: "auto",
};

const modalCard: React.CSSProperties = {
  background: "#1e1312",
  border: "1px solid #98661B",
  borderRadius: 10,
  padding: "1.2rem",
  width: "100%",
  maxWidth: 780,
  color: "#f3eee7",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const liveTag: React.CSSProperties = {
  color: "#98661B",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
};

const modalTitle: React.CSSProperties = {
  margin: "0.2rem 0 0",
  fontSize: "1.15rem",
  color: "#fff",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #4a2725",
  color: "#a38b80",
  borderRadius: 4,
  padding: "0.35rem 0.65rem",
  fontSize: "0.8rem",
  cursor: "pointer",
};

const previewStage: React.CSSProperties = {
  position: "relative",
  background: "#100707",
  border: "1px solid #3b2220",
  borderRadius: 8,
  aspectRatio: "16 / 9",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const previewVideo: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const cameraOffOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "#120a09",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const statusOverlay: React.CSSProperties = {
  position: "absolute",
  top: "0.6rem",
  left: "0.6rem",
};

const statusBadge: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  padding: "0.25rem 0.6rem",
  borderRadius: 4,
};

const liveBadge: React.CSSProperties = {
  background: "#4d1010",
  color: "#4dff88",
  border: "1px solid #2e5938",
};

const alertBadge: React.CSSProperties = {
  background: "#331a08",
  color: "#ffd98a",
  border: "1px solid #98661B",
};

const errorNotice: React.CSSProperties = {
  color: "#ff6b6b",
  fontSize: "0.82rem",
  margin: 0,
};

const handRaiseBanner: React.CSSProperties = {
  background: "#3d1f05",
  border: "1px solid #98661B",
  borderRadius: 6,
  padding: "0.6rem 0.8rem",
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
};

const studentGridSection: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  background: "#180c0b",
  border: "1px solid #3b2220",
  borderRadius: 8,
  padding: "0.85rem",
};

const studentGridHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const noStudentsNote: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#8c766b",
  fontStyle: "italic",
};

const studentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: "0.75rem",
};

const tileCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.4rem",
};

const tileVideoWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  background: "#100707",
  border: "1px solid #3b2220",
  borderRadius: 6,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const tileVideo: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const tileNoVideo: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.3rem",
};

const tileAvatarIcon: React.CSSProperties = { fontSize: "1.8rem" };

const tileNoVideoText: React.CSSProperties = {
  fontSize: "0.68rem",
  color: "#8c766b",
};

const tileLiveDot: React.CSSProperties = {
  position: "absolute",
  top: "0.3rem",
  right: "0.3rem",
  fontSize: "0.6rem",
  fontWeight: 700,
  color: "#4dff88",
  background: "rgba(0,0,0,0.6)",
  padding: "0.1rem 0.3rem",
  borderRadius: 3,
};

const tileName: React.CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "#f3eee7",
  textAlign: "center",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#ffd98a",
  fontWeight: 600,
};

const qualitySelectorRow: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const qualitySelect: React.CSSProperties = {
  background: "#100707",
  color: "#fff",
  border: "1px solid #98661B",
  borderRadius: 6,
  padding: "0.55rem 0.7rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  outline: "none",
};

const chatSection: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const controlsRow: React.CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  flexWrap: "wrap",
};

const ctrlBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.65rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
};

const activeCtrlBtn: React.CSSProperties = {
  background: "#331614",
  borderColor: "#98661B",
  color: "#ffd98a",
};

const mutedCtrlBtn: React.CSSProperties = {
  background: "#180c0b",
  borderColor: "#3b2220",
  color: "#8c766b",
};

const endBtn: React.CSSProperties = {
  background: "#4d1010",
  border: "1px solid #ff4d4d",
  color: "#fff",
  padding: "0.65rem 1rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

const pollOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
};

const pollCard: React.CSSProperties = {
  background: "#220c0c",
  border: "1px solid #98661B",
  borderRadius: 10,
  padding: "1.25rem",
  width: "420px",
  maxWidth: "100%",
  color: "#fff",
};

const pollInput: React.CSSProperties = {
  width: "100%",
  background: "#120505",
  border: "1px solid #4d1c1c",
  borderRadius: 6,
  padding: "0.55rem 0.75rem",
  color: "#fff",
  fontSize: "0.85rem",
  boxSizing: "border-box",
};

const pollCancelBtn: React.CSSProperties = {
  background: "#331010",
  color: "#ff9999",
  border: "none",
  borderRadius: 6,
  padding: "0.45rem 0.85rem",
  fontSize: "0.82rem",
  cursor: "pointer",
};

const pollSubmitBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #98661B, #d4af37)",
  color: "#1a0808",
  border: "none",
  borderRadius: 6,
  padding: "0.45rem 0.95rem",
  fontSize: "0.82rem",
  fontWeight: 800,
  cursor: "pointer",
};
