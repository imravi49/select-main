import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { addDoc, updateDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";

import { signInWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth, db as firestore } from "@/lib/firebaseConfig";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, LogOut, Image as ImageIcon, ArrowLeft, Eye, Minimize2, Check, Clock, X } from "lucide-react";
import { Star } from "lucide-react";
import { firebaseDb } from "@/lib/firebaseDb";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { collection, onSnapshot, query, where } from "firebase/firestore";

/* -------------------------------------------------------
   Types
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
}

type Status = "selected" | "later" | "skip";

/* -------------------------------------------------------
   Image helpers
------------------------------------------------------- */
function driveView(id?: string) {
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : "";
}
function candidates(p: Photo) {
  const id = p.drive_file_id || p.file_id;
  const t = p.thumbnail_url || p.thumb_url;
  const f = p.full_url || p.url;
  const d = driveView(id);
  return Array.from(new Set([t, f, d].filter(Boolean))) as string[];
}
const SafeImg: React.FC<{ photo: Photo; className?: string; alt?: string; forceHighRes?: boolean }> = ({ photo, className, alt, forceHighRes }) => {
  const tried = useRef<Set<string>>(new Set());
  const [src, setSrc] = useState<string>(() => candidates(photo)[0] || "");
  const [busted, setBusted] = useState(false);

  useEffect(() => {
    tried.current.clear();
    setBusted(false);
    const list = forceHighRes ? [ ...new Set([photo.full_url || photo.url, ...candidates(photo)]) ] : candidates(photo);
    setSrc(list[0] || "");
  }, [photo?.id, forceHighRes]);

  const onError = () => {
    const list = candidates(photo);
    tried.current.add(src);
    const next = list.find((u) => !tried.current.has(u));
    if (next) return setSrc(next);
    if (!busted && src) {
      setBusted(true);
      return setSrc(src.includes("?") ? `${src}&cb=${Date.now()}` : `${src}?cb=${Date.now()}`);
    }
    setSrc("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
  };

  return <img src={src} onError={onError} alt={alt || photo.filename || photo.name || "photo"} className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
};

/* -------------------------------------------------------
   Review (Gallery clone with Selected/Later only)
------------------------------------------------------- */
const Review = () => {
  const { user, profile, loading, signOut } = useFirebaseAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewUserId = searchParams.get("userId");
  const targetUserId = viewUserId || profile?.id || user?.uid;

  const [selectionLimit, setSelectionLimit] = useState<number | null>(null);
  const [selections, setSelections] = useState<Map<string, Status>>(new Map());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // UI
  const [tab, setTab] = useState<"Selected" | "Later">("Selected");
  const [isFullscreen, setIsFullscreen] = useState(false);

// --- Finalize (rating + feedback) ---
const [finalizeOpen, setFinalizeOpen] = useState(false);
const [finalized, setFinalized] = useState(false);
const [rating, setRating] = useState(0);
const [hoverRating, setHoverRating] = useState(0);
const [feedback, setFeedback] = useState("");
const [locked, setLocked] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Touch & Zoom
  const touchStartX = useRef<number | null>(null);
  const touchMoveX = useRef<number | null>(null);
  const pinchStart = useRef<{d:number,cx:number,cy:number} | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0,y:0});
  const [forceHiRes, setForceHiRes] = useState(false);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    if (!loading && !targetUserId) navigate("/auth");
  }, [loading, targetUserId, navigate]);

  // Load basics + photos
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      if (!targetUserId) return;
      setLoadingPhotos(true);

      // profile (also derive lock)
      try {
        const prof = await firebaseDb.profiles.get(targetUserId);
        if (prof?.data) {
          setSelectionLimit(prof.data.selection_limit ?? null);
          setLocked(!!prof.data.selection_finalized || !!prof.data.selection_locked);
        }
      } catch {}

      // all photos once
      const plist = await firebaseDb.photos.list(targetUserId);
      const allPhotos = (plist?.data as Photo[]) || []

      // live selections
      const q = query(collection(firestore, "selections"), where("userId", "==", String(targetUserId)));
      unsub = onSnapshot(q, (snap) => {
        const map = new Map<string, Status>();
        const selectedIds = new Set<string>();
        const laterIds = new Set<string>();

        snap.forEach((d) => {
          const x: any = d.data();
          const pid = String(x.photoId || x.photo_id || x.id || x.file_id || "");
          const st = String(x.status || "");
          if (!pid) return;
          if (st === "selected") { map.set(pid, "selected"); selectedIds.add(pid); }
          else if (st === "later") { map.set(pid, "later"); laterIds.add(pid); }
        });

        setSelections(map);
        const visible = allPhotos.filter((p) => {
          const id = String(p.id || p.file_id);
          return selectedIds.has(id) || laterIds.has(id);
        });
        setPhotos(visible);
        setLoadingPhotos(false);
      });
    })();

    return () => { if (unsub) unsub(); };
  }, [targetUserId]);

  // Filter for current tab
  const filtered = useMemo(() => {
    const want: Status = tab === "Selected" ? "selected" : "later";
    return photos.filter((p) => selections.get(String(p.id || p.file_id)) === want);
  }, [photos, selections, tab]);

  const current = filtered[currentIndex];
  const countSelected = useMemo(() => Array.from(selections.values()).filter((v) => v === "selected").length, [selections]);
  const countLater = useMemo(() => Array.from(selections.values()).filter((v) => v === "later").length, [selections]);

  // Keyboard (simple)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === "ArrowUp" && isFullscreen) { e.preventDefault(); const btn=document.getElementById("select-btn"); if(btn instanceof HTMLButtonElement) btn.click(); else doSelect("selected"); }
      if (e.key === "ArrowDown" && isFullscreen) { e.preventDefault(); const btn=document.getElementById("later-btn"); if(btn instanceof HTMLButtonElement) btn.click(); else doSelect("later"); }
      if (e.key === "Escape" && isFullscreen) { e.preventDefault(); setIsFullscreen(false); if (document.fullscreenElement) document.exitFullscreen?.(); }
      if (e.key === "ArrowLeft" && isFullscreen) setCurrentIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight" && isFullscreen) setCurrentIndex((i) => Math.min(filtered.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, filtered.length]);

  // Actions
  const doSelect = async (status: Status) => {
    if (locked) { toast.message("Selections locked — contact photographer to reopen"); return; }
    const p = current;
    if (!p || !targetUserId) return;

    if (status === "selected" && selectionLimit != null) {
      const count = countSelected;
      const already = selections.get(String(p.id)) === "selected";
      if (count >= selectionLimit && !already) {
        toast.info(`You can select up to ${selectionLimit} photos`);
        return;
      }
    }

  const pid = String(p.id || p.file_id);
    const m = new Map(selections);
    m.set(pid, status);
    setSelections(m);

    await (firebaseDb as any).selections2?.setStatus?.(String(targetUserId), pid, status, currentIndex);
    if (status === "selected") toast.success("Added to Selected"); else if (status === "later") toast.message("Added to Later");
  };

  const doSelectForPhoto = async (pid: string, status: "selected" | "later", idx: number) => {
    if (locked) { toast.message("Selections locked — contact photographer to reopen"); return; }
    setCurrentIndex(idx);
    await doSelect(status);
  };

  const removeStatus = async () => {
    if (locked) { toast.message("Selections locked — contact photographer to reopen"); return; }
    const p = current;
    if (!p || !targetUserId) return;
    const pid = String(p.id || p.file_id);

    const m = new Map(selections);
    m.delete(pid);
    setSelections(m);

    await (firebaseDb as any).selections2?.setStatus?.(String(targetUserId), pid, "skip", currentIndex);
    toast.message("Photo unmarked");
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    // Disable double-tap zoom: only allow pinch-to-zoom.
    if (isFullscreen) {
      e.preventDefault();
    }
    // Record timestamp for compatibility (not used to toggle zoom).
    if (e.touches.length === 1) {
      const t = e.touches[0];
      lastTap.current = Date.now();
      touchStartX.current = t.clientX;
      touchMoveX.current = null;
      return;
    }

    if (e.touches.length === 2) {
      const [a,b] = [e.touches[0], e.touches[1]];
      const dx = a.clientX - b.clientX; const dy = a.clientY - b.clientY;
      pinchStart.current = { d: Math.hypot(dx,dy), cx: (a.clientX+b.clientX)/2, cy: (a.clientY+b.clientY)/2 };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (isFullscreen) {
      // passive prevention handled by effect
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

    if (e.touches.length === 1 && zoom > 1.05) {
      const t = e.touches[0];
      const dx = (t.clientX - (touchMoveX.current ?? touchStartX.current ?? t.clientX));
      touchMoveX.current = t.clientX;
      setPan((p)=>({ x: p.x + dx, y: p.y }));
      return;
    }

    // when zoomed out allow horizontal swipe between photos
    touchMoveX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    if (pinchStart.current) {
      pinchStart.current = null;
      if (zoom <= 1.05) { setZoom(1); setPan({x:0,y:0}); setForceHiRes(false); }
      return;
    }

    if (zoom > 1.05) {
      // stay on current photo when zoomed
      touchStartX.current = null;
      touchMoveX.current = null;
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

    touchStartX.current = null;
    touchMoveX.current = null;
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

  // Render
  if (loading || loadingPhotos) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo className="h-10 w-auto" />
            <div className="text-sm text-muted-foreground">
              {filtered.length > 0 ? `${currentIndex + 1} of ${filtered.length}` : "Review Selection"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/home")} size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Home
            </Button>
            <Button variant="outline" onClick={signOut} size="sm">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tabs: Selected / Later with icons */}
        <div className="flex gap-2">
          <Button variant={tab === "Selected" ? "default" : "outline"} size="sm" onClick={() => { setTab("Selected"); setCurrentIndex(0); }}>
            ✅ Selected {countSelected}
          </Button>
          <Button variant={tab === "Later" ? "default" : "outline"} size="sm" onClick={() => { setTab("Later"); setCurrentIndex(0); }}>
            🕓 Later {countLater}
          </Button>
        </div>

{/* Finalize action visible (not in 3-dots) */}
<div className="flex justify-end">
  <Button size="sm" className="mt-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-black"
    onClick={() => setFinalizeOpen(true)}>
    Finalize ✅
  </Button>
</div>


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
              const st = selections.get(String(p.id || p.file_id));
              return (
                <Card key={String(p.id || p.file_id)} className="relative overflow-hidden group cursor-pointer" onClick={() => { if (locked) { toast.message("Selections locked — contact photographer to reopen"); return; } setCurrentIndex(idx); setIsFullscreen(true); }}>
                  <SafeImg photo={p} alt={p.filename || p.name || "photo"} className="w-full h-40 object-cover" />
                  {/* Mini action icons */}
                  <div className="absolute inset-0 flex items-start justify-end p-1 gap-1 pointer-events-none">
                    <button className={`pointer-events-auto h-6 w-6 rounded-full bg-black/60 flex items-center justify-center shadow ${st==='selected'?'ring-2 ring-green-500':''}`} onClick={(e)=>{e.stopPropagation(); doSelectForPhoto(String(p.id||p.file_id),'selected',idx);}} title="Select">
                      <Check className="h-3 w-3 text-white" />
                    </button>
                    <button className={`pointer-events-auto h-6 w-6 rounded-full bg-black/60 flex items-center justify-center shadow ${st==='later'?'ring-2 ring-amber-500':''}`} onClick={(e)=>{e.stopPropagation(); doSelectForPhoto(String(p.id||p.file_id),'later',idx);}} title="Later">
                      <Clock className="h-3 w-3 text-white" />
                    </button>
                  </div>
                  {st && (
                    <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full ${
                      st === "selected" ? "bg-green-600 text-white" :
                      st === "later" ? "bg-amber-600 text-white" : "bg-gray-500 text-white"
                    }`}>
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
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="flex items-center justify-between p-3">
            <Button variant="secondary" size="sm" onClick={() => { setIsFullscreen(false); if (document.fullscreenElement) document.exitFullscreen?.(); }}>
              <Minimize2 className="mr-2 h-4 w-4" /> Exit
            </Button>
            <div className="text-white text-sm">{current.filename || current.name || ""}</div>
            <Button variant="secondary" size="sm" onClick={removeStatus}>
              <X className="mr-2 h-4 w-4" /> Remove
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
            <Button variant="outline" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>← Prev</Button>
            <Button variant="outline" onClick={() => doSelect("later") } id="later-btn" data-action="later">Later</Button>
            <Button onClick={() => doSelect("selected")} className="bg-gradient-primary" id="select-btn" data-action="select">Select</Button>
            <Button variant="outline" onClick={() => setCurrentIndex((i) => Math.min(filtered.length - 1, i + 1))} disabled={currentIndex === filtered.length - 1}>Next →</Button>
          </div>
        </div>
      )}

{/* Thank-you overlay after finalize */}
{finalized && (
  <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 animate-fade-in">
    <div className="animate-float mb-4">
      <Logo className="h-16 opacity-90" />
    </div>
    <h2 className="text-3xl font-bold mb-2 text-white tracking-wide drop-shadow-lg">
      Thank you!
    </h2>
    <p className="text-gray-300 mb-8 max-w-sm leading-relaxed">
      Your selections are locked. We’ll start working on your final edits.
    </p>
    <Button
      onClick={() => navigate("/home")}
      className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-amber-500/50 transition-all hover:scale-[1.05]"
    >
      Go Home
    </Button>
  </div>
)}


{/* Finalize Dialog */}
<Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
  <DialogContent className="space-y-4">
    <DialogHeader>
      <DialogTitle>Finalize Selection</DialogTitle>
    <DialogDescription>Rate your experience and add any notes.</DialogDescription>
    </DialogHeader>

    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHoverRating(i + 1)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => setRating(i + 1)}
          className="p-1"
          aria-label={`rate-${i+1}`}
        >
          <Star className={(hoverRating || rating) > i ? "fill-yellow-500 text-yellow-500" : ""} />
        </button>
      ))}
    </div>

    <div className="space-y-2">
      <Label htmlFor="fb">Feedback</Label>
      <Textarea id="fb" value={feedback} onChange={(e)=>setFeedback(e.target.value)} placeholder="Share your thoughts..." />
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={()=>setFinalizeOpen(false)}>Cancel</Button>
      <Button
        onClick={async ()=>{
          try {
            const uid = String(targetUserId);
            if (!uid) return;
            await addDoc(collection(firestore, "feedback"), {
              user_id: uid,
              rating,
              message: feedback,
              created_at: serverTimestamp(),
            });
            try {
              await updateDoc(doc(firestore, "selections", uid), { finalized: true });
            } catch (e) {
              await setDoc(doc(firestore, "selections", uid), { finalized: true }, { merge: true });
            }
            setFinalizeOpen(false);
            setFinalized(true);
// ✅ Also lock the profile so the app blocks immediately on next load
try {
  await updateDoc(doc(firestore, "profiles", uid), {
    selection_finalized: true,
    selection_locked: true,
    finalized_at: serverTimestamp(),
  });
} catch (e2) {
  await setDoc(doc(firestore, "profiles", uid), {
    selection_finalized: true,
    selection_locked: true,
    finalized_at: serverTimestamp(),
  }, { merge: true });
}

toast.success("Selections finalized");

// ✅ Auto-redirect home after thank-you is shown
setTimeout(() => navigate("/home", { replace: true }), 1800);

          } catch (e) {
            console.error(e);
            toast.error("Finalize failed");
          }
        }}
      >
        Submit & Finalize
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* LOCK OVERLAY */}
      {locked && (
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
export default Review;
