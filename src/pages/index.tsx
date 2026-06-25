import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, deleteDoc, getDocs, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { cleanupOldPosts } from "@/lib/cleanupOldPosts";
import Avatar from "@/components/Avatar";
import MemberSidebar from "@/components/MemberSidebar";
import PostForm from "@/components/PostForm";
import CommentSection from "@/components/CommentSection";
import PostDetailModal from "@/components/PostDetailModal";
import styles from "./index.module.css";

type Reaction = { uid: string; name: string; photoUrl?: string };
type Post = {
  id: string; uid: string; userName: string; photoUrl?: string;
  comment: string; mediaUrl: string; mediaType: string;
  createdAt: Date; reactions: Reaction[]; myReaction: boolean;
};
type UserCard = { uid: string; name: string; photoUrl?: string; bio?: string; post: Post | null };
type UserCardList = UserCard[];

// コンポーネント外のユーティリティ関数
function seededRandom(seed: string, offset: number) {
  let h = offset;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h % 1000) / 1000;
}

function postSize(post: Post | null, W = 400): number {
  const base = W > 900 ? 1.8 : W > 600 ? 1.3 : 1.0;
  if (!post) return Math.round(32 * base);
  const hours = (Date.now() - post.createdAt.getTime()) / 3600000;
  let s: number;
  if (hours < 1) s = 110;
  else if (hours < 3) s = 95;
  else if (hours < 6) s = 80;
  else if (hours < 12) s = 68;
  else s = 56;
  return Math.round(s * base);
}

function tryPlace(cardList: UserCard[], W: number, H: number, scale: number) {
  const placed: { cx: number; cy: number; r: number }[] = [];
  const result: ({ left: number; top: number } | null)[] = new Array(cardList.length).fill(null);
  const PAD = 4;
  const sorted = cardList.map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.post && !b.c.post ? -1 : !a.c.post && b.c.post ? 1 : 0));
  for (const { c: card, i: idx } of sorted) {
    const size = postSize(card.post, W) * scale;
    const r = size / 2 + PAD;
    let ok = false;
    for (let attempt = 0; attempt < 600 && !ok; attempt++) {
      const rx = seededRandom(card.uid + idx, attempt * 3);
      const ry = seededRandom(card.uid + idx, attempt * 3 + 1);
      const cx = r + rx * (W - r * 2);
      const cy = r + ry * (H - r * 2);
      if (cx - r < 0 || cy - r < 0 || cx + r > W || cy + r > H) continue;
      if (!placed.some((p) => Math.sqrt((cx - p.cx) ** 2 + (cy - p.cy) ** 2) < r + p.r)) {
        placed.push({ cx, cy, r });
        result[idx] = { left: cx - size / 2, top: cy - size / 2 };
        ok = true;
      }
    }
    if (!ok) {
      for (let fy = r; fy < H - r && !ok; fy += 6)
        for (let fx = r; fx < W - r && !ok; fx += 6)
          if (!placed.some((p) => Math.sqrt((fx - p.cx) ** 2 + (fy - p.cy) ** 2) < r + p.r)) {
            placed.push({ cx: fx, cy: fy, r });
            result[idx] = { left: fx - size / 2, top: fy - size / 2 };
            ok = true;
          }
    }
  }
  return result;
}

function calcPositions(cardList: UserCard[], W: number, H: number) {
  for (let scale = 1.0; scale >= 0.3; scale -= 0.05) {
    const result = tryPlace(cardList, W, H, scale);
    if (result.every((p) => p !== null)) return result as { left: number; top: number }[];
  }
  const cols = Math.ceil(Math.sqrt(cardList.length));
  const cellW = W / cols, cellH = H / Math.ceil(cardList.length / cols);
  return cardList.map((_, i) => ({
    left: (i % cols) * cellW + cellW * 0.1,
    top: Math.floor(i / cols) * cellH + cellH * 0.1,
  }));
}

