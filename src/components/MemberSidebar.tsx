import Avatar from "./Avatar";
import styles from "./MemberSidebar.module.css";

type Member = { uid: string; name: string; photoUrl?: string; hasPost: boolean };

export default function MemberSidebar({ members }: { members: Member[] }) {
  return (
    <aside className={styles.sidebar}>
      <p className={styles.heading}>メンバー</p>
      {members.map((m) => (
        <div key={m.uid} className={`${styles.member} ${!m.hasPost ? styles.inactive : ""}`}>
          <Avatar name={m.name} photoUrl={m.photoUrl} size={36} />
          <span className={styles.name}>{m.name}</span>
        </div>
      ))}
    </aside>
  );
}
