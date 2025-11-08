import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createUserWithEmailAndPassword, updateProfile, getAuth } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";

import { auth, db as firestore, app as primaryApp } from "@/lib/firebaseConfig";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: () => void;
}

export const AddUserDialog = ({ open, onOpenChange, onUserAdded }: AddUserDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "client",
    selectionLimit: "50",
    driveFolderLink: "",
  });

  const extractFolderId = (link: string): string => {
    const m = link.match(/folders\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : link;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ Create secondary auth so admin session is not replaced
      const secondaryApp =
        window._secondaryApp ||
        (window._secondaryApp = import("firebase/app").then(({ initializeApp }) =>
          initializeApp(primaryApp.options, "SecondaryApp")
        ));

      const appInstance = await secondaryApp;
      const secondaryAuth = getAuth(appInstance);

      // ✅ 1) Create Firebase Auth user using secondary app
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        formData.password
      );

      if (formData.name) {
        await updateProfile(cred.user, { displayName: formData.name });
      }

      // ✅ 2) Create Firestore profile (admin still logged in on main app!)
      const folderId = formData.driveFolderLink ? extractFolderId(formData.driveFolderLink) : null;

      await setDoc(
        doc(firestore, "profiles", cred.user.uid),
        {
          id: cred.user.uid,
          email: formData.email,
          full_name: formData.name,
          selection_limit: Number(formData.selectionLimit) || 50,
          google_drive_folder_id: folderId || null,
          google_drive_connected: !!folderId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ 3) Assign role
      await setDoc(
        doc(firestore, "user_roles", cred.user.uid),
        {
          user_id: cred.user.uid,
          role: formData.role,
          created_at: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ 4) Log activity
      try {
        await addDoc(collection(firestore, "activity_logs"), {
          type: "user_created",
          user_id: cred.user.uid,
          email: formData.email,
          role: formData.role,
          created_at: serverTimestamp(),
        });
      } catch (err) {
        console.warn("Activity log write failed, continuing...");
      }

      // ✅ Clean up secondary session
      await secondaryAuth.signOut();

      toast.success(`User ${formData.name} created successfully`);

      // Reset & close
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "client",
        selectionLimit: "50",
        driveFolderLink: "",
      });

      onOpenChange(false);
      onUserAdded();
    } catch (error: any) {
      console.error("Add user error:", error);
      toast.error(error?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with credentials and optional Drive access
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={formData.role} onValueChange={value => setFormData({ ...formData, role: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Selection Limit</Label>
            <Input type="number" value={formData.selectionLimit} onChange={e => setFormData({ ...formData, selectionLimit: e.target.value })} min="1" />
          </div>

          <div className="space-y-2">
            <Label>Google Drive Folder Link (Optional)</Label>
            <Input value={formData.driveFolderLink} onChange={e => setFormData({ ...formData, driveFolderLink: e.target.value })} />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-gradient-primary">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// helper: extract folder id from a shareable link
const parseFolderId = (link?: string) => {
  if (!link) return "";
  const m = String(link).match(/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : "";
};
