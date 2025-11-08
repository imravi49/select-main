import { Logo } from "@/components/Logo";
import AppKebab from "@/components/ui/AppKebab";

export default function CinematicHeader({ title }: { title?: string }) {
  return (
    <header className="cine-header sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div onClick={() => (location.href = "/home")} className="cursor-pointer">
            <Logo className="h-9 w-auto" />
          </div>
          {title && <div className="text-sm text-muted-foreground">{title}</div>}
        </div>
        <AppKebab />
      </div>
    </header>
  );
}
