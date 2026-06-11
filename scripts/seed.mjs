// scripts/seed.mjs
// 使い方: node scripts/seed.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, addDoc, Timestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA75eR2LuxrpyDjRdU0WtvcFIM9t_ghEzA",
  authDomain: "edel-yamanomen-1b88a.firebaseapp.com",
  projectId: "edel-yamanomen-1b88a",
  messagingSenderId: "707262636097",
  appId: "1:707262636097:web:d21563c2a697103084e6c0",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DUMMY_USERS = [
  "さくら", "たろう", "はなこ", "けんじ", "みほ",
  "りょう", "あいこ", "しょうた", "ゆか", "だいき",
  "なつみ", "こうき", "まい", "ゆうと", "あかり",
  "そうた", "りな",
];

// 画像はランダムなプレースホルダー
const SAMPLE_IMAGES = [
  "https://picsum.photos/seed/a1/400/400",
  "https://picsum.photos/seed/b2/400/400",
  "https://picsum.photos/seed/c3/400/400",
  "https://picsum.photos/seed/d4/400/400",
  "https://picsum.photos/seed/e5/400/400",
];

const SAMPLE_COMMENTS = [
  "今日はいい天気！", "山登ってきた🏔", "ご飯美味しかった😋",
  "夕焼けきれい", "のんびり過ごしてる", "久しぶりに写真撮った",
  null, null, null, // 投稿なしパターン
];

async function seed() {
  console.log("ダミーデータを挿入中...");

  for (let i = 0; i < DUMMY_USERS.length; i++) {
    const name = DUMMY_USERS[i];
    const uid = `dummy_${i + 1}`;

    // ユーザー作成
    await setDoc(doc(db, "users", uid), {
      uid,
      name,
      approved: true,
      role: "user",
      photoUrl: null,
    });

    await setDoc(doc(db, "users_private", uid), {
      email: `dummy${i + 1}@example.com`,
    });

    // 投稿（約2/3のユーザーが投稿済み、時間をずらす）
    const comment = SAMPLE_COMMENTS[i % SAMPLE_COMMENTS.length];
    if (comment !== null) {
      const hoursAgo = (i % 7) * 1.5; // 0〜9時間前
      const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000);
      await addDoc(collection(db, "posts"), {
        uid,
        userName: name,
        comment,
        mediaUrl: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length],
        mediaType: "image",
        createdAt: Timestamp.fromDate(createdAt),
      });
    }

    console.log(`  ✓ ${name}`);
  }

  console.log("完了！ブラウザをリロードしてください。");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
