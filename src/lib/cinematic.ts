// src/lib/cinematic.ts
// Cinematic reveal with guaranteed logo visibility and animated gold glow
import "@/styles/cinematic.css";

export async function showCinematicReveal(logoUrl?: string, altText = "Ravi Sharma Photo & Films") {
  return new Promise<void>((resolve) => {
    try {
      // Preload image if logoUrl exists
      if (logoUrl) {
        const imgPreload = new Image();
        imgPreload.src = logoUrl;
      }

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'cinematic-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');

      // Create inner container with glow effect
      const inner = document.createElement('div');
      inner.className = 'cinematic-inner cinematic-glow';

      if (logoUrl) {
        const img = document.createElement('img');
        img.src = logoUrl;
        img.alt = altText;
        img.className = 'cinematic-logo';
        inner.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'cinematic-logo cinematic-text';
        span.textContent = altText;
        inner.appendChild(span);
      }

      overlay.appendChild(inner);
      document.body.appendChild(overlay);

      // Force reflow to ensure animation runs
      overlay.offsetHeight;

      // Run animation then cleanup
      setTimeout(() => {
        overlay.classList.add('cinematic-fadeout');
        setTimeout(() => {
          if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
          resolve();
        }, 500);
      }, 3500);
    } catch (err) {
      resolve();
    }
  });
}

export default showCinematicReveal;
