import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  doc, 
  getDoc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from "@/lib/firebaseConfig";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'client';
  google_drive_connected: boolean;
  google_access_token?: string;
  google_refresh_token?: string;
  google_token_expiry?: string;
}

export const useFirebaseAuth = () => {
  const [user, setUser] = useState<any>(null);

  // ❗ CORE FIX: allow "undefined" = profile loading state
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // reset profile to "loading"
        setProfile(undefined);

        await fetchProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const profileRef = doc(db, 'profiles', userId);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        // fetch role
        const rolesQuery = query(
          collection(db, 'user_roles'),
          where('user_id', '==', userId)
        );
        const rolesSnap = await getDocs(rolesQuery);

        let role: 'admin' | 'client' = 'client';
        if (!rolesSnap.empty) {
          role = rolesSnap.docs[0].data().role as 'admin' | 'client';
        }

        setProfile({
          id: profileSnap.id,
          ...profileSnap.data(),
          role
        } as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await auth.signOut();
    setProfile(null);
    setUser(null);
    navigate("/auth");
  };

  const isAdmin = profile?.role === 'admin';

  // ✅ Still loading if:
  // 1) firebase loading
  // 2) user exists but profile still undefined
  const profileLoaded = profile !== undefined;
  const authStillLoading = loading || (user && !profileLoaded);

  return {
    user,
    profile,
    loading: authStillLoading,
    signOut,
    isAdmin,
  };
};
