import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadPostImage } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { useCamera } from "@/hooks/useCamera";
import styles from "./CameraCapture.module.css";

type Props = {
  /** 閉じる／キャンセル */
  onClose: () => void;
  /** 投稿成功後 */
  onPosted: () => void;
};

/**
 * カメラで撮影 → Firebase Storage アップロード → Firestore 保存 を行うコンポーネント。
 *
 * 状態遷移:
 *   init (カメラ起動中) → ready (撮影可能) → preview (撮影後確認) → uploading → done
 */
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
  } = useCamera();

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // マウント時にカメラ起動
  useEffect(() => {
    startCamera();
    // アンマウント時にカメラ停止（useCamera の useEffect が自動で行う）
  }, [startCamera]);

  /** 撮影ボタン: video のフレームをキャプチャ */
  function handleCapture() {
    const blob = capturePhoto();
    if (!blob) {
      setError("撮影に失敗しました");
      return;
    }
    setPhotoBlob(blob);
    setPhotoUrl(URL.createObjectURL(blob));
    // 撮影後はカメラを停止（バッテリー節約・プライバシー）
    stopCamera();
  }

  /** 撮り直し */
  function handleRetake() {
    setPhotoBlob(null);
    setPhotoUrl(null);
    setError("");
    startCamera();
  }

  /** アップロード + Firestore 保存 */
  async function handleUpload() {
    if (!user || !photoBlob) return;
    setUploading(true);
    setError("");

    try {
      // 1. Firebase Storage にアップロード
      const downloadUrl = await uploadPostImage(user.uid, photoBlob);

      // 2. Firestore の posts コレクションに保存
      //    既存の PostForm と同じ構造で、storagePath も一緒に保存（cleanup で使う）
      await addDoc(collection(db, "posts"), {
        uid: user.uid,
        userName: profile?.name ?? user.email,
        comment: "", // カメラ撮影の場合はコメントなし（空文字）
        mediaUrl: downloadUrl,
        mediaType: "image",
        storagePath: `posts/${user.uid}/${Date.now()}.jpg`, // cleanupOldPosts で使う
        reactions: {},
        createdAt: serverTimestamp(),
      });

      // 3. 成功を親に通知
      onPosted();
    } catch (err) {
      console.error(err);
      setError("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  // カメラ起動エラー
  if (cameraError) {
    return (
      <div className={styles.overlay}>
        <div className={styles.container}>
          <p className={styles.error}>{cameraError}</p>
          <button className={styles.btn} onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* ヘッダー */}
        <div className={styles.header}>
          <span className={styles.title}>カメラ</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* プレビュー or カメラ映像 */}
        {photoUrl ? (
          // 撮影後の確認画面
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="撮影した写真" className={styles.preview} />

            <div className={styles.actions}>
              <button
                className={styles.btn}
                onClick={handleRetake}
                disabled={uploading}
              >
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
          </>
        ) : (
          // カメラプレビュー（撮影前）
          <>
            <div className={styles.videoWrapper}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline // iPhone Safari 必須
                className={styles.video}
              />
            </div>

            {!isCameraReady && (
              <p className={styles.loadingText}>カメラを起動中...</p>
            )}

            <div className={styles.actions}>
              <button
                className={styles.btn}
                onClick={onClose}
              >
                キャンセル
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleCapture}
                disabled={!isCameraReady}
              >
                撮影
              </button>
            </div>
          </>
        )}

        {/* エラーメッセージ */}
        {error && <p className={styles.error}>{error}</p>}

        {/* canvas（非表示）: capturePhoto で利用 */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}