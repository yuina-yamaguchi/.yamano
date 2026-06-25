import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, getDoc, updateDoc, writeBatch, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import styles from "./NotificationBell.module.css";

type Notification = {
  id: string;
  type: "reaction" | "comment" | "announcement";
  message: string;
  postId?: string;
  actorName?: string;
  announcementId?: string;
  read: boolean;
  createdAt: Date | null;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<{ title: string; content: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Notification[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type,
          message: data.message,
          postId: data.postId,
          actorName: data.actorName,
          announcementId: data.announcementId,
          read: data.read ?? false,
          createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? null,
        };
      });
      setNotifications(list);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const inWrapper = wrapperRef.current?.contains(e.target as Node);
      const inDropdown = dropdownRef.current?.contains(e.target as Node);
      if (!inWrapper && !inDropdown) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    function update() { setIsMobile(window.innerWidth <= 480); }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;
  const display = notifications.slice(0, 30);

  async function handleMarkAllRead() {
    if (!user) return;
    const batch = writeBatch(db);
    for (const n of notifications) {
      if (!n.read) batch.update(doc(db, "notifications", n.id), { read: true });
    }
    await batch.commit();
  }

  async function handleClickNotification(n: Notification) {
    if (!n.read) {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    }
    if (n.type === "announcement" && n.announcementId) {
      const snap = await getDoc(doc(db, "announcements", n.announcementId));
      if (snap.exists()) {
        const data = snap.data();
        setSelectedAnnouncement({ title: data.title, content: data.content });
      }
    }
  }

  return (
    <>
    <div className={styles.wrapper} ref={wrapperRef}>
        <button className={styles.bellBtn} onClick={() => setOpen(!open)} title="お知らせ">
        🔔
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>}
      </button>
    </div>

      {open && (isMobile ? createPortal(
        <div className={styles.dropdown} ref={dropdownRef}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>お知らせ</span>
            {unread > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                すべて既読
              </button>
            )}
          </div>

          <div className={styles.list}>
            {display.length === 0 && (
              <p className={styles.empty}>お知らせはありません</p>
            )}
            {display.map((n) => (
              <div
                key={n.id}
                className={`${styles.item} ${n.read ? styles.read : ""}`}
                onClick={() => handleClickNotification(n)}
              >
                <div className={styles.itemIcon}>
                  {n.type === "reaction" ? "❤️" : n.type === "comment" ? "💬" : "📢"}
                </div>
                <div className={styles.itemBody}>
                  <p className={styles.itemMessage}>{n.message}</p>
                  {n.createdAt && (
                    <p className={styles.itemTime}>
                      {formatDistanceToNow(n.createdAt, { addSuffix: true, locale: ja })}
                    </p>
                  )}
                </div>
                {!n.read && <div className={styles.unreadDot} />}
              </div>
            ))}
          </div>
        </div>,
        document.body
      ) : (
        <div className={styles.dropdown} ref={dropdownRef}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>お知らせ</span>
            {unread > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                すべて既読
              </button>
            )}
          </div>

          <div className={styles.list}>
            {display.length === 0 && (
              <p className={styles.empty}>お知らせはありません</p>
            )}
            {display.map((n) => (
              <div
                key={n.id}
                className={`${styles.item} ${n.read ? styles.read : ""}`}
                onClick={() => handleClickNotification(n)}
              >
                <div className={styles.itemIcon}>
                  {n.type === "reaction" ? "❤️" : n.type === "comment" ? "💬" : "📢"}
                </div>
                <div className={styles.itemBody}>
                  <p className={styles.itemMessage}>{n.message}</p>
                  {n.createdAt && (
                    <p className={styles.itemTime}>
                      {formatDistanceToNow(n.createdAt, { addSuffix: true, locale: ja })}
                    </p>
                  )}
                </div>
                {!n.read && <div className={styles.unreadDot} />}
              </div>
            ))}
          </div>
        </div>
      ))}

      {selectedAnnouncement && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.7)",
            display: "grid", placeItems: "center",
            zIndex: 3000,
          }}
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            style={{
              background: "#1a1a1a", borderRadius: 16, padding: 28,
              width: "90%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              background: "#e53935", color: "#fff", fontSize: 12,
              fontWeight: 700, padding: "4px 12px", borderRadius: 20,
              alignSelf: "flex-start",
            }}>重要なお知らせ</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{selectedAnnouncement.title}</h2>
            <p style={{ fontSize: 15, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{selectedAnnouncement.content}</p>
            <button
              style={{
                background: "#f0f0f0", color: "#0a0a0a", fontWeight: 700,
                fontSize: 15, padding: 12, border: "none", borderRadius: 8,
                cursor: "pointer", marginTop: 4,
              }}
              onClick={() => setSelectedAnnouncement(null)}
            >閉じる</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}