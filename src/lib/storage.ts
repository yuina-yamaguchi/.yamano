/**
 * Firebase Storage ユーティリティ
 *
 * 画像アップロード → ダウンロードURL取得 をカプセル化。
 * パス: posts/{uid}/{timestamp}.jpg
 * storage.rules で既に許可済み。
 */
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * 指定された uid の投稿画像を Storage にアップロードし、ダウンロードURLを返す。
 *
 * @param uid - ユーザーUID（パスに使う）
 * @param blob - 撮影した画像の Blob（CameraCapture から渡される）
 * @returns ダウンロードURL
 */
export async function uploadPostImage(
  uid: string,
  blob: Blob
): Promise<string> {
  // 一意のファイル名: タイムスタンプ（ミリ秒）+ ランダム値で重複防止
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const fileName = `${timestamp}_${random}.jpg`;
  const storageRef = ref(storage, `posts/${uid}/${fileName}`);

  // Blob をアップロード
  const snapshot = await uploadBytes(storageRef, blob);
  // アップロード完了後、ダウンロードURLを取得
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return downloadUrl;
}