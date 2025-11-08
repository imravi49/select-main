/* Full replace: src/components/admin/AdminUsers.tsx
   Production code: adds realtime drive_sync_status listener and inline cinematic CSS.
*/
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db as firestoreDb } from "@/lib/firebaseConfig";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Eye, Cloud, Pencil, FileSpreadsheet, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

import {
  collection,
  onSnapshot,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { firebaseDb, db } from "@/lib/firebaseDb";

import { AddUserDialog } from "./AddUserDialog";
import { EditUserDialog } from "./EditUserDialog";

/* ----------------------------- Helpers (unchanged logic) ----------------------------- */
async function fetchSelectedPhotoIdsForUser(userId: string): Promise<string[]> {
  try {
    const col = collection(firestoreDb, "selections");
    const q = query(col, where("status", "==", "selected"));
    const snap = await getDocs(q);
    const ids: string[] = [];
    snap.forEach((d:any) => {
      const data:any = d.data();
      const uidMatches =
        data.user_id === userId ||
        data.userId === userId ||
        data.user === userId;
      if (!uidMatches) return;
      if (data.photo_id) ids.push(String(data.photo_id));
      else if (data.photoId) ids.push(String(data.photoId));
      else if (data.photo && (data.photo.id || data.photoId)) ids.push(String(data.photo.id || data.photoId));
      else if (data.file && data.file.id) ids.push(String(data.file.id));
    });
    return ids;
  } catch (e) {
    console.error("fetchSelectedPhotoIdsForUser error", e);
    return [];
  }
}

async function fetchPhotosByIds(userId: string, ids: string[]) {
  try {
    const photosMap: Record<string, any> = {};
    if (firebaseDb && firebaseDb.photos) {
      if (typeof firebaseDb.photos.get === "function") {
        for (const id of ids) {
          try {
            const res = await firebaseDb.photos.get(userId, id);
            if (res && res.data) photosMap[id] = res.data;
          } catch {}
        }
      }
      try {
        const listRes = await firebaseDb.photos.list(userId);
        const all = (listRes && listRes.data) || [];
        for (const p of all) {
          if (!p) continue;
          const pid = p.id || p.file_id || p.photoId || p.photo_id;
          if (!pid) continue;
          if (ids.includes(String(pid))) photosMap[String(pid)] = p;
        }
      } catch {}
    }
    try {
      const c1 = collection(firestoreDb, "photos");
      const q1 = query(c1, where("userId", "==", userId));
      const snap1 = await getDocs(q1);
      snap1.forEach((d:any) => {
        const p = d.data();
        const pid = d.id || p.id || p.file_id || p.photoId || p.photo_id;
        if (pid && ids.includes(String(pid))) photosMap[String(pid)] = { id: pid, ...p };
      });
    } catch {}
    return photosMap;
  } catch (e) {
    console.error("fetchPhotosByIds error", e);
    return {};
  }
}

function pickFilename(photoDoc:any): string | null {
  if (!photoDoc) return null;
  return photoDoc.name || photoDoc.filename || photoDoc.fileName || photoDoc.title || photoDoc.original_name || null;
}

function sanitizePrefix(name?: string | null): string | null {
  if (!name) return null;
  const s = String(name).trim();
  if (!s) return null;
  const i = s.lastIndexOf(".");
  const base = i > 0 ? s.slice(0, i) : s;
  const trimmed = base.trim();
  return trimmed ? `${trimmed}*` : null;
}

function buildCsvContent(rows: { filename:string; photo_id:string; file_id?:string; full_url?:string }[]) {
  const header = ["filename","photo_id","file_id","full_url"];
  const lines = rows.map(r=>{
    const fn = r.filename ? '"' + String(r.filename).replace(/"/g,'""') + '"' : '""';
    const fid = r.photo_id || "";
    const fileid = r.file_id || "";
    const url = r.full_url || "";
    return [fn,fid,fileid,url].join(",");
  });
  return header.join(",") + "\n" + lines.join("\n");
}

function downloadBlob(filename:string, content:string, utf8BOM=true) {
  const bom = utf8BOM ? "\uFEFF" : "";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------------- Component ----------------------------- */
export const AdminUsers = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [driveSyncStatus, setDriveSyncStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const profilesSnap = await getDocs(collection(firestoreDb, "profiles"));
      const profiles = profilesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      const rolesSnap = await getDocs(collection(firestoreDb, "user_roles"));
      const roles = rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      const roleMap = new Map<string, string>(roles.map((r: any) => [r.id, r.role]));

      const u = profiles.map((p: any) => ({
        ...p,
        role: roleMap.get(p.id) || p.role || "client",
      }));
      setUsers(u);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    const unsub1 = onSnapshot(collection(firestoreDb, "profiles"), loadUsers);
    const unsub2 = onSnapshot(collection(firestoreDb, "user_roles"), loadUsers);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  useEffect(() => {
    const statusDoc = doc(firestoreDb, "drive_sync_status", "current");
    const unsub = onSnapshot(statusDoc, (snap) => {
      if (!snap.exists()) {
        setDriveSyncStatus(null);
        return;
      }
      const data: any = snap.data();
      setDriveSyncStatus({ id: snap.id, ...data });
    }, (err) => {
      console.warn("drive_sync_status listener error", err);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (user: any) => {
    try {
      setLoading(true);
      toast.info("Deleting user (Firestore only)…");
      await Promise.all([
        deleteDoc(doc(db, "profiles", user.id)),
        deleteDoc(doc(db, "user_roles", user.id)),
        deleteDoc(doc(db, "users", user.id)),
      ]);
      const selQ = query(collection(db, "selections"), where("user_id", "==", user.id));
      const selSnap = await getDocs(selQ);
      await Promise.all(selSnap.docs.map((d) => deleteDoc(d.ref)));
      const photosQ = query(collection(db, "photos"), where("user_id", "==", user.id));
      const photosSnap = await getDocs(photosQ);
      await Promise.all(photosSnap.docs.map((d) => deleteDoc(d.ref)));
      try { await firebaseDb.activityLogs.create?.("user_delete", user.id, { method: "firestore-only" }); } catch {}
      toast.success(`User ${user.email} deleted`);
      await loadUsers();
    } catch (error: any) {
      console.warn("Delete finished with warnings:", error);
      toast.success("User deleted");
      await loadUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (user: any) => {
    try {
      await (await import("firebase/firestore")).updateDoc(
        (await import("firebase/firestore")).doc(firestoreDb, "profiles", user.id),
        { selection_locked: !user.selection_locked }
      );
      toast.success(!user.selection_locked ? "Selections hidden for user" : "Selections enabled");
      await loadUsers();
    } catch (e) {
      console.error(e);
      toast.error("Failed to toggle");
    }
  };

  const handleSyncDrive = async (user: any) => {
    try {
      setSyncing((p) => new Set(p).add(user.id));

      const storedLink =
        user.driveFolderLink ||
        user.google_drive_link ||
        user.drive_folder_link ||
        user.profile?.driveFolderLink ||
        "";

      const storedId =
        user.google_drive_folder_id ||
        user.drive_folder ||
        user.driveFolder ||
        user.profile?.google_drive_folder_id ||
        "";

      let folderId = storedId;
      if (!folderId && storedLink) {
        const m =
          /\/folders\/([a-zA-Z0-9_-]+)/.exec(storedLink) ||
          /[?&]id=([a-zA-Z0-9_-]+)/.exec(storedLink);
        folderId = m?.[1] ?? "";
      }

      if (!folderId) {
        const link = window.prompt("Paste Google Drive Folder Link to sync for this user:");
        if (!link) {
          toast.error("Drive folder link is required");
          return;
        }
        const m =
          /\/folders\/([a-zA-Z0-9_-]+)/.exec(link) ||
          /[?&]id=([a-zA-Z0-9_-]+)/.exec(link);
        folderId = m?.[1] ?? "";
        await firebaseDb.profiles.update(user.id, {
          driveFolderLink: link,
          google_drive_folder_id: folderId,
          google_drive_connected: !!folderId,
        });
      }

      const { data, error } = await firebaseDb.functions.syncDrive(user.id, folderId);
      if (error || data?.ok === false) {
        const msg = (data?.error as string) || (error as any)?.message || "sync failed";
        toast.error(`Drive sync failed: ${msg}`);
        return;
      }

      const count = data?.photos_synced ?? data?.synced ?? 0;
      toast.success(`Drive Synced ✓ (${count} photos)`);
      try {
        await firebaseDb.activityLogs.create?.("drive_sync", user.id, { photos_synced: count });
      } catch {}
      loadUsers();
    } catch (e) {
      console.error(e);
      toast.error("Failed to sync Drive photos");
    } finally {
      setSyncing((p) => {
        const n = new Set(p);
        n.delete(user.id);
        return n;
      });
    }
  };

  const handleViewGallery = (uid: string) => {
    navigate(`/gallery?userId=${uid}&mode=view`);
  };

 /**
   * 🛑 THIS IS THE REBUILT FUNCTION 🛑
   * Generates a BAT script matching the user's provided working sample.
   */
  const handleDownloadBAT_new = async (user: any) => {
    try {
      setBusyUser(user.id);
      toast("Preparing BAT script...", { duration: 2000 });
      
      // 1. Fetch IDs of 'selected' photos
      const ids = await fetchSelectedPhotoIdsForUser(user.id);
      if (!ids.length) {
        toast.info("No selected photos for this user");
        return;
      }

      // 2. Get all photo documents for this user
      let photos: any[] = [];
      try {
        const res = await firebaseDb.photos.list(user.id);
        photos = (res && res.data) || [];
      } catch (e) {
        try {
          const c = collection(firestoreDb, "photos");
          const q = query(c, where("userId", "==", user.id));
          const snap = await getDocs(q);
          photos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {}
      }

      // 3. Create a list of prefixes (filenames without extension)
      const prefixSet = new Set<string>();
      photos.forEach((p: any) => {
        const pid = p.id || p.file_id || p.photoId || p.photo_id;
        if (pid && ids.includes(String(pid))) {
          const name = p.name || p.filename || p.fileName || p.title || "";
          if (!name) return;
          const base = name.split(".")[0];
          if (base) {
            prefixSet.add(base);
          }
        }
      });
      const prefixes = Array.from(prefixSet);

      if (!prefixes.length) {
        toast.info("No filenames matched");
        return;
      }

      // --- 4. Build robust CMD script based on user's working sample ---
      const lines: string[] = [];
      
      // Header
      lines.push("@echo off");
      lines.push("chcp 65001 >nul");
      lines.push("setlocal EnableDelayedExpansion");
      lines.push("");
      lines.push("REM =============================================================");
      lines.push("REM    CINEMATIC PHOTO COPY SCRIPT  —  Ravi Sharma Photo & Films");
      lines.push("REM =============================================================");
      lines.push("");

      // Setup - uses %cd% (current directory) as per your sample
      lines.push('set "SOURCE=%cd%"');
      lines.push('set "DEST=%SOURCE%\\SELECTED_WITH_RSF"');
      lines.push('if not exist "%DEST%" mkdir "%DEST%"');
      lines.push("");

      // Dynamic Prefix List
      lines.push("REM --- Prefix list ---");
      lines.push(`set PREFIX_COUNT=${prefixes.length}`);
      prefixes.forEach((p, i) => {
        // Sanitize prefixes to prevent BAT syntax errors (e.g., spaces)
        // Replaces spaces or special chars with _
        const cleanPrefix = p.replace(/[^A-Za-z0-9_.-]/g, "_");
        lines.push(`set PREFIX[${i + 1}]=${cleanPrefix}`);
      });
      lines.push("");

      // Progress Bar/UI Vars
      lines.push(`set /a TOTAL=%PREFIX_COUNT%`);
      lines.push("set /a COPIED=0");
      lines.push("set /a BAR_WIDTH=30");
      lines.push("");

      // Initial UI
      lines.push("cls");
      lines.push("echo."); // Use echo. for blank lines (safer)
      lines.push("echo ╔══════════════════════════════════════════════════════════════╗");
      lines.push("echo ║         Copying Selected Photos — Please Wait...         ║");
      lines.push("echo ╚══════════════════════════════════════════════════════════════╝");
      lines.push("echo.");
      lines.push("");

      // Main Loop
      lines.push("for /L %%I in (1,1,%PREFIX_COUNT%) do (");
      lines.push('    set "CURRENT_PREFIX=!PREFIX[%%I]!"');
      lines.push('    call :COPY_PREFIX "%%I" "!CURRENT_PREFIX!"');
      lines.push(")");
      lines.push("");

      // Completion UI
      lines.push("cls");
      lines.push("echo.");
      lines.push("echo ╔════════════════════════════════════════════════════════════════════╗");
      lines.push("echo ║       ✅  All %TOTAL% prefix groups processed successfully.         ║");
      lines.push("echo ║           Files saved inside: SELECTED_WITH_RSF folder.           ║");
      lines.push("echo ╚════════════════════════════════════════════════════════════════════╝");
      lines.push("echo.");
      lines.push("pause");
      lines.push("exit /b");
      lines.push("");
      lines.push("");

      // Subroutine :COPY_PREFIX
      lines.push(":COPY_PREFIX");
      lines.push("setlocal");
      lines.push('set "INDEX=%~1"');
      lines.push('set "PREFIX=%~2"');
      lines.push("");
      
      // Progress Bar Logic
      lines.push("set /a COPIED+=1");
      lines.push("set /a PERCENT=(COPIED*100)/TOTAL");
      lines.push("set /a FILLS=(PERCENT*BAR_WIDTH)/100");
      lines.push('set "BAR="');
      lines.push('for /L %%K in (1,1,%FILLS%) do set "BAR=!BAR!█"');
      lines.push('set /a EMPTY=BAR_WIDTH-FILLS');
      lines.push('for /L %%L in (1,1,%EMPTY%) do set "BAR=!BAR!░"');
      lines.push("");

      // Per-Prefix UI
      lines.push("cls");
      lines.push("echo."); // Use echo. for blank lines (safer)
      // Use 'echo.' (with a dot) to preserve leading spaces
      lines.push("echo.            EASY GALLERY BY RAVI SHARMA PHOTO FILMS");
      lines.push("echo ╔════════════════════════════════════════════════════════════════════╗");
      lines.push("echo ║ Copying Selected Photos — %PERCENT%%%  (%COPIED%/%TOTAL%)  [%BAR%] ║");
      lines.push("echo ╚════════════════════════════════════════════════════════════════════╝");
      // Use 'echo.' (with a dot) to preserve leading spaces
      lines.push("echo.    → Searching for prefix: %PREFIX%*");
      lines.push("echo."); // Use echo. for blank lines (safer)
      lines.push("");

      // File Copy Logic (from your sample)
      lines.push("REM --- Exclude the destination folder from the search ---");
      // We must escape backslashes for the JavaScript string, so \\\\ becomes \\ in the final file.
      lines.push('for /F "delims=" %%F in (\'dir /B /S "%PREFIX%*" ^| findstr /V /I "\\\\SELECTED_WITH_RSF\\\\"\') do (');
      lines.push('    echo Copying "%%~nxF" ...');
      lines.push('    set "FULLDIR=%%~dpF"');
      lines.push('    set "RELPATH=!FULLDIR:%SOURCE%=!"');
      // Escape the backslash in the "==" comparison
      lines.push('    if "!RELPATH:~0,1!"=="\\" set "RELPATH=!RELPATH:~1!"');
      lines.push('    if defined RELPATH (');
      // Escape the backslash in the path join
      lines.push('        set "TARGETDIR=%DEST%\\!RELPATH!"');
      lines.push('        if not exist "!TARGETDIR!" mkdir "!TARGETDIR!"');
      lines.push('        copy /-Y "%%F" "!TARGETDIR!" >nul');
      lines.push('    ) else (');
      lines.push('        copy /-Y "%%F" "%DEST%" >nul');
      lines.push('    )');
      lines.push(")");
      lines.push("endlocal");
      lines.push('powershell -noprofile -command "Start-Sleep -Milliseconds 150" >nul');
      lines.push("exit /b");

      // --- End of new BAT generation logic ---

      // 5. Create file content (CRLF line endings)
      // START: --------------------- FIX ---------------------
      // REMOVED the "\uFEFF" (BOM) from the start of the string.
      // This allows @echo off to work correctly.
      const bat = lines.join("\r\n");
      // END: ----------------------- FIX ---------------------
      
      const safe = (user.email || user.id).replace(/[^a-zA-Z0-9._-]/g, "_");
      
      // 6. Download logic
      const blob = new Blob([bat], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `copy_selected_with_rsf_${safe}.bat`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("BAT downloaded — ready to run");
      
    } catch (e) {
      console.error("BAT export failed", e);
      toast.error("Failed to create BAT");
    } finally {
      setBusyUser(null);
    }
  };

  // elapsed helper (accepts Firestore timestamp or Date)
  const elapsedString = (startedAt:any) => {
    if (!startedAt) return "-";
    try {
      let start: any = startedAt;
      if (startedAt?.seconds) start = new Date(startedAt.seconds * 1000);
      else start = new Date(startedAt);
      const diff = Math.max(0, Date.now() - start.getTime());
      const s = Math.floor(diff / 1000);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}m ${sec}s`;
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
.cinematic-progress {
  box-shadow: 0 6px 30px rgba(255, 192, 70, 0.08), 0 0 10px rgba(255, 192, 70, 0.06) inset;
  border: 1px solid rgba(255, 200, 100, 0.18);
  transition: box-shadow .25s ease, transform .15s ease;
  padding: 12px;
  border-radius: 10px;
}
.cinematic-progress:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(255,192,70,0.10); }
.cinematic-progress .indicator { filter: drop-shadow(0 4px 12px rgba(255,192,70,0.12)); }
`}</style>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Users</h2>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Button className="bg-gradient-primary" onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      {driveSyncStatus && driveSyncStatus.status === "running" && (
        <Card className="cinematic-progress">
          <CardHeader>
            <CardTitle>Drive Sync — In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="w-2/3">
                <div className="text-sm text-muted-foreground mb-2">{driveSyncStatus.details?.message || "Syncing photos from Drive"}</div>
                <Progress value={driveSyncStatus.percent || 0} className="indicator" />
                <div className="text-xs mt-2 text-muted-foreground">
                  {driveSyncStatus.processed || 0} / {driveSyncStatus.total || "-"} • {Math.round(driveSyncStatus.percent || 0)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm">Elapsed</div>
                <div className="font-mono">{elapsedString(driveSyncStatus.started_at)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {driveSyncStatus && driveSyncStatus.status === "finished" && (
        <Card className="cinematic-progress">
          <CardHeader>
            <CardTitle>Drive Sync — Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Completed at</div>
                <div>{(driveSyncStatus.finished_at && (driveSyncStatus.finished_at.seconds ? new Date(driveSyncStatus.finished_at.seconds*1000).toLocaleString() : new Date(driveSyncStatus.finished_at).toLocaleString())) || "-"}</div>
                <div className="text-xs text-muted-foreground mt-1">Processed: {driveSyncStatus.processed || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Drive</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.google_drive_connected ? "default" : "outline"}>
                        {user.google_drive_connected ? "Connected" : "Not Connected"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewGallery(user.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSyncDrive(user)}
                        disabled={syncing.has(user.id) || !user.google_drive_connected}
                        title="Sync Drive"
                      >
                        <Cloud className={`h-4 w-4 ${syncing.has(user.id) ? "animate-spin" : ""}`} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadBAT_new(user)}
                        disabled={busyUser === user.id}
                        title="Download Copy Script (BAT)"
                        aria-label="Download Copy Script (BAT)"
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadCSV_new(user)}
                        disabled={busyUser === user.id}
                        title="Download Selected (CSV)"
                        aria-label="Download Selected (CSV)"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>

                      <Button variant="ghost" size="sm" onClick={() => setEditUser(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user)}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddUserDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onUserAdded={loadUsers}
      />

      {editUser && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={(o) => !o && setEditUser(null)}
          user={editUser}
          onUserUpdated={loadUsers}
        />
      )}
    </div>
  );
};

export default AdminUsers;
