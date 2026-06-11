// scripts/migrate_emails.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc, updateDoc, deleteField } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA75eR2LuxrpyDjRdU0WtvcFIM9t_ghEzA",
  authDomain: "edel-yamanomen-1b88a.firebaseapp.com",
  projectId: "edel-yamanomen-1b88a",
  messagingSenderId: "707262636097",
  appId: "1:707262636097:web:d21563c2a697103084e6c0",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  console.log("既存ユーザーのメールアドレスを移行中...");

  const usersSnap = await getDocs(collection(db, "users"));
  
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const uid = userDoc.id;
    const email = data.email;

    if (email) {
      console.log(`移行中: ${data.name || uid} (${email})`);
      
      // 1. users_private にメールアドレスをコピー
      await setDoc(doc(db, "users_private", uid), {
        email: email
      });

      // 2. users から email フィールドを削除
      await updateDoc(doc(db, "users", uid), {
        email: deleteField()
      });

      console.log(`  ✓ 完了`);
    } else {
      console.log(`スキップ: ${data.name || uid} (メールアドレスなし)`);
    }
  }

  console.log("すべての移行が完了しました！");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("エラーが発生しました:", e);
  console.log("\n※注意: セキュリティルールの制限により、管理者権限がないと実行できない場合があります。");
  process.exit(1);
});
