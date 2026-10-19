// Shows the last copy of the page at once (even offline) and fetches the new one for next time.
const CACHE = "mengschoul-v3";  // bump to drop the old copy at once
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "icon-180.png", "manifest.webmanifest"].map(u => new Request(u, { cache: "reload" }))))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    // One copy per file: her link's #k=… and the home-screen icon must share (and update) the same entry.
    const u = new URL(e.request.url), key = u.origin + u.pathname.replace(/index\.html$/, "");
    const hit = await c.match(key);
    const net = fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok) c.put(key, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
