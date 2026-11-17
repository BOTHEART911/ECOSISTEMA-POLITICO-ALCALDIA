/* Service worker en modo fresco · Ecosistema Digital de Campaña
   - La página y los estáticos propios se piden a la red revalidados (no a la caché HTTP).
   - version.js nunca se guarda: es la fuente de la versión.
   - Sin red, se sirve la última copia guardada. */
importScripts('version.js?sw=' + Date.now());
var V = self.EP_VERSION || 'dev';
var CACHE = 'ep-' + V;
var BASE = ['./', 'index.html', 'css/app.css?v=' + V, 'js/app.js?v=' + V, 'js/config.js?v=' + V, 'js/divipola.js?v=' + V,
  'img/logo-96.webp', 'img/logo-192.png', 'img/tablero-720.webp', 'img/inicio-cel-280.webp'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(BASE.map(function(u){ return fetch(new Request(u, {cache:'reload'})).then(function(r){ if(r.ok) return c.put(u, r); }).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k.indexOf('ep-')===0 && k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return;           // backend, DNS y fuentes van directo
  if(/\/version\.js$/.test(url.pathname)){ e.respondWith(fetch(req, {cache:'no-store'})); return; }
  if(/\/vid\//.test(url.pathname)) return;                                      // video: rangos, directo de la red
  if(req.mode === 'navigate' || /\.(css|js|webmanifest)$/.test(url.pathname)){
    // red primero, revalidada; sin red, la copia
    e.respondWith(fetch(req, {cache:'no-cache'}).then(function(r){
      if(r.ok){ var cp = r.clone(); caches.open(CACHE).then(function(c){ c.put(req.mode==='navigate' ? 'index.html' : req, cp); }); }
      return r;
    }).catch(function(){ return caches.match(req.mode==='navigate' ? 'index.html' : req, {ignoreSearch:req.mode==='navigate'}); }));
    return;
  }
  // imágenes: copia primero (nombres fijos), y se refresca de fondo
  e.respondWith(caches.match(req).then(function(m){
    var red = fetch(req).then(function(r){ if(r.ok){ var cp=r.clone(); caches.open(CACHE).then(function(c){ c.put(req, cp); }); } return r; });
    return m || red;
  }));
});
