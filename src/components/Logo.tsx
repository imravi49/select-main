import { useFirebaseDesignSettings } from "@/hooks/useFirebaseDesignSettings";

interface LogoProps {
  className?: string;
  fallbackText?: string;
}

export const Logo = ({ className = "h-8 w-auto", fallbackText = "Photo Gallery" }: LogoProps) => {
  const settings = useFirebaseDesignSettings();

  if (settings.logo_url) {
    return <img src={settings.logo_url} alt="Logo" className={className} />;
  }

  return (
    <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
      {fallbackText}
    </span>
  );
};
