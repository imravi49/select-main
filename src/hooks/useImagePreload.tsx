import { useEffect, useRef } from 'react';

interface PreloadOptions {
  range?: number;
  maxRetries?: number;
}

export const useImagePreload = (
  urls: string[],
  currentIndex: number,
  options: PreloadOptions = {}
) => {
  const { range = 5, maxRetries = 3 } = options;
  const loadedImages = useRef<Set<string>>(new Set());
  const retryCount = useRef<Map<string, number>>(new Map());

  const preloadImage = (url: string): Promise<void> => {
    // Skip preview URLs
    if (url.includes('/preview')) {
      return Promise.resolve();
    }

    // Already loaded
    if (loadedImages.current.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        loadedImages.current.add(url);
        retryCount.current.delete(url);
        resolve();
      };

      img.onerror = () => {
        const retries = retryCount.current.get(url) || 0;
        
        if (retries < maxRetries) {
          retryCount.current.set(url, retries + 1);
          
          // Exponential backoff
          const delay = Math.pow(2, retries) * 1000;
          
          setTimeout(() => {
            preloadImage(url).then(resolve).catch(reject);
          }, delay);
        } else {
          console.warn(`Failed to preload image after ${maxRetries} retries:`, url);
          reject(new Error(`Failed to load ${url}`));
        }
      };

      img.src = url;
    });
  };

  useEffect(() => {
    if (!urls.length) return;

    const preloadRange = async () => {
      const start = Math.max(0, currentIndex - range);
      const end = Math.min(urls.length, currentIndex + range + 1);
      
      const urlsToPreload = urls.slice(start, end);
      
      // Preload in parallel
      const promises = urlsToPreload.map(url => 
        preloadImage(url).catch(err => console.error('Preload error:', err))
      );
      
      await Promise.allSettled(promises);
    };

    preloadRange();
  }, [urls, currentIndex, range, maxRetries]);

  return {
    isLoaded: (url: string) => loadedImages.current.has(url),
    clearCache: () => {
      loadedImages.current.clear();
      retryCount.current.clear();
    },
  };
};
