import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  deleteDoc as deletePostDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Avatar from "@/components/Avatar";
import CommentSection from "@/components/CommentSection";
import styles from "./PostDetailModal.module.css";

type Reaction = {
  uid: string;
  name: string;
  photoUrl?: string;
};

type Props = {
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhotoUrl?: string;
  comment?: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: Date | null;
  storagePath?: string;
  onClose: () => void;
  onDeleted?: () => void;
};

export default function PostDetailModal({
  postId,
  authorUid,
  authorName,
  authorPhotoUrl,
  comment,
  mediaUrl,
  mediaType,
  createdAt,
  storagePath,
  onClose,
  onDeleted,
}: Props) {
  const { user, profile } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // リアルタイムでリアクションを購読
  useEffect(() => {
    const q = query(
      collection(db, "posts", postId, "reactions"),
      orderBy("name", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Reaction[] = snap.docs.map((d) => d.data() as Reaction);
      setReactions(list);
    });
    return unsub;
  }, [postId]);

  const myReaction = reactions.some((r) => r.uid === user?.uid);

  async function toggleHeart() {
    if (!user || !profile) return;
    const reactionRef = doc(db, "posts", postId, "reactions", user.uid);
    if (myReaction) {
      await deleteDoc(reactionRef);
    } else {
      await setDoc(reactionRef, {
        uid: user.uid,
        name: profile.name,
        photoUrl: profile.photoUrl ?? null,
      });
    }
  }

  async function handleDelete() {
    if (!user || authorUid !== user.uid) return;
    if (!confirm("投稿を削除しますか？")) return;

    if (storagePath) {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch { /* ignore */ }
    }

    await deletePostDoc(doc(db, "posts", postId));
    onDeleted?.();
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        <div className={styles.modalHeader}>
          <Avatar name={authorName} photoUrl={authorPhotoUrl} size={40} />
          <div>
            <p className={styles.modalName}>{authorName}</p>
            {createdAt && (
              <p className={styles.modalTime}>
                {formatDistanceToNow(createdAt, { addSuffix: true, locale: ja })}
              </p>
            )}
          </div>
        </div>

        {mediaUrl && (
          mediaType === "video"
            ? <video src={mediaUrl} controls className={styles.modalMedia} playsInline />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={mediaUrl} alt="" className={styles.modalMedia} />
        )}

        {comment && <p className={styles.modalComment}>{comment}</p>}

        <div className={styles.reactionRow}>
          <button
            className={`${styles.reactionBtn} ${myReaction ? styles.reacted : ""}`}
            onClick={toggleHeart}
          >
            ❤️ {reactions.length}
          </button>
          {authorUid === user?.uid && (
            <button className={styles.deleteBtn} onClick={handleDelete}>削除</button>
          )}
        </div>

        {reactions.length > 0 && (
          <div className={styles.reactionList}>
            {reactions.map((r) => (
              <div key={r.uid} className={styles.reactionUser}>
                <Avatar name={r.name} photoUrl={r.photoUrl} size={28} />
                <span>{r.name}</span>
              </div>
            ))}
          </div>
        )}

        <CommentSection postId={postId} />
      </div>
    </div>
  );
}