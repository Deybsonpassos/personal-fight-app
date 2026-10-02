// Service worker mínimo: cache do "casco" do app para abrir rápido; dados sempre vêm da rede.
const CACHE = "pf-v0.3.0";
const CASCO = ["./", "./index.html", "./style.css", "./app.js", "./config.js", "./manifest.webmanifest", "./entrevista.html", "./aluno.html", "./aluno.js", "./aluno.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCO)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Supabase e CDN: sempre rede
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
