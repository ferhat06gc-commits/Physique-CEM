/* ============================================================
   Service worker — العلوم الفيزيائية والتكنولوجيا (1AM–3AM)
   Rôle : garder une copie de l'application sur l'appareil pour
   qu'elle s'ouvre SANS connexion, et la mettre à jour dès que
   l'appareil est en ligne.
   VERSION est recalculée automatiquement par build_pwa.sh
   (empreinte du contenu) : ne pas la modifier à la main.
   ============================================================ */
const VERSION = "950c490713da";
const PREFIXE = "physique-cem-";
const CACHE = PREFIXE + VERSION;
const FICHIERS = [
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];
const DELAI_RESEAU_MS = 3000;

/* Installation : on télécharge tout, en contournant le cache HTTP
   ({cache:"reload"}) pour ne pas figer une ancienne copie. */
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FICHIERS.map((u) => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

/* Activation : on supprime les copies des versions précédentes. */
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter((k) => k.startsWith(PREFIXE) && k !== CACHE)
                          .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* La page demande la version du service worker actif. */
self.addEventListener("message", (e) => {
  if (e.data === "version" && e.source) e.source.postMessage({ version: VERSION });
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // liens externes : réseau normal

  if (req.mode === "navigate") {
    e.respondWith(pageReseauDAbord(e));
    return;
  }
  // icônes, manifeste : copie locale d'abord, réseau sinon
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req))
  );
});

/* La page : réseau d'abord (version la plus récente), avec un délai
   maximal ; hors connexion ou réseau trop lent → copie locale.
   La copie locale est rafraîchie en arrière-plan à chaque réponse réseau. */
async function pageReseauDAbord(e) {
  let finir;
  e.waitUntil(new Promise((ok) => { finir = ok; }));
  const reseau = fetch(e.request).then((r) => {
    if (r.ok && r.type === "basic") {
      const copie = r.clone();
      caches.open(CACHE).then((c) => c.put("./index.html", copie)).catch(() => {}).finally(finir);
    } else finir();
    return r;
  }, (err) => { finir(); throw err; });
  reseau.catch(() => {});
  try {
    return await Promise.race([
      reseau,
      new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("lent")), DELAI_RESEAU_MS))
    ]);
  } catch (_) {
    const locale = await caches.match("./index.html", { cacheName: CACHE });
    return locale || reseau;
  }
}
