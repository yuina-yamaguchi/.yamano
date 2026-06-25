import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./AnnouncementBanner.module.css";

type Announcement = {
  id: string;
  title: string;
  content: string;
  important: boolean;
  pinned: boolean;
  createdAt: Date;
  authorName: string;
};

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem("dismissedAnnouncements");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem("dismissedAnnouncements", JSON.stringify(Array.from(ids)));
}

export default function AnnouncementBanner() {
  const [all, setAll] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("pinned", "desc"), orderBy("createdAt", "desc"), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      const list: Announcement[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          content: data.content,
          important: data.important ?? false,
          pinned: data.pinned ?? false,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
          authorName: data.authorName ?? "",
        };
      });
      setAll(list);
    });
    return unsub;
  }, []);

  function handleDismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  }

  const visible = all.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className={styles.banner}>
      {visible.map((a) => (
        <div key={a.id} className={`${styles.item} ${a.important ? styles.important : ""}`}>
          <div className={styles.titleRow}>
            <span className={styles.badge}>お知らせ</span>
            {a.pinned && <span className={styles.pinIcon}>📌</span>}
            <span className={styles.titleText}>{a.title}</span>
            <button className={styles.dismissBtn} onClick={() => handleDismiss(a.id)}>✕</button>
          </div>
          <p className={styles.content}>{a.content}</p>
        </div>
      ))}
    </div>
  );
}