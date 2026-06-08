import { useState, useRef } from "react";
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import styles from "./PostForm.module.css";

const CLOUD_NAME = "dxonwszg6";
const UPLOAD_PRESET = "setlog_upload";

export default function PostForm({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function checkCanPost(): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const q = query(
      collection(db, "posts"),
      where("uid", "==", user!.uid),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return true;
    const last = snap.docs[0].data().createdAt?.toDate();
    return !last || last < oneHourAgo;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!comment.trim() && !file) {
      setError("写真/動画またはコメントを入力してください");
      return;
    }
    setLoading(true);
    try {
      const canPost = await checkCanPost();
      if (!canPost) {
        setError("投稿は1時間に1回までです");
        setLoading(false);
        return;
      }

      let mediaUrl = "";
      let mediaType = "";

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        setProgress(50);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        if (!res.ok) throw new Error("upload failed");
        const data = await res.json();
        mediaUrl = data.secure_url;
        mediaType = file.type.startsWith("video") ? "video" : "image";
        setProgress(100);
      }

      await addDoc(collection(db, "posts"), {
        uid: user!.uid,
        userName: profile?.name ?? user!.email,
        comment: comment.trim(),
        mediaUrl,
        mediaType,
        reactions: {},
        createdAt: serverTimestamp(),
      });

      setComment("");
      setFile(null);
      setPreview(null);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
      onPosted();
    } catch (err) {
      console.error(err);
      setError("投稿に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.mediaRow}>
        <button type="button" className={styles.mediaBtn} onClick={() => fileRef.current?.click()}>
          📷 写真 / 動画
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          onChange={onFileChange}
          style={{ display: "none" }}
        />
        {file && <span className={styles.fileName}>{file.name}</span>}
      </div>

      {preview && (
        <div className={styles.previewWrapper}>
          <button type="button" className={styles.removeBtn} onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}>✕</button>
          {file?.type.startsWith("video") ? (
            <video src={preview} controls className={styles.preview} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className={styles.preview} />
          )}
        </div>
      )}

      <textarea
        className={styles.textarea}
        placeholder="コメントを入力..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={200}
      />

      {progress > 0 && progress < 100 && (
        <div className={styles.progressBar}>
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? "投稿中..." : "投稿する"}
      </button>
    </form>
  );
}
