import { useState, useEffect, useRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useCamera } from "@/hooks/useCamera";
import styles from "./CameraCapture.module.css";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

type Mode = "photo" | "video";
const SWIPE_THRESHOLD = 30;

type Props = {
  onClose: () => void;
  onPosted: () => void;
};

export default function CameraCapture({ onClose, onPosted }: Props) {
  const { user, profile } = useAuth();
  const {
    videoRef,
    canvasRef,
    isCameraReady,
    error: cameraError,
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
  } = useCamera();

  const [mode, setMode] = useState<Mode>("photo");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  function handleCapture() {
    if (mode === "video") {
      if (!isRecording) {
        startRecording();
      }
      return;
    }

    const blob = capturePhoto();
    if (!blob) {
      setError("撮影に失敗しました");
      return;
    }
    setPhotoBlob(blob);
    setPhotoUrl(URL.createObjectURL(blob));
    stopCamera();
  }

  useEffect(() => {
    if (!recordedBlob) return;
    setPhotoBlob(recordedBlob);
    setPhotoUrl(URL.createObjectURL(recordedBlob));
  }, [recordedBlob]);

  function handleGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoBlob(file);
    setPhotoUrl(URL.createObjectURL(file));
    setError("");
    stopCamera();
  }

  function handleRetake() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoBlob(null);
    setPhotoUrl(null);
    setComment("");
    setError("");
    resetRecording();
    startCamera();
  }

  async function handleUpload() {
    if (!user || !photoBlob || !CLOUD_NAME || !UPLOAD_PRESET) {
      if (!CLOUD_NAME || !UPLOAD_PRESET) {
        setError("Cloudinaryの設定が不足しています");
      }
      setUploading(false);
      return;
    }
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      const fileName = mode === "video" ? "video.mp4" : "photo.jpg";
      formData.append("file", photoBlob, fileName);
      formData.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();

      await addDoc(collection(db, "posts"), {
        uid: user.uid,
        userName: profile?.name ?? user.email,
        comment: comment.trim(),
        mediaUrl: data.secure_url,
        mediaType: "image",
        reactions: {},
        createdAt: serverTimestamp(),
      });

      onPosted();
    } catch (err) {
      console.error(err);
      setError("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) < SWIPE_THRESHOLD) return;
    if (diff < 0) {
      setMode("video");
    } else {
      setMode("photo");
    }
  }

  function toggleMode() {
    setMode((prev) => (prev === "photo" ? "video" : "photo"));
  }

  const isVideo = !!photoBlob && (mode === "video" || photoBlob.type.startsWith("video"));

  if (cameraError) {
    return (
      <div className={styles.overlay}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
        <div className={styles.errorContainer}>
          <p className={styles.error}>{cameraError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <button className={styles.closeBtn} onClick={onClose}>✕</button>

      {photoUrl ? (
        <>
          {isVideo ? (
            <video
              src={photoUrl}
              className={styles.preview}
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photoUrl} alt="撮影した写真" className={styles.preview} />
          )}
          <div className={styles.bottomArea}>
            <textarea
              className={styles.commentInput}
              placeholder="コメントを入力..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={200}
            />
            <div className={styles.actions}>
              <button className={styles.btn} onClick={handleRetake} disabled={uploading}>
                撮り直す
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? "アップロード中..." : "アップロード"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={styles.video}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
          {!isCameraReady && (
            <p className={styles.loadingText}>カメラを起動中...</p>
          )}

          {isRecording && (
            <div className={styles.recordingTimer}>
              <span className={styles.recordingDot} />
              {recordingTime}s
            </div>
          )}

          <div className={styles.modePills} onClick={toggleMode}>
            <span className={`${styles.modePill} ${mode === "photo" ? styles.modePillActive : ""}`}>
              写真
            </span>
            <span className={`${styles.modePill} ${mode === "video" ? styles.modePillActive : ""}`}>
              動画
            </span>
          </div>

          <button
            className={`${styles.shutterBtn} ${isRecording ? styles.recording : ""}`}
            onClick={handleCapture}
            disabled={!isCameraReady || (mode === "video" && !isVideoSupported)}
          />

          <button
            className={styles.galleryBtn}
            onClick={() => galleryRef.current?.click()}
            disabled={!isCameraReady || isRecording}
          >
            🌄
          </button>

          <input
            ref={galleryRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleGallery}
            style={{ display: "none" }}
          />
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
