import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User, updateEmail, updatePassword } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  approved: boolean;
  role: string;
  photoUrl?: string;
};

type AuthCtx = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<Pick<UserProfile, "name" | "photoUrl">>) => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null, profile: null, loading: true,
  updateProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  async function updateProfile(data: Partial<Pick<UserProfile, "name" | "photoUrl">>) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), data);
    setProfile((prev) => prev ? { ...prev, ...data } : prev);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
