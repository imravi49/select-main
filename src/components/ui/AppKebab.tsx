import { useNavigate, useLocation } from "react-router-dom";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Home, RefreshCcw, LogOut, MoonStar, Sun } from "lucide-react";
import { setThemeMode } from "@/lib/designLoader";

export default function AppKebab() {
  const navigate = useNavigate();
  const { signOut } = useFirebaseAuth();
  const { pathname } = useLocation();
  const onHome = () => navigate("/home");
  const onReset = () => navigate("/gallery?mode=select&reset=1");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onHome}>
          <Home className="mr-2 h-4 w-4" /> Home
        </DropdownMenuItem>
        {pathname.startsWith("/gallery") && (
          <DropdownMenuItem onClick={onReset}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Reset selection
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setThemeMode("cinematic")}>
          <MoonStar className="mr-2 h-4 w-4" /> Cinematic theme
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeMode("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light theme
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
