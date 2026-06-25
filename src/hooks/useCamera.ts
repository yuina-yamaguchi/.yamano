import { useRef, useState, useCallback, useEffect } from "react";

const MAX_DURATION = 3;

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isVideoSupported, setIsVideoSupported] = useState(false);
  const [videoMimeType, setVideoMimeType] = useState("");

  const startCamera = useCallback(async () => {
    setError(null);
    setIsCameraReady(false);

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraReady(true);
        };
      }
    } catch (err) {
      const message =
        err instanceof DOMException
          ? "カメラへのアクセスが許可されていません"
          : "カメラの起動に失敗しました";
      setError(message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const capturePhoto = useCallback((): Blob | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isCameraReady) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = dataURLToBlob(canvas.toDataURL("image/jpeg", 0.8));
    return blob;
  }, [isCameraReady]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const types = [
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    let mime = "";
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        mime = t;
        break;
      }
    }
    if (!mime) {
      setError("お使いの端末では動画撮影に対応していません");
      return;
    }

    setVideoMimeType(mime);
    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordingTime(0);

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      setRecordedBlob(blob);
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    recorder.start();
    setIsRecording(true);

    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      setRecordingTime(elapsed);
      if (elapsed >= MAX_DURATION) {
        stopRecording();
      }
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    chunksRef.current = [];
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    setIsVideoSupported(typeof MediaRecorder !== "undefined");
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isCameraReady,
    error,
    startCamera,
    stopCamera,
    capturePhoto,
    startRecording,
    stopRecording,
    resetRecording,
    isRecording,
    recordingTime,
    recordedBlob,
    isVideoSupported,
    videoMimeType,
  };
}

function dataURLToBlob(dataURL: string): Blob | null {
  const arr = dataURL.split(",");
  if (arr.length < 2) return null;
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) return null;
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
