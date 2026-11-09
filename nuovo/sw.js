/*
 * Impara giocando – service worker: keeps the app usable offline.
 * Pages and data are served from the network when possible and cached on
 * the way ("network first"); without connection the cached copy is used.
 */
var CACHE = "impara-v1";
var PRIMI = [
  "./", "./index.html", "./core/stile.css", "./core/core.js", "./manifest.webmanifest",
  "./icone/icona.svg", "./icone/icona-192.png"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRIMI); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (risposta) {
    if (risposta && risposta.ok) { var copia = risposta.clone(); caches.open(CACHE).then(function (c) { c.put(r, copia); }); }
    return risposta;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: r.mode === "navigate" }).then(function (m) { return m || caches.match("./index.html"); });
  }));
});
