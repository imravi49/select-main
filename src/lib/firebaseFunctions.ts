import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseConfig";

export const functionsService = {
  /**
   * Sync Google Drive for a user. If folderId is omitted,
   * the backend will read it from the user's profile (driveFolderLink / google_drive_folder_id).
   */
  async syncDrive(payload: { userId: string; folderId?: string }) {
    try {
      const fn = httpsCallable(functions, "syncDrive");
      const res: any = await fn(payload);
      // Normalise return
      if (res?.data?.ok === false) {
        return { data: null, error: res.data.error || "sync-failed" };
      }
      return { data: res?.data || null, error: null };
    } catch (error: any) {
      console.error("syncDrive error", error);
      return { data: null, error };
    }
  },
};
export default functionsService;