export default function Home() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [positions, setPositions] = useState<{ left: number; top: number }[]>([]);
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  const buildCards = useCallback(async () => {
    if (!user) return;
    const usersSnap = await getDocs(collection(db, "users"));
    const users = usersSnap.docs
      .map((d) => d.data() as { uid: string; name: string; photoUrl?: string; bio?: string; approved: boolean })
      .filter((u) => u.approved);
    const postsSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(200)));
    const cutoff = Date.now() - 24 * 3600000;
    const latestPost: Record<string, Post> = {};
    for (const d of postsSnap.docs) {
      const data = d.data();
      const createdAt: Date = data.createdAt?.toDate() ?? new Date();
      if (createdAt.getTime() < cutoff || latestPost[data.uid]) continue;
      const reactionsSnap = await getDocs(collection(db, "posts", d.id, "reactions"));
      const reactions: Reaction[] = reactionsSnap.docs.map((r) => r.data() as Reaction);
      latestPost[data.uid] = {
        id: d.id, uid: data.uid, userName: data.userName, photoUrl: data.photoUrl,
        comment: data.comment, mediaUrl: data.mediaUrl, mediaType: data.mediaType,
        createdAt, reactions, myReaction: reactions.some((r) => r.uid === user.uid),
      };
    }
    const result: UserCard[] = users.map((u) => ({
      uid: u.uid, name: u.name, photoUrl: u.photoUrl, bio: u.bio, post: latestPost[u.uid] ?? null,
    }));
    result.sort((a, b) => {
      if (a.post && b.post) return b.post.createdAt.getTime() - a.post.createdAt.getTime();
      if (a.post) return -1; if (b.post) return 1;
      return a.name.localeCompare(b.name);
    });
    setCards(result);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) { router.push("/auth"); return; }
    if (!loading && user && !profile?.approved) { router.push("/pending"); return; }
  }, [user, profile, loading, router]);

  // ページマウント時に30日以上前の投稿をクリーンアップ（fire-and-forget）
  useEffect(() => {
    if (user && profile?.approved) {
      cleanupOldPosts();
      }
    }, [user, profile]);
    
  useEffect(() => {
    if (!user || !profile?.approved) return;
    buildCards();
    const unsub = onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(1)), () => buildCards());
    return unsub;
  }, [user, profile, buildCards]);

  useEffect(() => {
    if (!fieldRef.current || cards.length === 0) return;
    const el = fieldRef.current;
    const recalc = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setPositions(calcPositions(cards, width, height));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cards]);

  if (loading || !user || !profile?.approved) return null;

  const delays = cards.map((_, i) => `${(i * 0.37) % 2.5}s`);
  const durations = cards.map((_, i) => `${7 + (i * 0.58) % 4}s`);
  const fieldW = fieldRef.current?.getBoundingClientRect().width ?? 400;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>やまのなかまたち</span>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={() => router.push("/settings")} title="設定">
            <Avatar name={profile.name} photoUrl={profile.photoUrl} size={32} />
          </button>
          {profile.role === "admin" && (
            <button className={styles.textBtn} onClick={() => router.push("/admin")}>管理</button>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <MemberSidebar
          members={cards.map((c) => ({ uid: c.uid, name: c.name, photoUrl: c.photoUrl, hasPost: !!c.post }))}
          onSelect={(uid) => {
            const card = cards.find((c) => c.uid === uid);
            if (card) setSelectedCard(card);
          }}
        />
        <main className={styles.main}>
          <div className={styles.actionRow}>
            <button className={styles.postBtn} onClick={() => setShowForm(!showForm)}>
              {showForm ? "✕ 閉じる" : "＋ 投稿する"}
            </button>
            {!showForm && (
              <button className={styles.archiveBtn} onClick={() => router.push("/archive")}>
                投稿アーカイブ
              </button>
            )}
          </div>
          {showForm && <div className={styles.formWrapper}><PostForm onPosted={() => { setShowForm(false); buildCards(); }} /></div>}
          <div className={styles.bubbleField} ref={fieldRef}>
            {cards.map((card, i) => {
              const pos = positions[i];
              if (!pos) return null;
              const size = postSize(card.post, fieldW);
              return (
                <div
                  key={card.uid}
                  className={`${styles.bubbleWrap} ${card.post ? styles.hasPost : styles.noPost}`}
                  style={{
                    animationDelay: delays[i],
                    animationDuration: durations[i],
                    position: "absolute",
                    left: pos.left,
                    top: pos.top,
                    ...(card.post ? { width: size, height: size } : {}),
                  }}
                  onClick={() => setSelectedCard(card)}
                >
                  {card.post && (
                    <>
                      <div className={styles.mediaBubble} style={{ width: size, height: size }}>
                        {card.post.mediaUrl ? (
                          card.post.mediaType === "video"
                            ? <video src={card.post.mediaUrl} className={styles.mediaFill} muted playsInline />
                            // eslint-disable-next-line @next/next/no-img-element
                            : <img src={card.post.mediaUrl} alt="" className={styles.mediaFill} />
                        ) : (
                          <div className={styles.commentBubble}><p>{card.post.comment}</p></div>
                        )}
                      </div>
                      <div className={styles.avatarOverlay}>
                        <Avatar name={card.name} photoUrl={card.photoUrl} size={32} />
                      </div>
                    </>
                  )}
                  {!card.post && <Avatar name={card.name} photoUrl={card.photoUrl} size={32} />}
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {selectedCard?.post && (
        <PostDetailModal
          postId={selectedCard.post.id}
          authorUid={selectedCard.uid}
          authorName={selectedCard.name}
          authorPhotoUrl={selectedCard.photoUrl}
          comment={selectedCard.post.comment}
          mediaUrl={selectedCard.post.mediaUrl}
          mediaType={selectedCard.post.mediaType}
          createdAt={selectedCard.post.createdAt}
          onClose={() => setSelectedCard(null)}
          onDeleted={() => buildCards()}
        />
      )}
    </div>
  );
}