"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalTracks, LocalTrack, Room, RoomEvent, VideoPresets } from "livekit-client";
import ClassroomChat from "@/components/ClassroomChat";
import { LocalClassroomPeer } from "@/lib/localP2P";

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

  const [quality, setQuality] = useState<"4k" | "1080p" | "720p" | "480p">("1080p");
  const [status, setStatus] = useState("Initializing camera & microphone...");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const getResolutionPreset = (preset: "4k" | "1080p" | "720p" | "480p") => {
    switch (preset) {
      case "4k":
        return VideoPresets.h2160.resolution;
      case "1080p":
        return VideoPresets.h1080.resolution;
      case "720p":
        return VideoPresets.h720.resolution;
      case "480p":
        return { width: 854, height: 480, frameRate: 30 };
    }
  };

  const [remoteParticipants, setRemoteParticipants] = useState<{ identity: string; name: string; canVideo: boolean }[]>([]);
  const [permittedStudents, setPermittedStudents] = useState<Record<string, boolean>>({});
  const [raisedHands, setRaisedHands] = useState<Record<string, string>>({}); // identity -> name
  const [studentFrames, setStudentFrames] = useState<Record<string, string>>({}); // identity -> base64 frame

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsStr, setPollOptionsStr] = useState("Yes, No, Needs Clarification");

  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let active = true;
    let fallbackInterval: NodeJS.Timeout | undefined;
    let pingInterval: NodeJS.Timeout | undefined;
    let bc: BroadcastChannel | undefined;

    try {
      bc = new BroadcastChannel(`nak-classroom-${classId}`);
      bcRef.current = bc;
      bc.postMessage({ type: "INSTRUCTOR_PING" });

      pingInterval = setInterval(() => {
        if (bc) bc.postMessage({ type: "INSTRUCTOR_PING" });
      }, 3000);

      bc.onmessage = (event) => {
        if (!active) return;
        const data = event.data;
        if (!data) return;

        if (data.type === "STUDENT_JOIN" && data.identity) {
          setRemoteParticipants((prev) => {
            if (prev.some((p) => p.identity === data.identity)) return prev;
            return [...prev, { identity: data.identity, name: data.name || data.identity, canVideo: !!permittedStudents[data.identity] }];
          });
        } else if (data.type === "RAISE_HAND" && data.identity) {
          setRaisedHands((prev) => ({ ...prev, [data.identity]: data.name || data.identity }));
        } else if (data.type === "LOWER_HAND" && data.identity) {
          setRaisedHands((prev) => {
            const next = { ...prev };
            delete next[data.identity];
            return next;
          });
        } else if (data.type === "STUDENT_FRAME" && data.identity && data.frame) {
          setStudentFrames((prev) => ({ ...prev, [data.identity]: data.frame }));
        }
      };
    } catch {
      // BroadcastChannel unsupported
    }

    async function startBroadcast() {
      // Capture local camera & mic tracks first so video renders locally immediately
      try {
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

        // Initialize 2-Way Local WebRTC P2P Call
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
          // P2P initialization fallback
        }

        if (active) {
          setStatus("BROADCASTING LIVE");
          setIsBroadcasting(true);
          // Sync LIVE status with backend DB
          void fetch("/api/admin/learning", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "class",
              id: classId,
              title: classTitle,
              status: "LIVE",
            }),
          }).catch(() => {});
        }

        // Setup local BroadcastChannel fallback stream
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

        // Connect to LiveKit server if credentials are configured
        try {
          const response = await fetch(`/api/learning/livekit/token?classId=${encodeURIComponent(classId)}`);
          const data = await response.json();
          if (response.ok && data.url && data.token) {
            const room = new Room();
            roomRef.current = room;

            const updateRoster = () => {
              if (!active) return;
              const list: { identity: string; name: string; canVideo: boolean }[] = [];
              for (const rp of Array.from(room.remoteParticipants.values())) {
                list.push({
                  identity: rp.identity,
                  name: rp.name || rp.identity,
                  canVideo: !!permittedStudents[rp.identity],
                });
              }
              setRemoteParticipants(list);
            };

            room.on(RoomEvent.ParticipantConnected, updateRoster);
            room.on(RoomEvent.ParticipantDisconnected, updateRoster);

            await room.connect(data.url, data.token);

            for (const track of tracks) {
              if (track.kind === "video") {
                await room.localParticipant.publishTrack(track, { simulcast: true });
              } else {
                await room.localParticipant.publishTrack(track);
              }
            }
          }
        } catch {
          // LiveKit cloud server not configured — local fallback continues
        }
      } catch (err) {
        console.error("Instructor broadcast error:", err);
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
      if (p2pRef.current) p2pRef.current.destroy();
      if (bc) {
        bc.postMessage({ type: "STOP" });
        bc.close();
      }
      for (const track of localTracksRef.current) {
        track.stop();
        track.detach();
      }
      roomRef.current?.removeAllListeners();
      void roomRef.current?.disconnect();
    };
  }, [classId, quality]);

  const toggleVideoPermission = async (targetIdentity: string) => {
    const nextState = !permittedStudents[targetIdentity];
    setPermittedStudents((prev) => ({ ...prev, [targetIdentity]: nextState }));

    // Lower student hand if permission is granted
    if (nextState) {
      setRaisedHands((prev) => {
        const next = { ...prev };
        delete next[targetIdentity];
        return next;
      });
    }

    if (bcRef.current) {
      bcRef.current.postMessage({
        type: nextState ? "GRANT_VIDEO" : "REVOKE_VIDEO",
        targetIdentity,
      });
    }

    if (roomRef.current) {
      
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: nextState ? "GRANT_VIDEO" : "REVOKE_VIDEO",
          targetIdentity,
        })
      );
      await roomRef.current.localParticipant.publishData(payload, { reliable: true });
    }
  };

  const toggleCamera = () => {
    const videoTrack = localTracksRef.current.find((t) => t.kind === "video");
    if (videoTrack) {
      if (cameraOn) {
        videoTrack.mute();
        setCameraOn(false);
      } else {
        videoTrack.unmute();
        setCameraOn(true);
      }
    }
  };

  const toggleMic = () => {
    const audioTrack = localTracksRef.current.find((t) => t.kind === "audio");
    if (audioTrack) {
      if (micOn) {
        audioTrack.mute();
        setMicOn(false);
      } else {
        audioTrack.unmute();
        setMicOn(true);
      }
    }
  };

  return (
    <div style={overlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <span style={liveTag}>INSTRUCTOR LIVE STUDIO (PHASE 8: ADAPTIVE 4K & LIVE MONITOR)</span>
            <h3 style={modalTitle}>{classTitle}</h3>
          </div>
          <button type="button" onClick={onClose} style={closeBtn}>
            ✕ Close
          </button>
        </div>

        <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />

        {/* Hand Raise Live Notifications */}
        {Object.keys(raisedHands).length > 0 && (
          <div style={handRaiseBanner}>
            <span style={{ fontSize: "1.2rem" }}>✋</span>
            <div style={{ flex: 1 }}>
              <strong style={{ color: "#ffd98a", fontSize: "0.85rem" }}>
                Question / Hand Raised ({Object.keys(raisedHands).length})
              </strong>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "#f3eee7" }}>
                {Object.values(raisedHands).join(", ")} raised their hand to ask a question!
              </p>
            </div>
            {Object.keys(raisedHands).map((identity) => (
              <button
                key={identity}
                type="button"
                onClick={() => toggleVideoPermission(identity)}
                style={grantHandBtn}
              >
                📹 Grant Video & Speaking
              </button>
            ))}
          </div>
        )}

        <div style={previewStage}>
          <video ref={localVideoRef} autoPlay playsInline muted style={previewVideo} />

          {!cameraOn && (
            <div style={cameraOffOverlay}>
              <span style={{ fontSize: "2rem" }}>📷</span>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#a38b80" }}>
                Camera is turned OFF
              </p>
            </div>
          )}

          <div style={statusOverlay}>
            <span style={{ ...statusBadge, ...(isBroadcasting ? liveBadge : alertBadge) }}>
              {isBroadcasting
                ? `● LIVE (${quality.toUpperCase()} · ADAPTIVE SIMULCAST)`
                : status}
            </span>
          </div>
        </div>

        {errorMsg && <p style={errorNotice}>{errorMsg}</p>}

        {/* Live Student Monitor Grid (like CBT Exam Live Monitor) */}
        {Object.keys(studentFrames).length > 0 && (
          <div style={studentGridSection}>
            <label style={qualityLabel}>Live Student Video Grid ({Object.keys(studentFrames).length} Active):</label>
            <div style={studentGrid}>
              {Object.entries(studentFrames).map(([id, frame]) => (
                <div key={id} style={studentCard}>
                  <img src={frame} alt="Student Feed" style={studentVideoFrame} />
                  <span style={studentCardBadge}>🎓 {id.replace("student-", "")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolution Quality Selector */}
        <div style={qualitySelectorRow}>
          <label style={qualityLabel}>Broadcast Resolution & Quality:</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as "4k" | "1080p" | "720p" | "480p")}
            style={qualitySelect}
          >
            <option value="4k">✨ 4K Ultra HD (3840 × 2160 @ 30fps) - Max Clarity</option>
            <option value="1080p">📺 1080p Full HD (1920 × 1080 @ 30fps)</option>
            <option value="720p">⚡ 720p HD (1280 × 720 @ 30fps) - Balanced</option>
            <option value="480p">📶 480p SD (854 × 480 @ 30fps) - Low Bandwidth</option>
          </select>
        </div>

        {/* Phase 9: Student Video Permissions Manager */}
        <div style={permSection}>
          <label style={qualityLabel}>Connected Students & Video Permissions ({remoteParticipants.length}):</label>
          {remoteParticipants.length === 0 ? (
            <p style={permEmptyText}>No students currently connected to live classroom.</p>
          ) : (
            <div style={permList}>
              {remoteParticipants.map((p) => {
                const isPermitted = permittedStudents[p.identity];
                return (
                  <div key={p.identity} style={permRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span>🎓</span>
                      <strong style={{ fontSize: "0.85rem", color: "#fff" }}>{p.name}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleVideoPermission(p.identity)}
                      style={{ ...permBtn, ...(isPermitted ? permRevokeBtn : permGrantBtn) }}
                    >
                      {isPermitted ? "🚫 Revoke Video Permission" : "📹 Grant Video Permission"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Phase 10: Live Classroom Chat & Moderated Q&A */}
        <div style={chatSection}>
          <label style={qualityLabel}>Live Studio Chat & Moderated Q&A:</label>
          <ClassroomChat
            classId={classId}
            room={roomRef.current}
            isInstructor={true}
            userId="instructor-admin"
            userName="Instructor (Host)"
          />
        </div>

        <div style={controlsRow}>
          <button
            type="button"
            onClick={toggleCamera}
            style={{ ...ctrlBtn, ...(cameraOn ? activeCtrlBtn : mutedCtrlBtn) }}
          >
            {cameraOn ? "📷 Camera ON" : "📷 Camera OFF"}
          </button>

          <button
            type="button"
            onClick={toggleMic}
            style={{ ...ctrlBtn, ...(micOn ? activeCtrlBtn : mutedCtrlBtn) }}
          >
            {micOn ? "🎙️ Microphone ON" : "🎙️ Microphone Muted"}
          </button>

          <button
            type="button"
            onClick={() => setShowPollModal(true)}
            style={{ ...ctrlBtn, background: "#98661B", color: "#fff" }}
          >
            📊 Launch Live Poll
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
              } catch {
                // DB sync error
              }
              onClose();
            }}
            style={endBtn}
          >
            ⏹️ End Broadcast
          </button>
        </div>

        {/* Live Poll Creation Modal */}
        {showPollModal && (
          <div style={pollOverlay}>
            <div style={pollCard}>
              <h4 style={{ margin: "0 0 0.5rem", color: "#ffd98a", fontSize: "1.1rem" }}>📊 Launch In-Class Live Poll</h4>
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
                    } catch {
                      // Poll launch error
                    }
                  }}
                  style={pollSubmitBtn}
                >
                  🚀 Broadcast Poll Live
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const pollOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
} as const;

const pollCard = {
  background: "#220c0c",
  border: "1px solid #98661B",
  borderRadius: 10,
  padding: "1.25rem",
  width: "420px",
  maxWidth: "100%",
  color: "#fff",
} as const;

const pollInput = {
  width: "100%",
  background: "#120505",
  border: "1px solid #4d1c1c",
  borderRadius: 6,
  padding: "0.55rem 0.75rem",
  color: "#fff",
  fontSize: "0.85rem",
} as const;

const pollCancelBtn = {
  background: "#331010",
  color: "#ff9999",
  border: "none",
  borderRadius: 6,
  padding: "0.45rem 0.85rem",
  fontSize: "0.82rem",
  cursor: "pointer",
} as const;

const pollSubmitBtn = {
  background: "linear-gradient(135deg, #98661B, #d4af37)",
  color: "#1a0808",
  border: "none",
  borderRadius: 6,
  padding: "0.45rem 0.95rem",
  fontSize: "0.82rem",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "1rem",
} as const;

const modalCard = {
  background: "#1e1312",
  border: "1px solid #98661B",
  borderRadius: 10,
  padding: "1.2rem",
  width: "100%",
  maxWidth: 640,
  color: "#f3eee7",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
} as const;

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
} as const;

const liveTag = {
  color: "#98661B",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
} as const;

const modalTitle = {
  margin: "0.2rem 0 0",
  fontSize: "1.15rem",
  color: "#fff",
} as const;

const closeBtn = {
  background: "transparent",
  border: "1px solid #4a2725",
  color: "#a38b80",
  borderRadius: 4,
  padding: "0.35rem 0.65rem",
  fontSize: "0.8rem",
  cursor: "pointer",
} as const;

const previewStage = {
  position: "relative",
  background: "#100707",
  border: "1px solid #3b2220",
  borderRadius: 8,
  aspectRatio: "16 / 9",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

const previewVideo = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const;

const cameraOffOverlay = {
  position: "absolute",
  inset: 0,
  background: "#120a09",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
} as const;

const statusOverlay = {
  position: "absolute",
  top: "0.6rem",
  left: "0.6rem",
} as const;

const statusBadge = {
  fontSize: "0.75rem",
  fontWeight: 700,
  padding: "0.25rem 0.6rem",
  borderRadius: 4,
} as const;

const liveBadge = {
  background: "#4d1010",
  color: "#4dff88",
  border: "1px solid #2e5938",
} as const;

const alertBadge = {
  background: "#331a08",
  color: "#ffd98a",
  border: "1px solid #98661B",
} as const;

const errorNotice = {
  color: "#ff6b6b",
  fontSize: "0.82rem",
  margin: 0,
} as const;

const controlsRow = {
  display: "flex",
  gap: "0.6rem",
  flexWrap: "wrap",
} as const;

const ctrlBtn = {
  flex: 1,
  padding: "0.65rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
} as const;

const activeCtrlBtn = {
  background: "#331614",
  borderColor: "#98661B",
  color: "#ffd98a",
} as const;

const mutedCtrlBtn = {
  background: "#180c0b",
  borderColor: "#3b2220",
  color: "#8c766b",
} as const;

const endBtn = {
  background: "#4d1010",
  borderColor: "#ff4d4d",
  color: "#fff",
  padding: "0.65rem 1rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
} as const;

const qualitySelectorRow = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
} as const;

const qualityLabel = {
  fontSize: "0.8rem",
  color: "#ffd98a",
  fontWeight: 600,
} as const;

const qualitySelect = {
  background: "#100707",
  color: "#fff",
  border: "1px solid #98661B",
  borderRadius: 6,
  padding: "0.55rem 0.7rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  outline: "none",
} as const;

const permSection = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
  background: "#180c0b",
  border: "1px solid #3b2220",
  borderRadius: 6,
  padding: "0.75rem",
} as const;

const permEmptyText = {
  fontSize: "0.8rem",
  color: "#8c766b",
  margin: 0,
  fontStyle: "italic",
} as const;

const permList = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
} as const;

const permRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#241211",
  padding: "0.4rem 0.6rem",
  borderRadius: 4,
} as const;

