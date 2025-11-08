import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";
import { HeroImageManager } from "./HeroImageManager";
import { FontManager } from "./FontManager";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";
import { storageService } from "@/lib/firebaseStorage";

export const AdminDesign = () => {
  const [settings, setSettings] = useState({
    logo_url: "",
    primary_color: "#8B5CF6",
    secondary_color: "#0EA5E9",
    font_family: "Inter",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const snap = await getDoc(doc(firestore, "settings", "design"));
      if (snap.exists()) {
        const data: any = snap.data();
        setSettings({
          logo_url: data.logo_url || "",
          primary_color: data.primary_color || "#8B5CF6",
          secondary_color: data.secondary_color || "#0EA5E9",
          font_family: data.font_family || "Inter",
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load design settings");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await storageService.uploadFile(`logos/${filePath}`, file);
      if (uploadError) throw uploadError;

      const publicUrl = await storageService.getPublicUrl(`logos/${filePath}`);
      setSettings((s) => ({ ...s, logo_url: publicUrl }));
      // write both snake_case and camelCase to settings/design
      await setDoc(
        doc(firestore, "settings", "design"),
        { logo_url: publicUrl, logoUrl: publicUrl },
        { merge: true }
      );

      toast.success("Logo uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // ensure we write both snake_case and camelCase for color fields so designLoader accepts either
      const payload: any = {
        logo_url: settings.logo_url,
        logoUrl: settings.logo_url,
        primary_color: settings.primary_color,
        primaryColor: settings.primary_color,
        secondary_color: settings.secondary_color,
        secondaryColor: settings.secondary_color,
        font_family: settings.font_family,
        fontFamily: settings.font_family,
      };
      await setDoc(doc(firestore, "settings", "design"), payload, { merge: true });
      toast.success("Design settings saved");
      window.dispatchEvent(new Event("design-updated"));
    } catch (e) {
      console.error(e);
      toast.error("Failed to save design settings");
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    const defaultSettings = {
      logo_url: "",
      primary_color: "#8B5CF6",
      secondary_color: "#0EA5E9",
      font_family: "Inter",
    };
    setSettings(defaultSettings);
    setLoading(true);
    try {
      const payload: any = {
        logo_url: defaultSettings.logo_url,
        logoUrl: defaultSettings.logo_url,
        primary_color: defaultSettings.primary_color,
        primaryColor: defaultSettings.primary_color,
        secondary_color: defaultSettings.secondary_color,
        secondaryColor: defaultSettings.secondary_color,
        font_family: defaultSettings.font_family,
        fontFamily: defaultSettings.font_family,
      };
      await setDoc(doc(firestore, "settings", "design"), payload, { merge: true });
      toast.success("Design settings reset to default");
      window.dispatchEvent(new Event("design-updated"));
    } catch (e) {
      console.error(e);
      toast.error("Failed to reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Design</h2>
        <p className="text-muted-foreground">Customize the look and feel of your gallery</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brand Settings</CardTitle>
          <CardDescription>Upload your logo and set your brand colors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="space-y-4">
              {settings.logo_url && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <img src={settings.logo_url} alt="Logo" className="h-16 w-auto" />
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  id="brand-logo-input"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  disabled={uploading}
                  onClick={() =>
                    document.querySelector<HTMLInputElement>("#brand-logo-input")?.click()
                  }
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              <Input
                placeholder="Or paste logo URL"
                value={settings.logo_url}
                onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary_color"
                  type="color"
                  value={settings.secondary_color}
                  onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={settings.secondary_color}
                  onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={loading} className="bg-gradient-primary">
              <Save className="mr-2 h-4 w-4" />
              Save Brand Settings
            </Button>
            <Button onClick={handleResetToDefault} disabled={loading} variant="outline">
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>

      <HeroImageManager />
      <FontManager />
    </div>
  );
};

export default AdminDesign;
