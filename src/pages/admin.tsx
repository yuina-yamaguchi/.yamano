import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import styles from "./admin.module.css";

type UserRecord = { uid: string; email: string; name: string; approved: boolean };
type UserDoc = { uid: string; name: string; approved: boolean };

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    if (!loading && profile?.role !== "admin") { router.push("/"); return; }
    if (profile?.role === "admin") fetchUsers();
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

  async function approve(uid: string, approved: boolean) {
    await updateDoc(doc(db, "users", uid), { approved });
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, approved } : u));
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
      </main>
    </div>
  );
}
