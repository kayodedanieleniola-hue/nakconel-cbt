"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

export default function LiveKitFeed({ attemptId }: { attemptId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    let active = true;
    const room = new Room();

    async function connect() {
      try {
        const response = await fetch(`/api/livekit/token?attemptId=${encodeURIComponent(attemptId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to connect");
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (!active) return;
          if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
          if (track.kind === Track.Kind.Audio && audioRef.current) track.attach(audioRef.current);
          setStatus("Connected");
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
        await room.connect(data.url, data.token);
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Unavailable");
      }
    }

    void connect();
    return () => {
      active = false;
      room.removeAllListeners();
      void room.disconnect();
    };
  }, [attemptId]);

  return <div><video ref={videoRef} autoPlay playsInline style={video} /><audio ref={audioRef} autoPlay controls style={audio} /><p style={help}>{status}</p></div>;
}

const video = { display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: "var(--ink-900)", borderRadius: 4 } as const;
const audio = { width: "100%", marginTop: "0.5rem" } as const;
const help = { color: "var(--ink-600)", fontSize: "0.8rem" } as const;
