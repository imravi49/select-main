import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  setDoc,
} from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";

// ✅ Missing earlier — now added
import { firebaseDb } from "@/lib/firebaseDb";

import {
  setDoc as adminSetDoc,
  serverTimestamp as adminServerTimestamp,
  addDoc as adminAddDoc,
  collection as adminCollection,
} from "firebase/firestore";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated?: () => void;
  user?: {
    id: string;
    email: string;
    full_name?: string | null;
    role?: string;
    google_drive_folder_id?: string | null;
    selection_limit?: number | null;
  } | null;
}

export const EditUserDialog = ({
  open,
  onOpenChange,
  onUserUpdated,
  user,
}: EditUserDialogProps) => {
  // Prevent crash when user is null — return null (dialog closed)
  if (!user) return null;
  // safeUser ensures all references below are non-null
  const safeUser = user ?? ({} as any);

  const [fullName, setFullName] = useState(safeUser.full_name || "");
  const [role, setRole] = useState<"admin" | "client">(
    (safeUser.role as "admin" | "client") || "client"
  );
  const [driveFolderLink, setDriveFolderLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectionLimit, setSelectionLimit] = useState<number | null>(
    safeUser.selection_limit ?? null
  );
  const [tempPassword, setTempPassword] = useState<string>("");

  useEffect(() => {
    if (safeUser.google_drive_folder_id) {
      setDriveFolderLink(
        `https://drive.google.com/drive/folders/${safeUser.google_drive_folder_id}`
      );
    } else {
      setDriveFolderLink("");
    }
  }, [safeUser.google_drive_folder_id]);

  const extractFolderId = (url: string): string | null => {
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const parseFolderId = (link?: string) => {
    if (!link) return "";
    const m = String(link).match(/folders\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await firebaseDb.profiles.update(safeUser.id, {
        full_name: fullName || safeUser.full_name || "",
        email: safeUser.email || "",
        selection_limit: Number(0),
        driveFolderLink: driveFolderLink || "",
        google_drive_folder_id: parseFolderId(driveFolderLink),
        google_drive_connected: !!driveFolderLink,
        updated_at: new Date(),
      });

      if (role !== safeUser.role) {
        await setDoc(
          doc(firestore, "user_roles", safeUser.id),
          {
            user_id: safeUser.id,
            role,
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      await addDoc(collection(firestore, "activity_logs"), {
        type: "user_updated",
        user_id: safeUser.id,
        full_name: fullName,
        role,
        drive_folder: parseFolderId(driveFolderLink),
        timestamp: new Date().toISOString(),
      });

      toast.success("User updated successfully");
      onUserUpdated && onUserUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const handleReenableSelections = async () => {
    try {
      setLoading(true);

      await setDoc(
        doc(firestore, "profiles", safeUser.id),
        {
          selection_finalized: false,
          selection_locked: false,
          updated_at: adminServerTimestamp(),
        },
        { merge: true }
      );

      try {
        await setDoc(
          doc(firestore, "selections", String(safeUser.id)),
          {
            userId: String(safeUser.id),
            finalized: false,
            updated_at: adminServerTimestamp(),
          },
          { merge: true }
        );
      } catch {}

      try {
        await addDoc(collection(firestore, "activity_logs"), {
          type: "unfinalize",
          user_id: safeUser.id,
          by: "admin",
          created_at: adminServerTimestamp(),
        });
      } catch {}

      toast.success("Selections re-enabled for user");
    } catch (e) {
      console.error(e);
      toast.error("Failed to re-enable user selections");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAdminChanges = async () => {
    try {
      setLoading(true);
      const payload: any = {
        updated_at: adminServerTimestamp(),
      };
      if (selectionLimit != null && !Number.isNaN(selectionLimit)) {
        payload.selection_limit = Number(selectionLimit);
      }
      if (tempPassword && tempPassword.length > 0) {
        payload.temp_password = tempPassword;
      }
      await setDoc(doc(firestore, "profiles", safeUser.id), payload, {
        merge: true,
      });
      toast.success("Admin changes saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save admin changes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email (Read-only)</Label>
            <Input id="email" value={safeUser.email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "admin" | "client")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driveFolder">Google Drive Folder Link (Optional)</Label>
            <Input
              id="driveFolder"
              value={driveFolderLink}
              onChange={(e) => setDriveFolderLink(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <p className="text-xs text-muted-foreground">
              Paste the full Google Drive folder link
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="selectionLimit">Selection Limit</Label>
            <Input
              id="selectionLimit"
              type="number"
              min={1}
              value={(selectionLimit ?? safeUser.selection_limit ?? 50).toString()}
              onChange={(e) => setSelectionLimit(Number(e.target.value || 0))}
              placeholder="e.g., 50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tempPassword">Temporary Password</Label>
            <Input
              id="tempPassword"
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Set a temporary password note"
            />
            <p className="text-xs text-muted-foreground">
              Note: This does not change Firebase Auth actual password.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReenableSelections}
            >
              Re-enable selections
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyAdminChanges}
            >
              Apply Admin Changes
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
