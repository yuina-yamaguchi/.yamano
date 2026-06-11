/**
 * 30日以上経過した投稿を Firestore から削除する。
 * 同時に Firebase Storage に画像がある場合はそれも削除する。
 *
 * 使い方: index.tsx のマウント時に fire-and-forget で呼び出す。
 * ユーザーが開いたタイミングで動くため、リアルタイム性はないが
 * 毎日誰かが使えば十分に機能する。
 */
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

const OLD_DAYS = 30;
const OLD_MS = OLD_DAYS * 24 * 60 * 60 * 1000;

/**
 * 30日以上前の投稿を削除する。
 * index.tsx の useEffect などで await せずに呼ぶ（fire-and-forget）。
 */
export async function cleanupOldPosts(): Promise<void> {
  try {
    // createdAt の昇順（古い順）で最大100件取得
    const snap = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "asc"), limit(100))
    );

    const now = Date.now();
    let deletedCount = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate?.();
      if (!createdAt) continue;

      // 30日以内の投稿はスキップ
      if (now - createdAt.getTime() < OLD_MS) continue;

      // Storage の画像があれば削除
      const storagePath: string | undefined = data.storagePath;
      if (storagePath) {
        try {
          await deleteObject(ref(storage, storagePath));
        } catch (err) {
          // 画像が既に存在しない場合などは無視
          console.warn("Storage delete failed (ignored):", storagePath, err);
        }
      }

      // Firestore のドキュメントを削除
      await deleteDoc(doc(db, "posts", docSnap.id));
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`cleanupOldPosts: ${deletedCount} 件の古い投稿を削除しました`);
    }
  } catch (err) {
    // クリーンアップの失敗はアプリに影響させない
    console.error("cleanupOldPosts でエラーが発生しました（無視）:", err);
  }
}