const permBtn = {
  borderRadius: 4,
  padding: "0.3rem 0.55rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
} as const;

const permGrantBtn = {
  background: "#98661B",
  color: "#fff",
} as const;

const permRevokeBtn = {
  background: "#4d1010",
  color: "#ff4d4d",
  border: "1px solid #ff4d4d",
} as const;

const handRaiseBanner = {
  background: "#3d1f05",
  border: "1px solid #98661B",
  borderRadius: 6,
  padding: "0.6rem 0.8rem",
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
} as const;

const grantHandBtn = {
  background: "#98661B",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  padding: "0.35rem 0.65rem",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const studentGridSection = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
} as const;

const studentGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: "0.5rem",
} as const;

const studentCard = {
  position: "relative",
  background: "#100707",
  border: "1px solid #98661B",
  borderRadius: 6,
  aspectRatio: "16 / 9",
  overflow: "hidden",
} as const;

const studentVideoFrame = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const;

const studentCardBadge = {
  position: "absolute",
  bottom: "0.2rem",
  left: "0.2rem",
  background: "rgba(0,0,0,0.75)",
  color: "#ffd98a",
  padding: "0.1rem 0.3rem",
  borderRadius: 3,
  fontSize: "0.65rem",
  fontWeight: 600,
} as const;

const chatSection = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
} as const;
