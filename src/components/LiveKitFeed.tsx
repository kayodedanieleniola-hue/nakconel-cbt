"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, DisconnectReason } from "livekit-client";

export default function LiveKitFeed({ attemptId }: { attemptId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    let active = true;
    let currentRoom: Room | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    async function connect() {
      const room = new Room();
      currentRoom = room;
      let reachedReady = false;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (!active) return;
        if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
        if (track.kind === Track.Kind.Audio && audioRef.current) track.attach(audioRef.current);
        setStatus("Connected");
        reachedReady = true;
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());

      // Same reasoning as the student side: only reconnect after a
      // connection has genuinely succeeded and later dropped for real —
      // never during the initial handshake (LiveKit's own internal retry
      // handles that), and never for DUPLICATE_IDENTITY (e.g. this same
      // admin viewer reconnecting too fast would otherwise collide with
      // itself and loop forever).
      room.on(RoomEvent.Disconnected, (reason) => {
        if (!active) return;
        if (!reachedReady || reason === DisconnectReason.DUPLICATE_IDENTITY) {
          setStatus("Unavailable");
          return;
        }
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setStatus("Connection lost — the student may no longer be in this exam");
          return;
        }
        reconnectAttempts += 1;
        setStatus("Reconnecting...");
        window.setTimeout(() => {
          if (active) void connect();
        }, 3000);
      });

      try {
        const response = await fetch(`/api/livekit/token?attemptId=${encodeURIComponent(attemptId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to connect");
        await room.connect(data.url, data.token);
        reconnectAttempts = 0;
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Unavailable");
      }
    }

    void connect();
    return () => {
      active = false;
      currentRoom?.removeAllListeners();
      void currentRoom?.disconnect();
    };
  }, [attemptId]);

  return <div><video ref={videoRef} autoPlay playsInline style={video} /><audio ref={audioRef} autoPlay controls style={audio} /><p style={help}>{status}</p></div>;
}

const video = { display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: "var(--ink-900)", borderRadius: 4 } as const;
const audio = { width: "100%", marginTop: "0.5rem" } as const;
const help = { color: "var(--ink-600)", fontSize: "0.8rem" } as const;
