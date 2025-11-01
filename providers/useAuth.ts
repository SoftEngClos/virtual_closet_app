import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

export function useAuth() {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUid(u.uid);
        setReady(true);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          setUid(cred.user.uid);
        } finally {
          setReady(true);
        }
      }
    });
    return unsub;
  }, []);

  return { ready, uid };
}
