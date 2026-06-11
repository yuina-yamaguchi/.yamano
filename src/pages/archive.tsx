import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Avatar from "@/components/Avatar";
import styles from "./archive.module.css";

type PostItem = {
  id: string;
  userName: string;
  comment: string;
  mediaUrl: string;
  mediaType: string;
  createdAt: Date | null;
};

export default function Archive() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [fetching, setFetching] = useState(true);

  // 認証ガード
  useEffect(() => {
    if (!loading && !user) { router.push("/auth"); return; }
    if (!loading && user && !profile?.approved) { router.push("/pending"); return; }
  }, [user, profile, loading, router]);

  // 30日以内の投稿を取得
  useEffect(() => {
    if (!user || !profile?.approved) return;

    const thirtyDaysAgo = Timestamp.fromMillis(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    async function fetchPosts() {
      const snap = await getDocs(
        query(
          collection(db, "posts"),
          where("createdAt", ">=", thirtyDaysAgo),
          orderBy("createdAt", "desc")
        )
      );

      const list: PostItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userName: data.userName,
          comment: data.comment ?? "",
          mediaUrl: data.mediaUrl ?? "",
          mediaType: data.mediaType ?? "",
          createdAt: data.createdAt?.toDate?.() ?? null,
        };
      });

      setPosts(list);
      setFetching(false);
    }

    fetchPosts();
  }, [user, profile]);

  if (loading || !user || !profile?.approved) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ←
        </button>
        <span className={styles.title}>アーカイブ</span>
        <span />
      </header>

      <main className={styles.main}>
        {fetching ? (
          <p className={styles.status}>読み込み中...</p>
        ) : posts.length === 0 ? (
          <p className={styles.status}>過去30日間の投稿はありません</p>
        ) : (
          <div className={styles.grid}>
            {posts.map((post) => (
              <div key={post.id} className={styles.card}>
                {post.mediaUrl && (
                  post.mediaType === "video" ? (
                    <video
                      src={post.mediaUrl}
                      className={styles.media}
                      muted
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.mediaUrl}
                      alt=""
                      className={styles.media}
                    />
                  )
                )}
                <div className={styles.cardBody}>
                  <div className={styles.userRow}>
                    <Avatar name={post.userName} size={24} />
                    <span className={styles.userName}>{post.userName}</span>
                    {post.createdAt && (
                      <span className={styles.time}>
                        {formatDistanceToNow(post.createdAt, {
                          addSuffix: true,
                          locale: ja,
                        })}
                      </span>
                    )}
                  </div>
                  {post.comment && (
                    <p className={styles.comment}>{post.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}