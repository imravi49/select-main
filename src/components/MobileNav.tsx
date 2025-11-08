import { useState } from "react";
import { Menu, X, Home, Image, Shield, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useFirebaseDesignSettings } from "@/hooks/useFirebaseDesignSettings";

export const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useFirebaseAuth();
  const settings = useFirebaseDesignSettings();

  const navItems = [
    { label: 'Home', path: '/home', icon: Home, show: true },
    { label: 'Gallery', path: '/gallery', icon: Image, show: true },
    { label: 'Admin', path: '/admin', icon: Shield, show: profile?.role === 'admin' },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          {settings.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="h-8 w-auto" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="ml-auto"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm pt-16">
          <nav className="flex flex-col p-6 space-y-4">
            {navItems.map((item) => 
              item.show && (
                <Button
                  key={item.path}
                  variant={location.pathname === item.path ? "default" : "ghost"}
                  className="w-full justify-start text-lg"
                  onClick={() => handleNavClick(item.path)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Button>
              )
            )}
            <div className="pt-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full justify-start text-lg text-destructive hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
};
