import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, writeBatch, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import styles from "./admin.module.css";

type UserRecord = { uid: string; email: string; name: string; approved: boolean };
type UserDoc = { uid: string; name: string; approved: boolean };
type AnnounceItem = { id: string; title: string; pinned: boolean; createdAt: Date };

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");
  const [announceImportant, setAnnounceImportant] = useState(false);
  const [announcePinned, setAnnouncePinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnounceItem[]>([]);

  useEffect(() => {
    if (!loading && profile?.role !== "admin") { router.push("/"); return; }
    if (profile?.role === "admin") { fetchUsers(); fetchAnnouncements(); }
  }, [profile, loading]);

  async function fetchUsers() {
    const [usersSnap, privateSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "users_private"))
    ]);
    const privateData = Object.fromEntries(
      privateSnap.docs.map((d) => [d.id, d.data().email])
    );
    setUsers(
      usersSnap.docs.map((d) => {
        const data = d.data() as UserDoc;
        return {
          ...data,
          email: privateData[d.id] || "(非公開)",
        };
      })
    );
  }

  function fetchAnnouncements() {
    const q = query(collection(db, "announcements"), orderBy("pinned", "desc"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, title: data.title, pinned: data.pinned ?? false, createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date() };
      }));
    });
  }

  async function approve(uid: string, approved: boolean) {
    await updateDoc(doc(db, "users", uid), { approved });
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, approved } : u));

    if (approved) {
      const importantSnap = await getDocs(
        query(collection(db, "announcements"), where("important", "==", true))
      );
      if (importantSnap.size > 0) {
        const batch = writeBatch(db);
        for (const d of importantSnap.docs) {
          const data = d.data();
          const notifRef = doc(collection(db, "notifications"));
          batch.set(notifRef, {
            uid,
            type: "announcement",
            message: `お知らせ: "${data.title}"`,
            read: false,
            createdAt: serverTimestamp(),
            important: true,
            announcementId: d.id,
          });
        }
        await batch.commit();
      }
    }
  }

  async function handlePostAnnouncement() {
    if (!announceTitle.trim() || !announceContent.trim()) return;
    setPosting(true);
    try {
      const announcementRef = await addDoc(collection(db, "announcements"), {
        title: announceTitle.trim(),
        content: announceContent.trim(),
        important: announceImportant,
        pinned: announcePinned,
        createdAt: serverTimestamp(),
        authorName: profile?.name ?? "管理者",
      });

      const usersSnap = await getDocs(
        query(collection(db, "users"), where("approved", "==", true))
      );
      const batch = writeBatch(db);
      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          uid,
          type: "announcement",
          message: `お知らせ: "${announceTitle.trim()}"`,
          read: false,
          createdAt: serverTimestamp(),
          // ★ 追加
          important: announceImportant,
          announcementId: announcementRef.id,
        });
      }
      await batch.commit();

      setAnnounceTitle("");
      setAnnounceContent("");
      setAnnounceImportant(false);
      setAnnouncePinned(false);
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  }

  if (loading || profile?.role !== "admin") return null;

  const pending = users.filter((u) => !u.approved);
  const approved = users.filter((u) => u.approved);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => router.push("/")}>← 戻る</button>
        <h1>管理者画面</h1>
      </header>

      <main className={styles.main}>
        <section>
          <h2 className={styles.sectionTitle}>承認待ち ({pending.length})</h2>
          {pending.length === 0 && <p className={styles.empty}>承認待ちのユーザーはいません</p>}
          {pending.map((u) => (
            <div key={u.uid} className={styles.userRow}>
              <div>
                <p className={styles.name}>{u.name || "名前未設定"}</p>
                <p className={styles.email}>{u.email}</p>
              </div>
              <button className={styles.approveBtn} onClick={() => approve(u.uid, true)}>
                承認する
              </button>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 className={styles.sectionTitle}>承認済み ({approved.length})</h2>
          {approved.map((u) => (
            <div key={u.uid} className={styles.userRow}>
              <div>
                <p className={styles.name}>{u.name || "名前未設定"}</p>
                <p className={styles.email}>{u.email}</p>
              </div>
              <button className={styles.revokeBtn} onClick={() => approve(u.uid, false)}>
                取り消し
              </button>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 className={styles.sectionTitle}>お知らせの投稿</h2>
          <div className={styles.announceForm}>
            <input
              className={styles.announceInput}
              placeholder="タイトル"
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              maxLength={100}
            />
            <textarea
              className={styles.announceTextarea}
              placeholder="本文"
              value={announceContent}
              onChange={(e) => setAnnounceContent(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={announceImportant}
                onChange={(e) => setAnnounceImportant(e.target.checked)}
              />
              重要なお知らせ
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={announcePinned}
                onChange={(e) => setAnnouncePinned(e.target.checked)}
              />
              ピン止め（常に先頭に表示）
            </label>
            <button
              className={styles.announceBtn}
              onClick={handlePostAnnouncement}
              disabled={!announceTitle.trim() || !announceContent.trim() || posting}
            >
              {posting ? "投稿中..." : "お知らせを投稿"}
            </button>
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 className={styles.sectionTitle}>お知らせ一覧 ({announcements.length})</h2>
          {announcements.length === 0 && <p className={styles.empty}>お知らせはありません</p>}
          {announcements.map((a) => (
            <div key={a.id} className={styles.userRow}>
              <div>
                <p className={styles.name}>{a.title}</p>
                <p className={styles.email}>{a.pinned ? "📌 ピン止め中" : ""}</p>
              </div>
              <button
                className={a.pinned ? styles.revokeBtn : styles.approveBtn}
                onClick={async () => {
                  await updateDoc(doc(db, "announcements", a.id), { pinned: !a.pinned });
                }}
              >
                {a.pinned ? "ピン解除" : "ピン止め"}
              </button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
