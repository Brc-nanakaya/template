export type RealtimeEventHandler = (event: unknown) => void;

export interface HealthVoiceConnection {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  localStream: MediaStream;
  remoteAudio: HTMLAudioElement;
  sendEvent: (event: object) => void;
  close: () => void;
}

export interface ConnectHealthVoiceOptions {
  onEvent?: RealtimeEventHandler;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

/**
 * マイク取得 → WebRTC offer → /api/realtime/session へ SDP 中継 → answer 適用。
 */
export async function connectHealthVoice(
  options: ConnectHealthVoiceOptions = {},
): Promise<HealthVoiceConnection> {
  const pc = new RTCPeerConnection();
  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  document.body.appendChild(remoteAudio);

  pc.ontrack = (e) => {
    remoteAudio.srcObject = e.streams[0] ?? null;
    void remoteAudio.play().catch(() => {
      /* autoplay 制限時はユーザー操作済みなので通常は成功する */
    });
  };

  pc.onconnectionstatechange = () => {
    options.onConnectionStateChange?.(pc.connectionState);
  };

  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  const dataChannel = pc.createDataChannel("oai-events");
  dataChannel.addEventListener("message", (e) => {
    try {
      const parsed = JSON.parse(String(e.data)) as unknown;
      options.onEvent?.(parsed);
    } catch {
      /* ignore non-JSON */
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResponse = await fetch("/api/realtime/session", {
    method: "POST",
    body: offer.sdp ?? "",
    headers: { "Content-Type": "application/sdp" },
  });

  if (!sdpResponse.ok) {
    const errBody = (await sdpResponse.json().catch(() => null)) as {
      error?: string;
      detail?: string;
    } | null;
    cleanup(pc, localStream, remoteAudio);
    throw new Error(
      errBody?.detail ||
        errBody?.error ||
        `セッション確立に失敗しました (${sdpResponse.status})`,
    );
  }

  const answerSdp = await sdpResponse.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  function sendEvent(event: object) {
    if (dataChannel.readyState === "open") {
      dataChannel.send(JSON.stringify(event));
    } else {
      dataChannel.addEventListener(
        "open",
        () => dataChannel.send(JSON.stringify(event)),
        { once: true },
      );
    }
  }

  return {
    peerConnection: pc,
    dataChannel,
    localStream,
    remoteAudio,
    sendEvent,
    close: () => cleanup(pc, localStream, remoteAudio),
  };
}

function cleanup(
  pc: RTCPeerConnection,
  localStream: MediaStream,
  remoteAudio: HTMLAudioElement,
) {
  for (const track of localStream.getTracks()) track.stop();
  pc.getSenders().forEach((sender) => {
    try {
      sender.track?.stop();
    } catch {
      /* ignore */
    }
  });
  pc.close();
  remoteAudio.srcObject = null;
  remoteAudio.remove();
}
