// Revision portal offline: the page, its icons and fonts stay on the phone.
// Page: the stored copy first (opens at once, even in airplane mode), refreshed in the background for next time
// (network-first failed in airplane mode on iPhone). The API (script.google.com) never goes through this cache:
// her data and the writes waiting to be sent are kept by the page itself.
const CACHE = "mengschoul-v5", PAGE = "./";  // bump CACHE to drop the old copy at once
// iPhone refuses to show offline a response kept after a redirect: store a clean copy.
const clean = res => res.redirected
  ? res.clone().blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }))
  : Promise.resolve(res.clone());
const keep = (key, res) => {
  if (res.ok || res.type === "opaque") clean(res).then(copy => caches.open(CACHE).then(c => c.put(key, copy)));
  return res;
};
// The page being opened may not exist yet when its new version arrives: wait for it (up to 5 s).
async function tell(id) {
  for (let i = 0; i < 25; i++) {
    const c = id && await self.clients.get(id);
    if (c) return c.postMessage("updated");
    await new Promise(r => setTimeout(r, 200));
  }
}
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
    // When the downloaded page differs from the one just shown, the page is told and reloads itself
    // (at once on the home page, else when she gets back to it): one opening is enough for a new version.
    const fresh = fetch(u.origin + u.pathname, { cache: "no-store" }).then(async res => {
      if (!res.ok) return res;
      const old = await caches.match(PAGE), copy = await clean(res);
      const before = old ? await old.text() : null, now = await copy.clone().text();
      await caches.open(CACHE).then(c => c.put(PAGE, copy));
      if (before !== null && before !== now) await tell(e.resultingClientId || e.clientId);  // the cached copy answered the page already
      return res;
    });
    e.waitUntil(fresh.catch(() => {}));
    e.respondWith(caches.match(PAGE).then(r => r || fresh));
  } else if (u.origin === location.origin || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => keep(req, res))));
  }
});
