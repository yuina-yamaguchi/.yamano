// scripts/cleanup.mjs
// 使い方: node scripts/cleanup.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA75eR2LuxrpyDjRdU0WtvcFIM9t_ghEzA",
  authDomain: "edel-yamanomen-1b88a.firebaseapp.com",
  projectId: "edel-yamanomen-1b88a",
  messagingSenderId: "707262636097",
  appId: "1:707262636097:web:d21563c2a697103084e6c0",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanup() {
  console.log("ダミーデータを削除中...");

  // dummy_* ユーザーを削除
  const usersSnap = await getDocs(collection(db, "users"));
  for (const d of usersSnap.docs) {
    if (d.id.startsWith("dummy_")) {
      await deleteDoc(doc(db, "users", d.id));
      console.log(`  ✓ users/${d.id} 削除`);
    }
  }

  // dummy_* の投稿を削除
  const postsSnap = await getDocs(collection(db, "posts"));
  for (const d of postsSnap.docs) {
    if (d.data().uid?.startsWith("dummy_")) {
      await deleteDoc(doc(db, "posts", d.id));
      console.log(`  ✓ posts/${d.id} 削除`);
    }
  }

  console.log("完了！");
  process.exit(0);
}

cleanup().catch((e) => { console.error(e); process.exit(1); });
