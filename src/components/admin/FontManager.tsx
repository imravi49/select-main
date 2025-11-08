import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { storageService } from "@/lib/firebaseStorage";
import { doc, collection, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";

export const FontManager = () => {
  const [fonts, setFonts] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [designFonts, setDesignFonts] = useState<any>({
    headerFont: "", titleFont: "", secondaryFont: "", buttonFont: "",
    titleColor: "#ffffff", secondaryColor: "#bfbfbf", buttonColor: "#f5f5f5"
  });

  useEffect(() => { loadFonts(); }, []);

  const loadFonts = async () => {
    try {
      // root collection site_fonts
      const snap = await getDocs(collection(firestore, 'site_fonts'));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFonts(items);
    } catch (e:any) {
      console.error(e);
      toast.error('Failed to load fonts (check permissions)');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name;
    const path = `fonts/${Date.now()}_${name}`;
    setUploading(true);
    try {
      const up = await storageService.uploadFile(path, file);
      if (up.error) throw up.error;
      const publicUrl = await storageService.getPublicUrl(path);
      const id = `${Date.now()}_${name.replace(/\W+/g,'_')}`;
      // write to root collection site_fonts
      await setDoc(doc(firestore, 'site_fonts', id), {
        name, storagePath: path, publicUrl, mimeType: file.type,
        createdAt: serverTimestamp()
      });
      toast.success('Font uploaded');
      loadFonts();
    } catch (e:any) {
      console.error(e);
      toast.error('Upload failed');
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    try {
      // Save selected fonts into settings.design (font_family will be a publicUrl or id)
      const payload: any = {
        fonts: designFonts,
        font_family: designFonts.titleFont || designFonts.headerFont || "",
        fontFamily: designFonts.titleFont || designFonts.headerFont || ""
      };
      await setDoc(doc(firestore, 'settings', 'design'), payload, { merge: true });
      toast.success('Font design settings saved (refresh to apply)');
    } catch (e:any) {
      console.error(e);
      toast.error('Save failed');
    }
  };

  const updateField = (key:string, val:string) => {
    setDesignFonts((p:any) => ({ ...p, [key]: val }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Font Management</CardTitle>
        <CardDescription>Upload and assign fonts globally</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input type="file" accept=".ttf,.otf,.woff" onChange={handleUpload} disabled={uploading} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['headerFont','titleFont','secondaryFont','buttonFont'].map((key) => (
            <div key={key}>
              <Label className="capitalize">{key.replace('Font',' Font')}</Label>
              <select
                className="border rounded w-full p-2 bg-black text-white"
                value={designFonts[key]}
                onChange={(e)=>updateField(key, e.target.value)}
              >
                <option value="">Select Font</option>
                {fonts.map((f:any)=>(<option key={f.id} value={f.publicUrl || f.storagePath || f.id}>{f.name}</option>))}
              </select>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {['titleColor','secondaryColor','buttonColor'].map((key) => (
            <div key={key}>
              <Label className="capitalize">{key.replace('Color',' Color')}</Label>
              <input type="color" value={designFonts[key]} onChange={(e)=>updateField(key,e.target.value)} className="w-full h-10" />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} className="mt-4 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black">Save Font Settings</Button>

        <div className="mt-6 space-y-2">
          <h4 className="text-sm text-muted-foreground">Preview</h4>
          <div style={{fontFamily:`${designFonts.titleFont}`,color:designFonts.titleColor,fontSize:'1.5rem'}}>Title Font Example</div>
          <div style={{fontFamily:`${designFonts.secondaryFont}`,color:designFonts.secondaryColor}}>Secondary Text Example</div>
          <button style={{fontFamily:`${designFonts.buttonFont}`,color:designFonts.buttonColor,background:'#222',padding:'6px 12px',borderRadius:'4px'}}>Button Example</button>
        </div>
      </CardContent>
    </Card>
  );
};
export default FontManager;
