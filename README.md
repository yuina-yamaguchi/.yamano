# やまのなかまたち

やまのなかまたち専用のプライベートSNS。承認されたメンバーが1時間に1枚の写真または動画を投稿し、バブルレイアウトで表示します。

## 機能

- **投稿**: 1時間に1枚の写真または動画を投稿
- **バブルレイアウト**: 投稿時間が新しいほど大きく表示される独自レイアウト
- **コメント**: 各投稿にコメント可能、メンバーごとにコメントカラーを設定可能
- **リアクション**: ❤️ リアクション機能
- **カメラ撮影**: アプリ内で直接撮影・アップロード
- **お知らせ**: 管理者からのお知らせを全員に配信（コメント・リアクションの通知も）
- **管理画面**: お知らせの投稿・メンバー管理（管理者のみ）

## 技術スタック

- **フレームワーク**: Next.js 14 (PWA)
- **認証・DB**: Firebase Authentication / Firestore
- **メディア保存**: Cloudinary
- **デプロイ**: Firebase Hosting

## 開発

```bash
npm install
npm run dev
```

## 環境変数

`.env.local` に以下の値を設定:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
