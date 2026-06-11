import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Avatar from "@/components/Avatar";
import styles from "./CommentSection.module.css";

type Comment = {
  id: string;
  uid: string;
  userName: string;
  photoUrl?: string;
  text: string;
  createdAt: Date | null;
};

type Props = {
  postId: string;
};

export default function CommentSection({ postId }: Props) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");

  // コメントをリアルタイム購読（最新50件、古い順に表示）
  useEffect(() => {
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Comment[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: data.uid,
          userName: data.userName,
          photoUrl: data.photoUrl,
          text: data.text,
          createdAt: data.createdAt?.toDate?.() ?? null,
        };
      });
      setComments(list);
    });
    return unsub;
  }, [postId]);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    await addDoc(collection(db, "posts", postId, "comments"), {
      uid: user.uid,
      userName: profile?.name ?? user.email,
      photoUrl: profile?.photoUrl ?? null,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    setText("");
  }

  async function handleDelete(commentId: string) {
    await deleteDoc(doc(db, "posts", postId, "comments", commentId));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && text.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const canSubmit = text.trim().length > 0;

  return (
    <div className={styles.section}>
      {/* 区切り線 */}
      <div className={styles.divider} />

      {/* コメント一覧 */}
      <div className={styles.list}>
        {comments.map((c) => (
          <div key={c.id} className={styles.comment}>
            <Avatar name={c.userName} photoUrl={c.photoUrl} size={24} />
            <div className={styles.commentBody}>
              <span className={styles.commentName}>{c.userName}</span>
              <span className={styles.commentText}>{c.text}</span>
            </div>
            {c.uid === user?.uid && (
              <button
                className={styles.deleteCommentBtn}
                onClick={() => handleDelete(c.id)}
                title="削除"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 入力エリア */}
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder="コメント"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={200}
        />
        <button
          className={`${styles.sendBtn} ${canSubmit ? styles.sendBtnActive : ""}`}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          ▶
        </button>
      </div>
    </div>
  );
}