import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";

export const AdminSettings = () => {
  const [settings, setSettings] = useState({
    hero_title: "",
    hero_subtitle: "",
    contact_email: "",
    contact_phone: "",
    feedback_prompt: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const snap = await getDoc(doc(firestore, "settings", "app"));
      if (snap.exists()) {
        const data: any = snap.data();
        setSettings({
          hero_title: data.hero_title || "",
          hero_subtitle: data.hero_subtitle || "",
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          feedback_prompt: data.feedback_prompt || "",
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load settings");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(firestore, "settings", "app"), settings, { merge: true });
      toast.success("Settings saved successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Configure your application settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>Customize the main landing page content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hero_title">Hero Title</Label>
            <Input
              id="hero_title"
              value={settings.hero_title}
              onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
              placeholder="Your Photo Gallery"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero_subtitle">Hero Subtitle</Label>
            <Textarea
              id="hero_subtitle"
              value={settings.hero_subtitle}
              onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
              placeholder="Select your favorite moments"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Set your contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={settings.contact_email || ""}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                placeholder="contact@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={settings.contact_phone || ""}
                onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback Settings</CardTitle>
          <CardDescription>Customize the feedback prompt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback_prompt">Feedback Prompt</Label>
            <Textarea
              id="feedback_prompt"
              value={settings.feedback_prompt}
              onChange={(e) => setSettings({ ...settings, feedback_prompt: e.target.value })}
              placeholder="We value your feedback"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="bg-gradient-primary">
        <Save className="mr-2 h-4 w-4" />
        Save All Settings
      </Button>
    </div>
  );
};
