// Revision portal offline: the page, its icons and fonts stay on the phone.
// Page: the stored copy first (opens at once, even in airplane mode), refreshed in the background for next time
// (network-first failed in airplane mode on iPhone). The API (script.google.com) never goes through this cache:
// her data and the writes waiting to be sent are kept by the page itself.
const CACHE = "mengschoul-v4", PAGE = "./";  // bump CACHE to drop the old copy at once
// iPhone refuses to show offline a response kept after a redirect: store a clean copy.
const clean = res => res.redirected
  ? res.clone().blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }))
  : Promise.resolve(res.clone());
const keep = (key, res) => {
  if (res.ok || res.type === "opaque") clean(res).then(copy => caches.open(CACHE).then(c => c.put(key, copy)));
  return res;
};
self.addEventListener("install", e => {
  const files = [PAGE, "icon-180.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(files.map(u =>
    fetch(u, { cache: "reload" }).then(clean).then(x => c.put(u, x))))));
  self.skipWaiting();
});
self.addEventListener("activate", e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET") return;
  if (u.origin === location.origin && (req.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith(".html"))) {
    // One copy of the page: her link (#k=…), index.html and the home-screen icon share and update it.
    const fresh = fetch(u.origin + u.pathname, { cache: "no-store" }).then(res => keep(PAGE, res));
    e.waitUntil(fresh.catch(() => {}));
    e.respondWith(caches.match(PAGE).then(r => r || fresh));
  } else if (u.origin === location.origin || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => keep(req, res))));
  }
});
