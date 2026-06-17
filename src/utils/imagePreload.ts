const globalCache: Record<string, HTMLImageElement> = {};

export function getImageCache(): Record<string, HTMLImageElement> {
  return globalCache;
}

export function clearImageCache(): void {
  for (const key in globalCache) delete globalCache[key];
}

export async function preloadImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];

  await Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          const cached = globalCache[src];
          if (cached?.complete && cached.naturalWidth > 0) {
            resolve();
            return;
          }

          const img = new Image();
          const finish = () => resolve();

          img.onload = () => {
            if (typeof img.decode === 'function') {
              img.decode().then(finish).catch(finish);
            } else {
              finish();
            }
          };
          img.onerror = finish;
          img.src = src;
          globalCache[src] = img;
        }),
    ),
  );
}