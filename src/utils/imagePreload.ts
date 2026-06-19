const globalCache: Record<string, HTMLImageElement> = {};

export function getImageCache(): Record<string, HTMLImageElement> {
  return globalCache;
}

export function clearImageCache(): void {
  for (const key in globalCache) delete globalCache[key];
}

// Drop cached images whose URL is not in `keep`. Every asset edit produces a
// brand-new data URL, so without this the cache grows unbounded across an
// edit→play session (each orphaned entry retains a decoded bitmap) and can
// eventually exhaust memory. Safe because only one full-screen mode (Play /
// Editor) is mounted at a time and both preload the complete current asset set.
export function pruneImageCache(keep: string[]): void {
  const keepSet = new Set(keep.filter(Boolean));
  for (const key in globalCache) {
    if (!keepSet.has(key)) delete globalCache[key];
  }
}

export async function preloadImages(urls: string[], opts: { prune?: boolean } = {}): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];

  if (opts.prune) pruneImageCache(unique);

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