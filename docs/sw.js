'use strict';

importScripts('./schema.js');

const scope = new URL(self.registration.scope);
const url = path => new URL(path, scope).href;
const prefix = 'casur-field:' + scope.pathname + ':';
const shell = prefix + 'shell-v4';
const store = prefix + 'data-v1';
const index = url('index.html');
const dataFile = url('data/cronologico.json');
const assets = ['index.html', 'styles.css', 'schema.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'assets/negocios-de-cana.webp'].map(url);
const { isFieldSnapshot } = self.CasurFieldData;
let pendingData;

async function downloadData(cache) {
  const response = await fetch(dataFile, { cache: 'no-cache', signal: AbortSignal.timeout(3500) });
  if (!response.ok) throw Error('Cronológico no disponible');
  const data = await response.clone().json();
  if (!isFieldSnapshot(data)) throw Error('Cronológico no válido');
  const saved = await cache.match(dataFile);
  if (saved) {
    const prior = await saved.clone().json();
    if (Date.parse(data.importedAt) < Date.parse(prior.importedAt)) throw Error('Generación anterior');
  }
  await cache.put(dataFile, response.clone());
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const data = await caches.open(store);
    if (!await data.match(dataFile)) await downloadData(data);
    const app = await caches.open(shell);
    await app.addAll(assets.map(asset => new Request(asset, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== shell && key !== store).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function currentData() {
  const cache = await caches.open(store);
  try {
    pendingData ??= downloadData(cache).finally(() => { pendingData = null; });
    return (await pendingData).clone();
  } catch {
    const saved = await cache.match(dataFile);
    if (!saved) return Response.error();
    const headers = new Headers(saved.headers);
    headers.set('X-CASUR-Offline', '1');
    return new Response(saved.body, { status: saved.status, headers });
  }
}

async function shellAsset(request, key) {
  const cache = await caches.open(shell);
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw Error('Recurso no disponible');
    await cache.put(key, response.clone());
    return response;
  } catch {
    return await cache.match(key) ?? Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const incoming = new URL(request.url);
  if (incoming.origin !== scope.origin) return;
  incoming.search = '';
  if (incoming.href === dataFile) {
    event.respondWith(currentData());
  } else if (request.mode === 'navigate' && [scope.href, index].includes(incoming.href)) {
    event.respondWith(shellAsset(request, index));
  } else if (assets.includes(incoming.href)) {
    event.respondWith(shellAsset(request, incoming.href));
  }
});
