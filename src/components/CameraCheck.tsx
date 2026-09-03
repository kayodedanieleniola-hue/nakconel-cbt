"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalTracks, Room } from "livekit-client";

export default function CameraCheck({ attemptId }: { attemptId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<"connecting" | "ready" | "blocked">("connecting");
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    let active = true;
    if (!consented) {
      setStatus("connecting");
      return () => { active = false; };
    }
    const room = new Room();
    roomRef.current = room;

    async function connect() {
      try {
        const response = await fetch(`/api/livekit/token?attemptId=${encodeURIComponent(attemptId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Live video is unavailable");
        await room.connect(data.url, data.token);
        const tracks = await createLocalTracks({ video: true, audio: true });
        for (const track of tracks) await room.localParticipant.publishTrack(track);
        const videoTrack = tracks.find((track) => track.kind === "video");
        if (active && videoTrack && videoRef.current) videoTrack.attach(videoRef.current);
        if (active) setStatus("ready");
      } catch {
        if (active) setStatus("blocked");
        await room.disconnect();
      }
    }

    void connect();

    return () => {
      active = false;
      room.localParticipant.trackPublications.forEach((publication) => publication.track?.stop());
      void room.disconnect();
    };
  }, [attemptId, consented]);

  return (
    <aside style={panel} aria-label="Camera and microphone check">
      <div style={heading}><strong>Camera and microphone</strong><span style={{ color: status === "ready" ? "var(--success)" : "var(--danger)" }}>{status === "ready" ? "Transmitting" : status === "connecting" ? "Connecting" : "Unavailable"}</span></div>
      {!consented && <label style={consent}><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /> I consent to camera and microphone use while taking this exam.</label>}
      {status === "ready" && <video ref={videoRef} autoPlay muted playsInline style={video} />}
      <p style={help}>{status === "ready" ? "Your camera and microphone are transmitting for this exam." : status === "blocked" ? "Camera or microphone permission was not granted. Allow both in your browser and reload the exam." : consented ? "Allow camera and microphone access when your browser asks." : "Consent is required before camera and microphone access can begin."}</p>
    </aside>
  );
}

const panel = { background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: "0.9rem", marginBottom: "1rem" } as const;
const heading = { display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.9rem" } as const;
const video = { display: "block", width: "100%", maxWidth: 220, aspectRatio: "16 / 9", objectFit: "cover", background: "var(--ink-900)", borderRadius: 4, marginTop: "0.7rem" } as const;
const help = { color: "var(--ink-600)", fontSize: "0.8rem", margin: "0.55rem 0 0" } as const;
const consent = { display: "flex", alignItems: "flex-start", gap: "0.5rem", color: "var(--ink-600)", fontSize: "0.82rem", marginTop: "0.7rem" } as const;
