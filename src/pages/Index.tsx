import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Sparkles, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { showCinematicReveal } from "@/lib/cinematic";
import "@/styles/cinematic.css";
import { useFirebaseDesignSettings } from "@/hooks/useFirebaseDesignSettings";

const Index = () => {
  const { user, loading } = useFirebaseAuth();
  const designSettings = useFirebaseDesignSettings();

  // On-mount: reveal hero logo (fade-in)
  useEffect(() => {
    const el = document.querySelector('.hero-logo-onload');
    if (el) setTimeout(() => el.classList.add('visible'), 50);
  }, []);

  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/home");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleGetStartedClick = () => {
    navigate("/auth");
  };

  const ADMIN_EMAILS = [
    "ravi.rv73838@gmail.com",
    "ravi.rv73838@icloud.com",
  ];

  const handleAdminLoginClick = async () => {
    try {
      setLoading?.(true);
    } catch (e) {/* ignore if setLoading not present */}
    try {
      const provider = new (await import('firebase/auth')).GoogleAuthProvider();
      const auth = (await import('@/lib/firebaseConfig')).auth;
      const signInWithPopup = (await import('firebase/auth')).signInWithPopup;
      const res = await signInWithPopup(auth, provider);

      if (!res.user.email || !ADMIN_EMAILS.includes(res.user.email.toLowerCase())) {
        try { const toast = (await import('sonner')).toast; toast.error('Not authorized as admin'); } catch(e){}
        await auth.signOut();
        return;
      }

      try { const toast = (await import('sonner')).toast; toast.success('Admin login successful!'); } catch(e){}
      const logoUrl = designSettings?.logo_url;
      await showCinematicReveal(logoUrl);
      navigate('/admin', { replace: true });
    } catch (err) {
      try { const toast = (await import('sonner')).toast; toast.error('Google login failed'); } catch(e){}
    } finally {
      try {
        setLoading?.(false);
      } catch(e){}
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.2),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-4">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Easy Gallery By</span>
            </div>

            {/* Logo inserted here */}
            <div className="flex justify-center">
              <Logo className="mx-auto hero-logo-onload h-32 md:h-48 w-auto" fallbackText="Ravi Sharma Photo & Films" />
            </div>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A luxury wedding storytelling experience.<br />
              Relive every emotion, every frame crafted by, <br /> <span className="text-primary font-semibold">Ravi Sharma Photo & Films.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                onClick={handleGetStartedClick}
                size="lg"
                className="bg-gradient-primary hover:opacity-90 transition-opacity text-lg px-8"
              >
                <Camera className="mr-2 h-5 w-5" />
                Get Started (Client)
              </Button>
              
              <Button
                onClick={handleAdminLoginClick}
                variant="outline"
                size="lg"
                className="text-lg px-8 border-primary/20 hover:bg-primary/10"
              >
                <Lock className="mr-2 h-5 w-5" />
                Admin Login
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Camera className="h-8 w-8" />}
            title="Smooth Flow"
            description="Your gallery, delivered instantly by us, seamless, secure, and cinematic."
          />
          <FeatureCard
            icon={<Sparkles className="h-8 w-8" />}
            title="Smart Selection"
            description="Relive your moments in our cinematic viewer pick your favorites effortlessly."
          />
          <FeatureCard
            icon={<Lock className="h-8 w-8" />}
            title="Secure & Private"
            description="Your memories stay yours protected with advanced access and privacy control."
          />
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover-scale group">
    <div className="mb-4 text-primary group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

export default Index;
