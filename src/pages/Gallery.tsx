import { signInWithEmailAndPassword } from "firebase/auth";
// ✅ Correct source for your project (NOT from firebase/auth)
// ✅ Correct imports for reset password re-auth
import { auth } from "@/lib/firebaseConfig";
import {EmailAuthProvider,reauthenticateWithCredential} from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Button } from "@/components/ui/button";
import CinematicHeader from "@/components/CinematicHeader";

import { Card } from "@/components/ui/card";
import { Loader2, LogOut, Image as ImageIcon, Download, ArrowLeft, Eye, Minimize2, Check, Clock } from "lucide-react";
import { firebaseDb } from "@/lib/firebaseDb";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

/* -------------------------------------------------------
   Types (kept compatible with existing data)
------------------------------------------------------- */
interface Photo {
  id: string;
  filename?: string;
  name?: string;
  thumbnail_url?: string;
  thumb_url?: string;
  full_url?: string;
  url?: string;
  drive_file_id?: string;
  file_id?: string;
  folder_path?: string;   // "Main/Sub/..."
  folder_name?: string;   // "Main"
  folderId?: string;      // when only ID is present from Drive sync
}

type Status = "selected" | "later" | "skip";

/* -------------------------------------------------------
   SafeImg — resilient image with multi-step fallback
   - Tries: thumbnail -> full -> direct Drive (uc?export=view)
   - Adds cache-busting once if a 4xx/429 occurs
------------------------------------------------------- */
function buildDriveViewUrl(id?: string) {
  if (!id) return "";
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

function buildHighResCandidates(p: Photo) {
  const id = p.drive_file_id || p.file_id;
  const best =
    p.full_url ||
    p.url ||
    (id ? `https://drive.google.com/uc?export=download&id=${id}` : "");
  // Google Drive may throttle; keep fallback to normal candidates
  return Array.from(new Set([best, ...buildCandidates(p)])) as string[];
}
function buildCandidates(p: Photo) {
  const id = p.drive_file_id || p.file_id;
  const t1 = p.thumbnail_url || p.thumb_url;
  const f1 = p.full_url || p.url;
  const d1 = buildDriveViewUrl(id);
  const uniq = Array.from(new Set([t1, f1, d1].filter(Boolean))) as string[];
  return uniq;
}
const SafeImg: React.FC<{
  photo: Photo;
  className?: string;
  alt?: string;
  forceHighRes?: boolean;
}> = ({ photo, className, alt, forceHighRes }) => {
  const tried = useRef<Set<string>>(new Set());
  const [src, setSrc] = useState<string>(() => {
    const c = forceHighRes ? buildHighResCandidates(photo) : buildCandidates(photo);
    return c[0] || "";
  });
  const [busted, setBusted] = useState(false);

  // NOTE...

  useEffect(() => {
    const c = forceHighRes ? buildHighResCandidates(photo) : buildCandidates(photo);
    setSrc(c[0] || "");
    tried.current = new Set();
    setBusted(false);
  }, [photo, forceHighRes]);

  useEffect(() => {
    // reset when photo changes
    tried.current.clear();
    const c = buildCandidates(photo);
    setBusted(false);
    setSrc(c[0] || "");
  }, [photo?.id]);

  const onError = () => {
    const candidates = buildCandidates(photo);
    tried.current.add(src);
    // try next unused candidate
    const next = candidates.find((u) => !tried.current.has(u));
    if (next) {
      setSrc(next);
      return;
    }
    // last resort: cache-bust once to dodge 429s
    if (!busted && src) {
      setBusted(true);
      setSrc(src.includes("?") ? `${src}&cb=${Date.now()}` : `${src}?cb=${Date.now()}`);
      return;
    }
    // nothing works — show transparent 1x1
    setSrc(
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
    );
  };

  return (
    <img
      src={src}
      onError={onError}
      alt={alt || photo.filename || photo.name || "photo"}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
    />
  );
};

/* -------------------------------------------------------
   Helpers for folder labels (no raw IDs on UI)
   - Prefer explicit names/path; otherwise group by ID and
     show "Album 1/2/3…" so the UI doesn't leak IDs.
------------------------------------------------------- */
const pathOf = (p: Photo): string => {
  const raw =
    (p.folder_path && String(p.folder_path)) ||
    (p.folder_name && String(p.folder_name)) ||
    "";
  return raw.trim();
};
const labelOf = (p: Photo, folderOrder: Map<string, number>): string => {
  const explicit = pathOf(p);
  if (explicit) return explicit.split(/[\\/]/)[0] || "Uncategorized";
  const fid = String(p.folderId || "").trim();
  if (!fid) return "Uncategorized";
  const n = folderOrder.get(fid);
  return n ? `Album ${n}` : "Album";
};

// ✅ Added helper: real folder names
const labelOfWithMap = (
  p: Photo,
  folderOrder: Map<string, number>,
  folderMap: Record<string,string>
): string => {
  const explicit = pathOf(p);
  if (explicit) return explicit.split(/[\\/]/)[0] || "Uncategorized";
  const fid = String(p.folderId || "").trim();
  if (!fid) return "Uncategorized";
  const real = folderMap?.[fid];
  if (real && real.trim()) return real;
  const n = folderOrder.get(fid);
  return n ? `Album ${n}` : "Album";
};


const Gallery = () => {
  const { user, profile, loading, signOut } = useFirebaseAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "select"; // 'select' | 'view'
  const viewUserId = searchParams.get("userId");
  const targetUserId = viewUserId || profile?.id || user?.uid;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folderMap, setFolderMap] = useState<Record<string,string>>({});
  const [selectionLimit, setSelectionLimit] = useState<number | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [selections, setSelections] = useState<Map<string, Status>>(new Map());
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ---- LOCK: helpers ----
  const isLocked = finalized && mode === "select";
  const toastLocked = () => toast.message("Selections locked — contact photographer to reopen");

  // Categories (top-level + sub)
  const [topCat, setTopCat] = useState<string>("All");
  const [subCat, setSubCat] = useState<string>("All");

  // Touch swipe refs (horizontal + vertical)
  const touchStartX = useRef<number | null>(null);
  const touchMoveX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchMoveY = useRef<number | null>(null);

  // -------- ROUTE GUARDS ----------
  useEffect(() => {
    if (!loading && !targetUserId) {
      navigate("/auth");
    }
  }, [loading, targetUserId, navigate]);

  /* -------------------------------------------------------
     Build folder order map (so identical folderId don’t show
     raw IDs; instead “Album 1/2/3…”) and category sources
  ------------------------------------------------------- */
  const folderOrder = useMemo(() => {
    const ids = Array.from(
      new Set(photos.map((p) => String(p.folderId || "")).filter(Boolean))
    );
    const m = new Map<string, number>();
    ids.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [photos]);

  const topCategories = useMemo(() => {
    const s = new Set<string>();
    photos.forEach((p) => {
      const top = pathOf(p).split(/[\\/]/)[0];
      if (top) s.add(top);
      else if (p.folderId) s.add(labelOfWithMap(p, folderOrder, folderMap));
      else s.add("Uncategorized");
    });
    return ["All", ...Array.from(s).sort()];
  }, [photos, folderOrder]);

  const subCategories = useMemo(() => {
    if (topCat === "All") return ["All"];
    const s = new Set<string>();
    photos.forEach((p) => {
      const path = pathOf(p);
      if (path) {
        const parts = path.split(/[\\/]/);
        if (parts[0] === topCat && parts[1]) s.add(parts[1]);
      }
    });
    return ["All", ...Array.from(s).sort()];
  }, [photos, topCat]);

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      const top = pathOf(p).split(/[\\/]/)[0] || (p.folderId ? labelOfWithMap(p, folderOrder, folderMap) : "Uncategorized");
      if (topCat !== "All" && top !== topCat) return false;
      if (subCat !== "All") {
        const parts = pathOf(p).split(/[\\/]/);
        if (parts[1] !== subCat) return false;
      }
      return true;
    });
  }, [photos, folderOrder, topCat, subCat]);

  const current = filtered[currentIndex];

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0,y:0});
  const pinchStart = useRef<{d:number, cx:number, cy:number} | null>(null);
  const [forceHiRes, setForceHiRes] = useState(false);
  const lastTap = useRef<number>(0);
  const lastTouchPos = useRef<{x:number,y:number}|null>(null);


  // -------- LOAD ----------
  useEffect(() => {
    const run = async () => {
      if (!targetUserId) return;
      setLoadingPhotos(true);

      const profRes = await firebaseDb.profiles.get(targetUserId);
      if (profRes?.data) {
        setSelectionLimit(profRes.data.selection_limit ?? null);
        setFinalized(!!profRes.data.selection_finalized || !!profRes.data.selection_locked);
      }

      const { data } = await firebaseDb.photos.list(targetUserId);
      setPhotos((data as Photo[]) || []);

      try { const names = await firebaseDb.driveFolders?.map?.(String(targetUserId)); setFolderMap(names || {} as any); } catch {}

// ✅ FIX: load selections from both legacy and selections2
try {
  const legacy = await firebaseDb.selections.list(targetUserId);
  const modern = await (firebaseDb as any).selections2?.listByUser?.(targetUserId);

  const map = new Map<string, Status>();

  const push = (arr: any[] | undefined) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((s) => {
      const pid =
        s.photo_id ||
        s.photoId ||
        s.file_id ||
        s.fileId ||
        s.id;

      const st =
        s.status ||
        s.value ||
        s.selection ||
        s.state;

      if (pid && st) {
        map.set(String(pid), st as Status);
      }
    });
  };

  push(legacy?.data);
  push(modern?.data);

  setSelections(map);
} catch (err) {
  console.warn("⚠️ failed to load selections", err);
}



      const last = await firebaseDb.stats.getLastViewedIndex(targetUserId);
      if (typeof last.data === "number" && last.data > 0) {
        setCurrentIndex(Math.min(last.data, Math.max(0, (data?.length ?? 1) - 1)));
      }

      setLoadingPhotos(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  // Keyboard for desktop (only in fullscreen + select mode)
  useEffect(() => {
    if (!isFullscreen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => {
          const ni = Math.max(0, i - 1);
          firebaseDb.resume?.setIndex?.(String(targetUserId), ni);
          return ni;
        });
      }

      if (e.key === "ArrowRight") {
        setCurrentIndex((i) => {
          const ni = Math.min(filtered.length - 1, i + 1);
          firebaseDb.resume?.setIndex?.(String(targetUserId), ni);
          return ni;
        });
      }

      if (mode === "select") {
  // UP key = SELECT
  if (e.key === "ArrowUp") {
    e.preventDefault();
    doSelect("selected");
    return;
  }

  // DOWN key = LATER
  if (e.key === "ArrowDown") {
    e.preventDefault();
    doSelect("later");
    return;
  }
}


      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, mode, filtered.length, targetUserId]);

  // ---------- ACTIONS ----------

  // ✅ New deterministic selection handler (uses selections2)
 const doSelect2 = async (status: "selected" | "later" | "skip") => {
  if (isLocked) { toastLocked(); return; }
  const p = current;
  if (!p || !targetUserId) return;
  const photoId = String(p.id || p.file_id || (p as any).photoId || (p as any).fileId || "");
  if (!photoId) return;

  // ✅ enforce selection limit
  if (status === "selected" && selectionLimit != null) {
  const count = Array.from(selections.values()).filter((s) => s === "selected").length;
  const alreadySelected = selections.get(photoId) === "selected";

  if (count >= selectionLimit && !alreadySelected) {
    toast.info(`You can select up to ${selectionLimit} photos`);
    return;
  }
  }

  // ✅ optimistic UI update
  const m = new Map(selections);
  m.set(photoId, status);
  setSelections(m);

  // ✅ save to DB (new selections2)
  const res = await (firebaseDb as any).selections2?.setStatus?.(
    String(targetUserId),
    photoId,
    status,
    currentIndex
  );

  if (res?.error) console.error(res.error);
  else {
    if (status==='selected') toast.success('Added to Selected'); else if (status==='later') toast.message('Added to Later');
  }

  // ✅ move forward automatically
  if (currentIndex < filtered.length - 1) {
    setCurrentIndex(currentIndex + 1);
  }
};


// ✅ Direct selection by photoId (for thumbnail icon clicks) — no reliance on currentIndex state sync
const doSelectForPhoto = async (photoId: string, status: "selected" | "later", idx?: number) => {
  if (isLocked) { toastLocked(); return; }
  if (!photoId || !targetUserId) return;

  // enforce limit
  if (status === "selected" && selectionLimit != null) {
    const count = Array.from(selections.values()).filter((s) => s === "selected").length;
    const already = selections.get(photoId) === "selected";
    if (count >= selectionLimit && !already) {
      toast.info(`You can select up to ${selectionLimit} photos`);
      return;
    }
  }

  const m = new Map(selections);
  m.set(photoId, status);
  setSelections(m);

  try {
    const res = await (firebaseDb as any).selections2?.setStatus?.(
      String(targetUserId),
      photoId,
      status,
      typeof idx === "number" ? idx : currentIndex
    );
    if (res?.error) console.error(res.error);
  } catch (e) {
    console.error(e);
  }
};

  const doSelect = async (status: Status) => {
    if (isLocked) { toastLocked(); return; }
    if (mode === "view") return;
    if (!current || !targetUserId) return;

    if (status === "selected" && selectionLimit != null) {
      const count = Array.from(selections.values()).filter((s) => s === "selected").length;
      const alreadySelected = selections.get(current.id) === "selected";
      if (count >= selectionLimit && !alreadySelected) {
        toast.info(`You can select up to ${selectionLimit} photos`);
        return;
      }
    }

    const m = new Map(selections);
    m.set(current.id, status);
    setSelections(m);

    await firebaseDb.selections.upsert({
      user_id: targetUserId,
      photo_id: current.id,
      status,
      last_viewed_index: currentIndex,
      updated_at: new Date().toISOString(),
    });

    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleThumbClick = (idx: number) => {
    if (isLocked) { toastLocked(); return; }
    setCurrentIndex(idx);
    setIsFullscreen(true);
    document.documentElement.requestFullscreen?.();
  };


  // --- Keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === "ArrowUp" && isFullscreen) { e.preventDefault(); const btn=document.getElementById("select-btn"); if(btn instanceof HTMLButtonElement) btn.click(); else doSelect("selected"); }
      if (e.key === "ArrowDown" && isFullscreen) { e.preventDefault(); const btn=document.getElementById("later-btn"); if(btn instanceof HTMLButtonElement) btn.click(); else doSelect("later"); }
      if (e.key === "Escape" && isFullscreen) { e.preventDefault(); setIsFullscreen(false); document.exitFullscreen?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, selections, currentIndex, filtered]);


  const onTouchStart = (e: React.TouchEvent) => {
    // NOTE: double-tap zoom disabled (only pinch-to-zoom allowed).
    // Prevent default when in fullscreen to stop browser double-tap/native zoom gestures.
    if (isFullscreen) {
      e.preventDefault();
    }

    // Record timestamp (kept for compatibility but NOT used to toggle zoom)
    if (e.touches.length === 1) {
      const t = e.touches[0];
      lastTouchPos.current = { x: t.clientX, y: t.clientY };
      lastTap.current = Date.now();
      touchStartX.current = t.clientX;
      touchMoveX.current = null;
      touchStartY.current = t.clientY;
      touchMoveY.current = null;
      return;
    }

    if (e.touches.length === 2) {
      const [a,b] = [e.touches[0], e.touches[1]];
      const dx = a.clientX - b.clientX; const dy = a.clientY - b.clientY;
      pinchStart.current = { d: Math.hypot(dx,dy), cx: (a.clientX+b.clientX)/2, cy: (a.clientY+b.clientY)/2 };
      return;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // prevent document scrolling while in fullscreen viewer for stable swipe gestures
    if (isFullscreen) {
      // preventDefault handled by native non-passive listener
    }

    if (e.touches.length === 2 && pinchStart.current) {
      const [a,b] = [e.touches[0], e.touches[1]];
      const dx = a.clientX - b.clientX; const dy = a.clientY - b.clientY;
      const d = Math.hypot(dx,dy);
      const scale = Math.min(3, Math.max(1, (d / (pinchStart.current.d || d)) * zoom));
      setZoom(scale);
      setForceHiRes(scale > 1.2);
      return;
    }

    // When zoomed in allow panning with one finger
    if (e.touches.length === 1 && zoom > 1.05) {
      const t = e.touches[0];
      const dx = (t.clientX - (touchMoveX.current ?? touchStartX.current ?? t.clientX));
      const dy = (t.clientY - (touchMoveY.current ?? touchStartY.current ?? t.clientY));
      touchMoveX.current = t.clientX;
      touchMoveY.current = t.clientY;
      setPan((p)=>({ x: p.x + dx, y: p.y + dy }));
      return;
    }

    // Otherwise track horizontal touch for swipe between photos (only when zoomed out)
    touchMoveX.current = e.touches[0].clientX;
    touchMoveY.current = e.touches[0].clientY;
  };

  const onTouchEnd = () => {
    if (pinchStart.current) {
      pinchStart.current = null;
      if (zoom <= 1.05) { setZoom(1); setPan({x:0,y:0}); setForceHiRes(false); }
      return;
    }

    // If zoomed in, don't change photo by swiping — only allow pan
    if (zoom > 1.05) {
      // keep current pan; just clear touch trackers
      touchStartX.current = null;
      touchMoveX.current = null;
      touchStartY.current = null;
      touchMoveY.current = null;
      return;
    }

    const sx = touchStartX.current;
    const ex = touchMoveX.current ?? sx;
    if (sx != null && ex != null) {
      const dx = ex - sx;
      if (Math.abs(dx) > 40) {
        if (dx < 0) setCurrentIndex((i) => Math.min(filtered.length - 1, i + 1));
        if (dx > 0) setCurrentIndex((i) => Math.max(0, i - 1));
      }
    }

    // Remove vertical swipe triggers completely in fullscreen mode
    // (Do NOT trigger select/later on vertical swipe)

    touchStartX.current = null;
    touchMoveX.current = null;
    touchStartY.current = null;
    touchMoveY.current = null;
  };

  const download = (p: Photo) => {
    const href =
      p.full_url ||
      p.url ||
      buildDriveViewUrl(p.drive_file_id || p.file_id) ||
      p.thumbnail_url ||
      p.thumb_url ||
      "";
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = p.filename || p.name || `photo-${p.id}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ✅ Resume from last viewed
  const resumeFromLast = async () => {
    try {
      const rs = await firebaseDb.resume?.get?.(String(targetUserId));
      if (rs?.data && typeof rs.data.lastIndex === "number") {
        const idx = Math.min(
          rs.data.lastIndex,
          Math.max(0, filtered.length - 1)
        );

        setCurrentIndex(idx);
        setTimeout(() => {
          setIsFullscreen(true);
          document.documentElement.requestFullscreen?.();
        }, 50);
        return;
      }
    } catch (err) {
      console.warn("resume.get failed", err);
    }

    // default fallback = go to first
    setCurrentIndex(0);
    setIsFullscreen(true);
    document.documentElement.requestFullscreen?.();
  };

  const handleResetSelections = async () => {
  if (!targetUserId || !user?.email) return;

  const pw = prompt("Enter password to reset selections:");
  if (!pw) return;

  try {
    const fbUser = auth.currentUser; // ✅ true Firebase user object
    if (!fbUser) throw new Error("No Firebase session");

    const cred = EmailAuthProvider.credential(user.email, pw);
    await reauthenticateWithCredential(fbUser, cred); // ✅ correct object

    await firebaseDb.selections.resetUser(targetUserId);

    setSelections(new Map());
    alert("✅ Selections reset successfully");
  } catch (err) {
    console.error(err);
    alert("❌ Wrong password or permissions");
  }
};

  // Lock scrolling while in fullscreen for stable swipe controls
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    if (isFullscreen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    }
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [isFullscreen]);


  // Non-passive touchmove handler while fullscreen to allow preventDefault (fixes Chrome passive listener warning)
  useEffect(() => {
    const handler = (e: TouchEvent) => {
      // prevent page scroll when in fullscreen viewer for stable vertical swipes
      if (isFullscreen) e.preventDefault();
    };
    if (isFullscreen) {
      window.addEventListener("touchmove", handler, { passive: false });
    }
    return () => {
      window.removeEventListener("touchmove", handler as EventListener);
    };
  }, [isFullscreen]);

  // ---------- RENDER ----------
  if (loading || loadingPhotos) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CinematicHeader title="Gallery" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tabs: top-level */}
        <div className="flex flex-wrap gap-2">
          {topCategories.map((c) => (
            <Button
              key={c}
              variant={topCat === c ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTopCat(c);
                setSubCat("All");
              }}
            >
              {c}
            </Button>
          ))}
        </div>

        {/* Sub tabs */}
        {subCategories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {subCategories.map((c) => (
              <Button
                key={c}
                variant={subCat === c ? "default" : "outline"}
                size="sm"
                onClick={() => setSubCat(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        )}

        {/* Resume */}
        {mode === "select" && filtered.length > 0 && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={resumeFromLast} size="sm">
              Resume
            </Button>
            <Button
  onClick={() => navigate("/review")}
  className="ml-2 bg-purple-600 hover:bg-purple-700 text-white"
>
  Finalize
</Button>

            <div className="text-sm text-muted-foreground self-center">
              Limit: {selectionLimit ?? "∞"} · 
              Selected: {Array.from(selections.values()).filter((v) => v === "selected").length} · 
              Later: {Array.from(selections.values()).filter((v) => v === "later").length}
            </div>
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
            <div className="p-6 rounded-full bg-primary/10 border border-primary/20">
              <ImageIcon className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-semibold">No photos found</h2>
          </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((p, idx) => {
              const st = selections.get(p.id);
              return (
                <Card
                  key={p.id}
                  className="relative overflow-hidden group cursor-pointer"
                  onClick={() => handleThumbClick(idx)}
                >
                  <SafeImg
                    photo={p}
                    alt={p.filename || p.name || "photo"}
                    className="w-full h-40 object-cover"
                  />

                  {/* Mini action icons */}
                  <div className="absolute inset-0 flex items-start justify-end p-1 gap-1 pointer-events-none">
                    <button
                      className={`pointer-events-auto h-6 w-6 rounded-full bg-black/60 flex items-center justify-center shadow ${st==='selected'?'ring-2 ring-green-500':''}`}
                      onClick={(e) => { e.stopPropagation(); doSelectForPhoto(String(p.id), 'selected', idx); }}
                      title="Select"
                    >
                      <Check className="h-3 w-3 text-white" />
                    </button>
                    <button
                      className={`pointer-events-auto h-6 w-6 rounded-full bg-black/60 flex items-center justify-center shadow ${st==='later'?'ring-2 ring-amber-500':''}`}
                      onClick={(e) => { e.stopPropagation(); doSelectForPhoto(String(p.id), 'later', idx); }}
                      title="Later"
                    >
                      <Clock className="h-3 w-3 text-white" />
                    </button>
                  </div>

                  {st && (
                    <span
                      className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full ${
                        st === "selected"
                          ? "bg-green-600 text-white"
                          : st === "later"
                          ? "bg-amber-600 text-white"
                          : "bg-gray-500 text-white"
                      }`}
                    >
                      {st === "selected" ? "Selected" : st === "later" ? "Later" : "Skipped"}
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Fullscreen viewer */}
      {isFullscreen && current && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between p-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsFullscreen(false);
                document.exitFullscreen?.();
              }}
            >
              <Minimize2 className="mr-2 h-4 w-4" /> Exit
            </Button>
            <div className="text-white text-sm">
              {current.filename || current.name || ""}
            </div>
            <Button variant="secondary" size="sm" onClick={() => download(current)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center px-2 overflow-hidden">
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: pinchStart.current ? "none" : "transform 150ms ease",
                willChange: "transform",
                touchAction: "none",
                maxWidth: "100%",
                maxHeight: "100%",
                display: "inline-block",
              }}
            >
              <SafeImg photo={current} alt={current.filename || current.name || ""} forceHighRes={forceHiRes} className="max-h-full max-w-full object-contain" />
            </div>
          </div>

          <div className="p-3 flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              ← Prev
            </Button>
            {mode === "select" ? (
              <>
                <Button variant="outline" onClick={() => doSelect2("later")}>
                  Later
                </Button>
                <Button onClick={() => doSelect2("selected")} className="bg-gradient-primary" id="select-btn" data-action="select">
                  Select
                </Button>
              </>
            ) : (
              <Button onClick={() => download(current)} className="bg-gradient-primary">
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setCurrentIndex((i) => Math.min(filtered.length - 1, i + 1))}
              disabled={currentIndex === filtered.length - 1}
            >
              Next →
            </Button>

          </div>
        </div>
      )}

      {/* LOCK OVERLAY (Apple-like blurred) */}
      {isLocked && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-md bg-black/60" />
          <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-yellow-500/30 bg-black/70 shadow-2xl p-8 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full border-2 border-yellow-500/60 grid place-items-center shadow-glow">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9z"/></svg>
            </div>
            <h3 className="text-2xl font-bold tracking-wide text-yellow-400 mb-2">Selections Locked</h3>
            <p className="text-sm text-gray-300 mb-6">Your selections are finalized. Contact photographer to reopen.</p>
            <Button onClick={() => navigate('/home')} className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold px-6">
              Go Home
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;


// Added reset button logic
function handleReset(){ /* TODO: prompt, verify password, call resetSelections */ }
