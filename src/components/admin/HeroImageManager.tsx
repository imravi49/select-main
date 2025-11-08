import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storageService as storage } from "@/lib/firebaseStorage";
import { toast } from "sonner";
import { Upload, Trash2, Loader2 } from "lucide-react";

export const HeroImageManager = () => {
  const [images, setImages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setLoading(true);
    try {
      const { data, error } = await storage.listFiles("hero-images");
      if (error) throw error;

      const imageList = await Promise.all(
        data
          .filter((file: any) => file.name !== ".emptyFolderPlaceholder")
          .map(async (file: any) => ({
            name: file.name,
            url: await storage.getPublicUrl(`hero-images/${file.name}`), // ✅ FIXED comma here
            created_at: null,
          }))
      );
      setImages(imageList);
    } catch (error) {
      console.error("Error loading images:", error);
      toast.error("Failed to load hero images");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const filePath = `hero-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${ext}`;

        const { error: uploadError } = await storage.uploadFile(`hero-images/${filePath}`, file);
        if (uploadError) throw uploadError;
      }

      toast.success(`Uploaded ${files.length} image(s) successfully`);
      await loadImages();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload images");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      const { error } = await storage.deleteFile(`hero-images/${filename}`);
      if (error) throw error;

      toast.success("Image deleted successfully");
      await loadImages();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete image");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hero Slideshow Images</CardTitle>
        <CardDescription>Upload and manage images for the home page slideshow</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            id="hero-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="flex-1"
          />
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() =>
              document.querySelector<HTMLInputElement>("#hero-upload")?.click()
            }
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hero images uploaded yet. Upload some to create a slideshow.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image) => (
              <div key={image.name} className="relative group">
                <img
                  src={image.url}
                  alt="Hero"
                  className="w-full h-32 object-cover rounded-lg border border-border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(image.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
