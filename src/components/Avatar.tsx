import styles from "./Avatar.module.css";

// 名前から一貫した色を生成
function colorFromName(name: string) {
  const colors = ["#e07b7b","#e0a87b","#d4c97a","#7be08a","#7bc4e0","#9b7be0","#e07bd4","#7be0c4"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type Props = {
  name: string;
  photoUrl?: string | null;
  size?: number;
};

export default function Avatar({ name, photoUrl, size = 40 }: Props) {
  const initial = name ? name[0] : "?";
  return (
    <div
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: photoUrl ? undefined : colorFromName(name),
      }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className={styles.img} />
      ) : (
        initial
      )}
    </div>
  );
}
