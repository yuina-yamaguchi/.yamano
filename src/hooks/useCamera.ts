import { useRef, useState, useCallback, useEffect } from "react";

/**
 * WebRTC カメラを管理するカスタムフック。
 *
 * - facingMode: "environment"（背面カメラ）を優先
 * - <video playsInline muted> — iPhone Safari 対策
 * - アンマウント時・stopCamera() で全トラックを確実に停止
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * カメラを起動する。
   * environment が使えなければ user にフォールバック。
   */
  const startCamera = useCallback(async () => {
    setError(null);
    setIsCameraReady(false);

    try {
      // まず背面カメラを試す
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        // 背面がない場合は前面カメラを試す
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      // video 要素にストリームをセット
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // メタデータが読み込まれたら準備完了
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

  /**
   * カメラを停止し、全トラックを解放する。
   * バッテリー節約 + 他のアプリがカメラを使えるようにするために必ず呼ぶ。
   */
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

  /**
   * 現在の映像フレームを canvas に描画し、JPEG Blob として返す。
   * 撮影前に video が再生中であることを確認すること。
   */
  const capturePhoto = useCallback((): Blob | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isCameraReady) return null;

    // video の実際の解像度で canvas を設定
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 現在のフレームを描画（左右反転を避けるため scale は使わない）
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // JPEG 形式で Blob 化（品質 0.8 = 画質とファイルサイズのバランス）
    const blob = dataURLToBlob(canvas.toDataURL("image/jpeg", 0.8));
    return blob;
  }, [isCameraReady]);

  // アンマウント時に自動クリーンアップ
  useEffect(() => {
    return () => {
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
  };
}

/**
 * dataURL → Blob 変換（内部利用）
 */
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