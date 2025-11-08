/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebaseConfig";
import { getFirestore } from "firebase/firestore";

export const __mergeDb = getFirestore();

type Photo = {
  id: string;
  user_id?: string;
  userId?: string;
  name?: string;
  created_at?: any;
  [k: string]: any;
};

function parseFolderId(input?: string | null) {
  if (!input) return "";
  const m =
    /\/folders\/([a-zA-Z0-9_-]+)/.exec(input) ||
    /[?&]id=([a-zA-Z0-9_-]+)/.exec(input);
  return m?.[1] ?? "";
}

export const firebaseDb: any = {
  /* ------------------------ userRoles ------------------------ */
  userRoles: {
    async list() {
      try {
        const snap = await getDocs(collection(db, "user_roles"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  /* ------------------------ profiles ------------------------ */
  profiles: {
    async get(userId: string) {
      try {
        const ref = doc(db, "profiles", userId);
        const s = await getDoc(ref);
        if (s.exists()) return { data: { id: s.id, ...s.data() }, error: null };
        return { data: null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async list() {
      try {
        const qRef = query(
          collection(db, "profiles"),
          orderBy("created_at", "desc")
        );
        const s = await getDocs(qRef);
        const data = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async update(userId: string, updates: any) {
      try {
        const ref = doc(db, "profiles", userId);
        await setDoc(ref, { ...updates, updated_at: serverTimestamp() }, { merge: true });
        return { data: { id: userId, ...updates }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async patch(userId: string, partial: Record<string, any>) {
      try {
        await setDoc(doc(db, "profiles", userId), partial, { merge: true });
        return { error: null };
      } catch (error) {
        return { error };
      }
    },

    async delete(userId: string) {
      try {
        await deleteDoc(doc(db, "profiles", userId));
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
  },

  /* ------------------------ photos ------------------------ */
  photos: {
    async list(userId: string) {
      try {
        // flat (user_id)
        try {
          const qFlatA = query(collection(db, "photos"), where("user_id", "==", userId));
          const sA = await getDocs(qFlatA);
          if (!sA.empty) {
            return {
              data: sA.docs.map((d) => ({ id: d.id, ...d.data() })),
              error: null,
            };
          }
        } catch (err) {
          console.warn("Flat query (user_id) failed:", err);
        }

        // flat (userId)
        try {
          const qFlatB = query(collection(db, "photos"), where("userId", "==", userId));
          const sB = await getDocs(qFlatB);
          if (!sB.empty) {
            return {
              data: sB.docs.map((d) => ({ id: d.id, ...d.data() })),
              error: null,
            };
          }
        } catch (err) {
          console.warn("Flat query (userId) failed:", err);
        }

        // nested: /photos/{userId}/items/*
        try {
          const nestedRef = collection(db, "photos", userId);
          const nestedSnap = await getDocs(nestedRef);
          if (!nestedSnap.empty) {
            return {
              data: nestedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
              error: null,
            };
          }
        } catch (err) {
          console.warn("Nested photos subcollection lookup failed:", err);
        }

        return { data: [], error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async getByFileId(userId: string, fileId: string) {
      try {
        const flat = query(
          collection(db, "photos"),
          where("file_id", "==", fileId),
          where("userId", "==", userId)
        );
        const s = await getDocs(flat);
        if (!s.empty) return { data: { id: s.docs[0].id, ...s.docs[0].data() }, error: null };

        const nested = await getDoc(doc(db, "photos", userId, "items", fileId));
        if (nested.exists()) return { data: { id: nested.id, ...nested.data() }, error: null };

        return { data: null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async create(photo: any) {
      try {
        const ref = await addDoc(collection(db, "photos"), {
          ...photo,
          created_at: serverTimestamp(),
        });
        return { data: { id: ref.id, ...photo }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async bulkCreate(photos: any[]) {
      try {
        const batch = writeBatch(db);
        const col = collection(db, "photos");
        photos.forEach((p) => {
          const r = doc(col);
          batch.set(r, { ...p, created_at: serverTimestamp() });
        });
        await batch.commit();
        return { data: photos, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async delete(photoId: string) {
      try {
        await deleteDoc(doc(db, "photos", photoId));
        return { error: null };
      } catch (error) {
        return { error };
      }
    },

    async toCsvRows(userId: string) {
      const { data, error } = await firebaseDb.photos.list(userId);
      if (error) throw error;
      const rows = (data ?? []).map((p: Photo) => ({
        id: p.id,
        name: p.name ?? "",
        userId: p.userId ?? p.user_id ?? userId,
      }));
      return rows;
    },
  },

  /* ------------------------ selections (original) ------------------------ */
  selections: {
    // reset nested selections for a user: /selections/{userId} (resume) + /selections/{userId}/*
   async resetUser(userId: string) {
  // Parent doc: /selections/{userId}
  const userDoc = doc(db, "selections", userId);

  // Subcollection: /selections/{userId}/items
  const userSelections = collection(userDoc, "items");

  const snap = await getDocs(userSelections);
  const batch = writeBatch(db);

  // delete all child selection docs
  snap.forEach((d) => batch.delete(d.ref));

  // delete the main selection doc (resume pointer)
  batch.delete(userDoc);

  await batch.commit();
  return { ok: true };
},


    async list(userId: string) {
      try {
        const tryFetch = async (field: "userId" | "user_id") => {
          const qRef = query(collection(db, "selections"), where(field, "==", userId));
          return await getDocs(qRef);
        };

        let snap = await tryFetch("userId");
        if (snap.empty) snap = await tryFetch("user_id");

        const selections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const withPhotos = await Promise.all(
          selections.map(async (sel: any) => {
            const pid = sel.photoId || sel.photo_id || "";
            let pDoc = pid ? await getDoc(doc(db, "photos", pid)) : null;

            if (!pDoc || !pDoc.exists()) {
              const qp = query(collection(db, "photos"), where("file_id", "==", pid));
              const sp = await getDocs(qp);
              if (!sp.empty) pDoc = sp.docs[0];
            }

            return {
              ...sel,
              photos: pDoc && pDoc.exists() ? { id: pDoc.id, ...pDoc.data() } : null,
            };
          })
        );

        return { data: withPhotos, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async upsert(selection: any) {
      try {
        const payload = {
          ...selection,
          userId: selection.userId || selection.user_id,
          user_id: selection.user_id || selection.userId,
          photoId: selection.photoId || selection.photo_id,
          photo_id: selection.photo_id || selection.photoId,
          updated_at: serverTimestamp(),
          created_at: selection.created_at || serverTimestamp(),
        };

        const keyUser = payload.userId || payload.user_id;
        const keyPhoto = payload.photoId || payload.photo_id;
        const deterministicId = `${keyUser}__${keyPhoto}`;

        await setDoc(doc(collection(db, "selections"), deterministicId), payload, { merge: true });
        return { data: { id: deterministicId, ...payload }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async finalize(userId: string) {
      try {
        const qA = query(collection(db, "selections"), where("userId", "==", userId));
        const sA = await getDocs(qA);
        const qB = query(collection(db, "selections"), where("user_id", "==", userId));
        const sB = await getDocs(qB);

        const batch = writeBatch(db);
        [...sA.docs, ...sB.docs].forEach((d) => {
          batch.set(
            d.ref,
            { finalized: true, finalized_at: serverTimestamp(), updated_at: serverTimestamp() },
            { merge: true }
          );
        });
        await batch.commit();

        await setDoc(
          doc(db, "profiles", userId),
          {
            selection_finalized: true,
            selection_locked: true,
            finalized_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );

        return { data: { finalized: true }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  /* ------------------------ feedback ------------------------ */
  feedback: {
    async create(userId: string, message: string) {
      try {
        const r = await addDoc(collection(db, "feedback"), {
          user_id: userId,
          message,
          created_at: serverTimestamp(),
        });
        return { ok: true, id: r.id };
      } catch (e) {
        console.error("feedback error", e);
        return { ok: false, error: String(e) };
      }
    },

    async add(data: Record<string, any>) {
      try {
        await addDoc(collection(db, "feedback"), data);
        return { error: null };
      } catch (error) {
        return { error };
      }
    },

    async list() {
      try {
        const qRef = query(collection(db, "feedback"), orderBy("created_at", "desc"));
        const s = await getDocs(qRef);
        const data = await Promise.all(
          s.docs.map(async (d) => {
            const fb = { id: d.id, ...d.data() } as any;
            const p = await getDoc(doc(db, "profiles", fb.user_id));
            return { ...fb, profiles: p.exists() ? { id: p.id, ...p.data() } : null };
          })
        );
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  /* ------------------------ activity logs ------------------------ */
  activityLogs: {
    async create(action: string, userId?: string, details?: any) {
      try {
        const r = await addDoc(collection(db, "activity_logs"), {
          action,
          user_id: userId || null,
          details: details || null,
          created_at: serverTimestamp(),
        });
        return { data: { id: r.id, action, user_id: userId, details }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async list(limitCount = 100) {
      try {
        const qRef = query(
          collection(db, "activity_logs"),
          orderBy("created_at", "desc"),
          firestoreLimit(limitCount)
        );
        const s = await getDocs(qRef);
        const data = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  /* ------------------------ settings ------------------------ */
  settings: {
    async getDesign() {
      try {
        const r = doc(db, "settings", "design");
        const s = await getDoc(r);
        if (s.exists()) return { data: { id: s.id, ...s.data() }, error: null };
        return {
          data: {
            logo_url: "",
            primary_color: "#8B5CF6",
            secondary_color: "#0EA5E9",
            font_family: "Inter",
          },
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },

    async updateDesign(updates: any) {
      try {
        const r = doc(db, "settings", "design");
        await setDoc(r, { ...updates, updated_at: serverTimestamp() }, { merge: true });
        return { data: updates, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async getApp() {
      try {
        const r = doc(db, "settings", "app");
        const s = await getDoc(r);
        if (s.exists()) return { data: { id: s.id, ...s.data() }, error: null };
        return {
          data: {
            hero_title: "Your Photo Gallery",
            hero_subtitle: "Select your favorite moments",
            contact_email: "",
            contact_phone: "",
            feedback_prompt: "We value your feedback",
          },
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },

    async updateApp(updates: any) {
      try {
        const r = doc(db, "settings", "app");
        await setDoc(r, { ...updates, updated_at: serverTimestamp() }, { merge: true });
        return { data: updates, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  /* ------------------------ functions ------------------------ */
  functions: {
    async syncDrive(userId: string, folderId?: string) {
      try {
        const fn = httpsCallable(functions, "syncDrive");
        const res: any = await fn({ userId, folderId });
        return { data: res.data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  /* ---------- NEW deterministic selections (additive) ---------- */
  selections2: {
    async setStatus(userId: string, photoId: string, status: string, lastViewedIndex: number) {
      try {
        if (!userId || !photoId) throw new Error("Missing userId or photoId");
        const cleanId = `${userId}__${photoId}`;
        const payload: any = {
          userId,
          photoId,
          status,
          lastViewedIndex: typeof lastViewedIndex === "number" ? lastViewedIndex : 0,
          updated_at: serverTimestamp(),
          created_at: serverTimestamp(),
        };
        await setDoc(doc(db, "selections", cleanId), payload, { merge: true });
        await setDoc(
          doc(db, "selections", userId),
          { userId, lastIndex: payload.lastViewedIndex, updated_at: serverTimestamp() },
          { merge: true }
        );
        return { data: { id: cleanId, ...payload }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    async listByUser(userId: string) {
      try {
        const qs = await getDocs(query(collection(db, "selections"), where("userId", "==", userId)));
        return { data: qs.docs.map((d) => ({ id: d.id, ...d.data() })), error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  /* ------------------------ resume helpers ------------------------ */
  resume: {
    async get(userId: string) {
      try {
        const s = await getDoc(doc(db, "selections", userId));
        return { data: s.exists() ? { id: s.id, ...(s.data() as any) } : null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async setIndex(userId: string, lastIndex: number) {
      try {
        await setDoc(
          doc(db, "selections", String(userId)),
          { userId: String(userId), lastIndex, updated_at: serverTimestamp() },
          { merge: true }
        );
        return { data: { lastIndex }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },
};

/* --- SAFE STATS FALLBACK (Option-B compatibility) --- */
if (!firebaseDb.stats) {
  firebaseDb.stats = {
    async getLastViewedIndex() {
      return { data: 0, error: null };
    },
  };
}

export { db };
export default db;

/* Legacy export preserved to avoid breaking imports */
export async function resetSelections(userId: string, _password?: string) {
  return firebaseDb.selections.resetUser(userId);
}
