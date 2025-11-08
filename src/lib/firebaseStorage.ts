import { app } from "./firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";

const storage = getStorage(app);

// Pass FULL PATH strings like "logos/logo-123.png" or "hero-images/hero-1.jpg"
export const storageService = {
  async uploadFile(path: string, file: File) {
    try {
      const r = ref(storage, path);
      await uploadBytes(r, file);
      return { data: true, error: null };
    } catch (error) {
      console.error("Storage upload error:", error);
      return { data: null, error };
    }
  },

  async getPublicUrl(path: string) {
    try {
      const r = ref(storage, path);
      return await getDownloadURL(r);
    } catch (error) {
      console.error("Storage url error:", error);
      return null;
    }
  },

  async listFiles(prefix: string) {
    try {
      const r = ref(storage, prefix.endsWith("/") ? prefix : `${prefix}/`);
      const res = await listAll(r);
      return { data: res.items, error: null };
    } catch (error) {
      console.error("Storage list error:", error);
      return { data: [], error };
    }
  },

  async deleteFile(path: string) {
    try {
      const r = ref(storage, path);
      await deleteObject(r);
      return { data: true, error: null };
    } catch (error) {
      console.error("Storage delete error:", error);
      return { data: null, error };
    }
  },
};
