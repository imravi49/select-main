import { useEffect, useState } from "react";
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from "@/lib/firebaseConfig";

export const useFirebaseDesignSettings = () => {
  const [settings, setSettings] = useState({
    logo_url: "",
    primary_color: "#8B5CF6",
    secondary_color: "#0EA5E9",
    font_family: "Inter",
  });

  useEffect(() => {
    // Listen for realtime updates on the design document
    const designRef = doc(db, 'settings', 'design');
    
    const unsubscribe = onSnapshot(designRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          logo_url: data.logo_url || "",
          primary_color: data.primary_color || "#8B5CF6",
          secondary_color: data.secondary_color || "#0EA5E9",
          font_family: data.font_family || "Inter",
        });
      }
    });

    // Also listen for custom design-updated event
    const handleDesignUpdate = () => {
      // The snapshot listener will handle the update automatically
    };

    window.addEventListener('design-updated', handleDesignUpdate);
    
    return () => {
      unsubscribe();
      window.removeEventListener('design-updated', handleDesignUpdate);
    };
  }, []);

  return settings;
};
