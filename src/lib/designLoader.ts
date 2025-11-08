// src/lib/designLoader.ts
// Cinematic Design Loader (frozen font version)
// - Locks Playfair Display (headings) + Inter (body)
// - Keeps live Firestore color updates
// - Safe, production-ready, no dynamic font fetching

import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";

export async function initDesignLoader() {
  const ref = doc(firestore, "settings", "design");

  async function applyDesign(data: any) {
    if (!data) return;
    const root = document.documentElement;

    // 🎨 Primary / Secondary colors (still realtime)
    const primary =
      data.primaryColor ||
      data.primary_color ||
      "#c8a44d"; // gold tone fallback

    const secondary =
      data.secondaryColor ||
      data.secondary_color ||
      "#000000"; // deep black fallback

    root.style.setProperty("--primary-color", primary);
    root.style.setProperty("--secondary-color", secondary);
    root.style.setProperty("--app-bg-color", secondary || "#000000");

    // 🖋️ Locked Fonts — Playfair Display + Inter
    const styleId = "cinematic-fonts";
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap');
      :root {
        --app-font: 'Inter', sans-serif;
        --heading-font: 'Playfair Display', serif;
      }
      body, button, input, textarea {
        font-family: var(--app-font);
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--heading-font);
      }
    `;
  }

  // Initial load
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) await applyDesign(snap.data());
  } catch (e) {
    console.warn("DesignLoader initial load failed:", e);
  }

  // Realtime listener for color updates
  onSnapshot(ref, (snap) => {
    if (snap.exists()) applyDesign(snap.data());
  });

  // Manual trigger if admin updates design
  window.addEventListener("design-updated", async () => {
    const snap = await getDoc(ref);
    if (snap.exists()) await applyDesign(snap.data());
  });
}

// 🌓 Legacy compatibility stub (for AppKebab.tsx)
export function setThemeMode(mode?: string) {
  document.documentElement.dataset.theme = mode || "default";
}
