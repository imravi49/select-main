// src/pages/Auth.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useFirebaseDesignSettings } from "@/hooks/useFirebaseDesignSettings";
import { showCinematicReveal } from "@/lib/cinematic";
import "@/styles/cinematic.css";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";

const Auth = () => {
  const { user } = useFirebaseAuth();
  const designSettings = useFirebaseDesignSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Wait until design settings load to set logo URL
  useEffect(() => {
    if (designSettings?.logo_url) {
      setLogoUrl(designSettings.logo_url);
    }
  }, [designSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const authInstance = getAuth();
      const res = await signInWithEmailAndPassword(authInstance, email, password);
      toast.success("Login successful!");

      // Ensure logo is available before showing reveal
      const revealLogo = logoUrl || designSettings?.logo_url || "";
      if (revealLogo) {
        await showCinematicReveal(revealLogo);
      } else {
        await showCinematicReveal(undefined, "Ravi Sharma Photo & Films");
      }

      navigate("/home", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg flex flex-col items-center justify-center min-h-screen bg-black text-white text-center p-4 animate-fadeIn">
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Ravi Sharma Photo & Films"
          className="w-44 sm:w-36 mb-8"
          style={{ maxWidth: "180px", height: "auto" }}
        />
      )}
      {!logoUrl && (
        <h1 className="text-3xl font-bold mb-8 text-primary font-playfair">
          Ravi Sharma Photo & Films
        </h1>
      )}

      <div className="auth-card flex flex-col items-center justify-center">
        <h1 className="text-3xl font-semibold mb-6 font-playfair">Welcome Back</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
          <input
            type="email"
            placeholder="Email"
            className="p-3 rounded bg-zinc-900 text-white border border-zinc-700 focus:outline-none focus:border-zinc-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="p-3 rounded bg-zinc-900 text-white border border-zinc-700 focus:outline-none focus:border-zinc-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Please wait..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
