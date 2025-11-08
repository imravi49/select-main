import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';

import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export interface User {
  id: string;
  email: string;
  role?: 'admin' | 'client';
}

export const authService = {
  async signUp(email: string, password: string, fullName?: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (fullName) {
        await updateProfile(user, { displayName: fullName });
      }

      await setDoc(doc(db, 'profiles', user.uid), {
        id: user.uid,
        email: user.email,
        full_name: fullName || email,
        google_drive_connected: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      await setDoc(doc(db, 'user_roles', user.uid), {
        user_id: user.uid,
        role: 'client',
        created_at: serverTimestamp()
      });

      return { user, error: null };
    } catch (error: any) {
      return { user: null, error };
    }
  },

  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { user: userCredential.user, session: userCredential, error: null };
    } catch (error: any) {
      return { user: null, session: null, error };
    }
  },

  async signOut() {
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },

  async getCurrentUser() {
    try {
      const user = auth.currentUser;
      return { user, error: null };
    } catch (error: any) {
      return { user: null, error };
    }
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role: 'admin' | 'client' | undefined;

        try {
          const roleDoc = await getDoc(doc(db, "user_roles", firebaseUser.uid));
          if (roleDoc.exists()) {
            role = roleDoc.data().role;
          }
        } catch (err) {
          console.error("Error fetching role:", err);
        }

        callback({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: role,
        });

      } else {
        callback(null);
      }
    });
  }
};

// ✅ Compatibility export layer for old Supabase-style imports
export const authCompat = auth;
export { authCompat as auth };
export default auth;
