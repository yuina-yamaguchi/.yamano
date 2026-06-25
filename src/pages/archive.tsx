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
import PostDetailModal from "@/components/PostDetailModal";
import Avatar from "@/components/Avatar";
import styles from "./archive.module.css";

type PostItem = {
  id: string;
  uid: string;
  userName: string;
  comment: string;
  mediaUrl: string;
  mediaType: string;
  createdAt: Date | null;
  storagePath?: string;
};

export default function Archive() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [photoMap, setPhotoMap] = useState<Map<string, string>>(new Map());
  const [fetching, setFetching] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);

  // 認証ガード
  useEffect(() => {
    if (!loading && !user) { router.push("/auth"); return; }
    if (!loading && user && !profile?.approved) { router.push("/pending"); return; }
  }, [user, profile, loading, router]);

  // 30日以内の投稿 + ユーザーアイコンを取得
  useEffect(() => {
    if (!user || !profile?.approved) return;

    const thirtyDaysAgo = Timestamp.fromMillis(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    async function fetchArchive() {
      const [usersSnap, postsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(
          query(
            collection(db, "posts"),
            where("createdAt", ">=", thirtyDaysAgo),
            orderBy("createdAt", "desc")
          )
        ),
      ]);

      const map = new Map<string, string>();
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.photoUrl) map.set(data.uid, data.photoUrl);
      });
      setPhotoMap(map);

      const list: PostItem[] = postsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: data.uid,
          userName: data.userName,
          comment: data.comment ?? "",
          mediaUrl: data.mediaUrl ?? "",
          mediaType: data.mediaType ?? "",
          createdAt: data.createdAt?.toDate?.() ?? null,
          storagePath: data.storagePath ?? undefined,
        };
      });

      setPosts(list);
      setFetching(false);
    }

    fetchArchive();
  }, [user, profile]);

  if (loading || !user || !profile?.approved) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ←
        </button>
        <span className={styles.title}>投稿アーカイブ</span>
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
              <div
               key={post.id}
               className={styles.card}
               style={{ cursor: "pointer" }}
               onClick={() => setSelectedPost(post)}
              >
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
                    <Avatar name={post.userName} photoUrl={photoMap.get(post.uid)} size={24} />
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
        {selectedPost && (
          <PostDetailModal
           postId={selectedPost.id}
           authorUid={selectedPost.uid}
           authorName={selectedPost.userName}
           comment={selectedPost.comment}
           mediaUrl={selectedPost.mediaUrl}
           mediaType={selectedPost.mediaType}
           createdAt={selectedPost.createdAt}
           storagePath={selectedPost.storagePath}
           onClose={() => setSelectedPost(null)}
         />
        )}
      </main>
    </div>
  );
}