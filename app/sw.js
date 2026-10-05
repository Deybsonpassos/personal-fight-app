// Service worker mínimo: cache do "casco" do app para abrir rápido; dados sempre vêm da rede.
const CACHE = "pf-v0.6.0";
const CASCO = ["./", "./index.html", "./style.css", "./app.js", "./config.js", "./manifest.webmanifest", "./entrevista.html", "./aluno.html", "./aluno.js", "./aluno.webmanifest", "./qrcode.js", "./pix.js"];
const ESCOPO = new URL(self.registration.scope).pathname;
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCO).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // só os arquivos do próprio app (mesmo domínio E dentro do escopo); API, Supabase e CDN: sempre rede, sem cache
  if (e.request.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith(ESCOPO)) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
