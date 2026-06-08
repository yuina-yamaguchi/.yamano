import { signOut } from "firebase/auth";
import { useRouter } from "next/router";
import { auth } from "@/lib/firebase";
import styles from "./auth.module.css";

export default function PendingPage() {
  const router = useRouter();
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>やまのなかまたち</h1>
      <p style={{ color: "#888", textAlign: "center", lineHeight: 1.8 }}>
        登録ありがとうございます。<br />
        管理者の承認をお待ちください。
      </p>
      <button
        className={styles.toggle}
        onClick={async () => { await signOut(auth); router.push("/auth"); }}
      >
        ログアウト
      </button>
    </div>
  );
}
