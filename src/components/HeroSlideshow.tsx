import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from "@/lib/firebaseConfig";

export const HeroSlideshow = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadHeroImages();
  }, []);

  const loadHeroImages = async () => {
    try {
      const heroRef = ref(storage, 'hero-images');
      const result = await listAll(heroRef);
      
      const imageUrls = await Promise.all(
        result.items.map(async (itemRef) => {
          return await getDownloadURL(itemRef);
        })
      );

      setImages(imageUrls);
    } catch (error) {
      console.error('Error loading hero images:', error);
    }
  };

  useEffect(() => {
    if (images.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }, 5000); // Change image every 5 seconds

      return () => clearInterval(interval);
    }
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
    );
  }

  return (
    <>
      {images.map((image, index) => (
        <div
          key={image}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: index === currentIndex ? 1 : 0,
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/40" />
        </div>
      ))}
    </>
  );
};
