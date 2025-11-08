import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Eye, Star, ExternalLink } from "lucide-react";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { MobileNav } from "@/components/MobileNav";
import { Logo } from "@/components/Logo";
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from "@/lib/firebaseConfig";
import { toast } from "sonner";

const Home = () => {
  const { user, profile, loading } = useFirebaseAuth();
  const navigate = useNavigate();

  const userId = profile?.id || user?.uid;

  const [heroTitle, setHeroTitle] = useState("Welcome to Your Gallery");
  const [heroSubtitle, setHeroSubtitle] = useState("Select and download your favorite moments");
  const [logoUrl, setLogoUrl] = useState("");
  const [locked, setLocked] = useState(false);

  // redirect login logic
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    } 
  }, [user, loading, navigate]);

  // Admin redirect rule
  useEffect(() => {
    if (!loading && user && profile?.role === "admin") {
      navigate("/admin");
    }
  }, [user, profile, loading, navigate]);

  // Load lock state
  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, "profiles", userId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d:any = snap.data();
        setLocked(!!d.selection_locked || !!d.selection_finalized);
      }
    });
    return () => unsub();
  }, [userId]);

  // Realtime content (hero title, subtitle, branding)
  useEffect(() => {
    const appRef = doc(db, 'settings', 'app');
    const unsubApp = onSnapshot(appRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHeroTitle(data.hero_title || "Welcome to Your Gallery");
        setHeroSubtitle(data.hero_subtitle || "Select and download your favorite moments");
      }
    });

    const designRef = doc(db, 'settings', 'design');
    const unsubDesign = onSnapshot(designRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLogoUrl(data.logo_url || "");
      }
    });

    return () => {
      unsubApp();
      unsubDesign();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileNav />

      {/* HERO SECTION */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <HeroSlideshow />

        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <Logo className="h-20 w-auto mx-auto" />
          </div>

          <h1 
            className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in"
            style={{ 
              fontFamily: 'Playfair Display, serif',
              color: '#d4af37',
              textShadow: '0 0 8px rgba(212, 175, 55, 0.5)'
            }}
          >
            {heroTitle}
          </h1>

          <p className="text-xl md:text-2xl text-foreground/90 mb-8 animate-fade-in">
            {heroSubtitle}
          </p>
        </div>
      </section>

      {/* MAIN BUTTON GRID */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* VIEW ONLY MODE */}
          <Card 
            className="p-8 hover:border-primary/50 hover:shadow-glow transition-all cursor-pointer group"
            onClick={() => navigate("/gallery?mode=view")}
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-6 rounded-full bg-primary/10 border-2 border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all">
                <Eye className="h-10 w-10 text-primary" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold mb-3">View Photos</h3>
                <p className="text-muted-foreground">
                  Browse and download your photos in view-only mode
                </p>
              </div>

              <Button variant="outline" className="w-full">View Gallery</Button>
            </div>
          </Card>

          {/* START SELECTIONS */}
          <Card 
            className={`p-8 hover:border-primary/50 hover:shadow-glow transition-all cursor-pointer group ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => { if (locked) { toast.message("Selections locked — contact photographer to reopen"); return; } navigate("/gallery?mode=select"); }}
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-6 rounded-full bg-primary/10 border-2 border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all">
                <Star className="h-10 w-10 text-primary" />
              </div>

              <div>
                <h3 className="text-2xl font-bold mb-3">Start Selections</h3>
                <p className="text-muted-foreground">
                  Select your favorite photos with full-screen viewer
                </p>
              </div>

              <Button 
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity" 
                disabled={locked}
              onClick={() => { if (locked) { toast.message("Selections locked — contact photographer to reopen"); } }}
              >
                {locked ? "Finalized" : "Begin Selection"}
              </Button>
            </div>
          </Card>

          {/* MAIN SITE */}
          <Card 
            className="p-8 hover:border-primary/50 hover:shadow-glow transition-all cursor-pointer group"
            onClick={() => window.open("https://ravisharmaphotofilms.in", "_blank")}
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-6 rounded-full bg-primary/10 border-2 border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all">
                <ExternalLink className="h-10 w-10 text-primary" />
              </div>

              <div>
                <h3 className="text-2xl font-bold mb-3">Main Site</h3>
                <p className="text-muted-foreground">
                  Visit Ravi Sharma Photo & Films
                </p>
              </div>

              <Button variant="outline" className="w-full">Visit Site</Button>
            </div>
          </Card>

        </div>

        {locked && (
          <p className="text-center mt-6 text-sm text-muted-foreground">
            ✅ Your selection was finalized — contact photographer to reopen
          </p>
        )}
      </main>
    </div>
  );
};

export default Home;

