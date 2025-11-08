import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";
import { firebaseDb } from "@/lib/firebaseDb";

// ---- Helpers ----
function sanitizePrefix(name?: string): string | null {
  if (!name || typeof name !== "string") return null;
  const i = name.lastIndexOf(".");
  const base = i > 0 ? name.slice(0, i) : name;
  if (!base.trim()) return null;
  return base.trim();
}

async function getUserIdentity(input: string) {
  const raw = (input || "").trim();
  if (!raw) return null;

  try {
    const d = await getDoc(doc(firestore, "profiles", raw));
    if (d.exists()) return { id: d.id, email: d.data()?.email };
  } catch {}

  const q = query(collection(firestore, "profiles"), where("email", "==", raw));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, email: d.data()?.email };
  }

  return null;
}

async function getSelectedPrefixes(userId: string) {
  const selQ = query(
    collection(firestore, "selections"),
    where("userId", "==", userId),
    where("status", "==", "selected")
  );
  const selSnap = await getDocs(selQ);
  const ids = selSnap.docs.map((d) => d.data().photoId).filter(Boolean);

  const { data } = await firebaseDb.photos.list(userId);
  const photos = data || [];

  const prefixes = new Set<string>();
  photos.forEach((p: any) => {
    if (ids.includes(p.id)) {
      const pref = sanitizePrefix(
        p.name || p.filename || p.fileName || p.title || p.original_name
      );
      if (pref) prefixes.add(pref + "*");
    }
  });

  return Array.from(prefixes);
}

function buildBat(prefixes: string[]) {
  return `@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set "SOURCE=%~dp0"
set "DEST=%SOURCE%SELECTED_WITH_RSF"
if not exist "%DEST%" mkdir "%DEST%"

echo Copying selected files...
echo.

for %%F in (
${prefixes.map((p) => "  " + p).join("\r\n")}
) do (
  for /R "%SOURCE%" %%B in (%%F) do (
    echo Copying %%B
    copy /-Y "%%B" "%DEST%" >nul
  )
)

echo.
echo ✅ DONE — Files copied to SELECTED_WITH_RSF
echo.
pause
`;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], {
    type: "application/octet-stream;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminAdvanced() {
  const [busy, setBusy] = useState(false);

  async function handleExportBat() {
    const input = window.prompt("Enter Client Email OR User ID:");
    if (!input) return;

    setBusy(true);
    try {
      const user = await getUserIdentity(input);
      if (!user) return toast.error("User not found");

      const prefixes = await getSelectedPrefixes(user.id);
      if (!prefixes.length) return toast.info("No selections for this user");

      const batFile = buildBat(prefixes);
      const safe = (user.email || user.id).replace(/[^a-zA-Z0-9._-]/g, "_");
      downloadTextFile(`copy_selected_${safe}.bat`, batFile);

      toast.success("✅ BAT ready — save & run inside client's folder");
    } catch (e) {
      console.error(e);
      toast.error("Failed generating BAT file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Advanced</h2>
        <p className="text-muted-foreground">System utilities & deliverable tools</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Google Drive Sync</CardTitle>
          <CardDescription>Trigger full sync</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Coming Soon
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deliverables</CardTitle>
          <CardDescription>Export client selections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={handleExportBat} disabled={busy}>
            <Download className="h-4 w-4 mr-2" /> Download .BAT Script (Selected)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminAdvanced;
