import { useState, useRef } from "react";
import { useRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Avatar from "@/components/Avatar";
import styles from "./settings.module.css";

const CLOUD_NAME = "dxonwszg6";
const UPLOAD_PRESET = "setlog_upload";

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, loading, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return null;
  if (!user || !profile) { router.push("/auth"); return null; }

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
      method: "POST", body: formData,
    });
    const data = await res.json();
    await updateProfile({ photoUrl: data.secure_url });
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await updateProfile({ name, bio });
    setSaving(false);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => router.push("/")}>← 戻る</button>
        <h1>設定</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.iconSection}>
          <Avatar name={profile.name} photoUrl={profile.photoUrl} size={80} />
          <button className={styles.changeIcon} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "アップロード中..." : "アイコンを変更"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleIconChange} style={{ display: "none" }} />
        </div>

        <form onSubmit={handleSave} className={styles.form}>
          <label className={styles.label}>ユーザーネーム</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className={styles.label}>自己紹介 (50文字まで)</label>
          <textarea
            className={styles.textarea}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={50}
            rows={2}
            placeholder="自己紹介を入力してください..."
          />

          <label className={styles.label}>メールアドレス</label>
          <input className={styles.input} value={profile.email} disabled />
          <p className={styles.hint}>メールアドレスの変更は現在サポートされていません</p>

          <button className={styles.saveBtn} type="submit" disabled={saving}>
            {done ? "✓ 保存しました" : saving ? "保存中..." : "保存する"}
          </button>
        </form>

        <button
          className={styles.logoutBtn}
          onClick={async () => { await signOut(auth); router.push("/auth"); }}
        >
          ログアウト
        </button>
      </main>
    </div>
  );
}
