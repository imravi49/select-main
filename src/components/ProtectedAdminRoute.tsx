import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";

const SUPER_ADMIN_EMAILS = [
  "ravi.rv73838@gmail.com",
  "ravi.rv738382@icloud.com"
];

export default function ProtectedAdminRoute({ children }: { children: JSX.Element }) {
  const { user, profile, loading } = useFirebaseAuth();

  // ✅ Check super-admin immediately (skip waiting for profile)
  if (user && (SUPER_ADMIN_EMAILS.includes(user.email || "") || (profile && profile.role === "admin"))) {
    return children;
  }

  // ✅ still loading Firebase or profile
  if (loading || (user && profile === undefined)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ✅ Not logged in → go to login page
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // ✅ If Firestore profile exists, must check admin role
  if (profile && profile.role === "admin") {
    return children;
  }

  // ❌ Not admin → block
  return <Navigate to="/gallery" replace />;
}
