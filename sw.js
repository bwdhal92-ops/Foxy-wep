const CACHE_NAME = 'foxy-v143';
const ASSETS = [
    '/',
    '/web.html',
    '/login.html',
    '/manifest.json',
    '/assets/css/style.css',
    '/assets/css/style.css?v=20261011-stream-card6',
    '/assets/js/device-detect.js',
    '/assets/js/device-detect.js?v=20261020-device1',
    '/assets/js/foxy-composer.js',
    '/assets/js/firebase-config.js',
    '/assets/js/auth-check.js',
    '/assets/js/login.js',
    '/assets/js/main.js',
    '/assets/js/main.js?v=20261012-screen-audio-volume1',
    '/assets/js/ui-manager.js',
    '/assets/js/webrtc-core.js',
    '/assets/js/ice-config.js',
    '/assets/js/foxy-diag.js',
    '/assets/js/modules/ui-base.js',
    '/assets/js/modules/ui-messenger.js',
    '/assets/js/modules/ui-participants.js',
    '/assets/js/modules/ui-participants.js?v=20261011-stream-card6',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-viewers-audio2',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-audio-volume1',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-card-stability1',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-card-stability2',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-diagnostics1',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-retry-volume1',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-retry-order1',
    '/assets/js/modules/ui-participants.js?v=20261012-screen-retry-order2',
    '/assets/js/modules/ui-participants.js?v=20261020-screen-volume-fix1',
    '/assets/js/modules/ui-controls.js',
    '/assets/js/modules/ui-controls.js?v=20261012-screen-viewers-audio2',
    '/assets/js/modules/gestures.js',
    '/assets/js/modules/servers.js',
    '/assets/js/modules/servers.js?v=20261020-leave-cleanup1',
    '/assets/js/modules/friends.js',
    '/assets/js/modules/direct-messages.js',
    '/assets/js/modules/direct-messages.js?v=20261020-leave-cleanup1',
    '/assets/js/modules/webrtc-base.js',
    '/assets/js/modules/webrtc-base.js?v=20261012-screen-reconnect2',
    '/assets/js/modules/webrtc-base.js?v=20261020-leave-cleanup1',
    '/assets/js/modules/webrtc-data.js?v=20261011-perf3',
    '/assets/js/modules/webrtc-data.js?v=20261012-screen-viewers-audio2',
    '/assets/js/modules/webrtc-data.js?v=20261012-screen-reconnect2',
    '/assets/js/modules/webrtc-data.js?v=20261012-screen-diagnostics1',
    '/assets/js/modules/webrtc-data.js?v=20261012-screen-retry-volume1',
    '/assets/js/modules/webrtc-data.js?v=20261012-screen-flow-diag1',
    '/assets/js/modules/webrtc-data.js?v=20261020-leave-cleanup1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261012-screen-flow-diag1',
    '/assets/js/modules/webrtc-media.js',
    '/assets/js/modules/webrtc-media.js?v=20261012-screen-audio-volume1',
    '/assets/js/modules/webrtc-media.js?v=20261012-screen-diagnostics1',
    '/assets/js/modules/webrtc-media.js?v=20261012-screen-retry-volume1',
    '/assets/js/modules/webrtc-media.js?v=20261012-screen-retry-order1',
    '/assets/js/modules/webrtc-media.js?v=20261020-leave-cleanup1',
    '/assets/js/modules/webrtc-media.js?v=20261020-screen-volume-fix1',
    '/assets/js/modules/webrtc-screen.js?v=20261011-perf2',
    '/assets/js/modules/webrtc-screen.js?v=20261012-screen-viewers-audio2',
    '/assets/js/modules/webrtc-screen.js?v=20261012-screen-audio-volume1',
    '/assets/js/modules/webrtc-screen.js?v=20261012-screen-reconnect2',
    '/assets/js/modules/webrtc-screen.js?v=20261012-screen-retry-volume1',
    '/assets/js/modules/webrtc-screen.js?v=20261020-screen-volume-fix1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261011-mux5',
    '/assets/js/modules/webrtc-multiplex.js?v=20261012-screen-viewers-audio2',
    '/assets/js/modules/webrtc-multiplex.js?v=20261012-screen-audio-volume1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261012-screen-card-stability1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261012-screen-card-stability2',
    '/assets/js/modules/webrtc-multiplex.js?v=20261012-screen-diagnostics1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261012-screen-retry-volume1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261020-leave-cleanup1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261020-screen-volume-fix1',
    '/assets/js/modules/ui-participants.js?v=20261020-leave-participant-fix1',
    '/assets/js/modules/servers.js?v=20261020-leave-participant-fix1',
    '/assets/js/modules/webrtc-media.js?v=20261020-leave-participant-fix1',
    '/assets/js/modules/webrtc-base.js?v=20261020-screen-watch-fix9',
    '/assets/js/modules/webrtc-data.js?v=20261020-screen-watch-fix9',
    '/assets/js/modules/webrtc-media.js?v=20261020-screen-watch-fix9',
    '/assets/js/modules/webrtc-multiplex.js?v=20261020-screen-watch-fix9',
    '/assets/js/modules/webrtc-screen.js?v=20261020-screen-watch-fix9',
    '/assets/js/modules/ui-participants.js?v=20261021-screen-volume-fix3',
    '/assets/js/modules/webrtc-media.js?v=20261021-screen-volume-fix3',
    '/assets/js/modules/webrtc-screen.js?v=20261021-screen-volume-fix3',
    '/assets/js/modules/webrtc-multiplex.js?v=20261021-screen-volume-fix3',
    '/assets/js/modules/ui-participants.js?v=20261021-screen-mode1',
    '/assets/js/modules/voice-notification.js?v=20261021-voice-notif1',
    '/assets/js/modules/ui-controls.js?v=20261021-screen-mode1',
    '/assets/js/modules/webrtc-base.js?v=20261021-screen-mode1',
    '/assets/js/modules/webrtc-data.js?v=20261021-screen-mode1',
    '/assets/js/modules/webrtc-media.js?v=20261021-screen-mode1',
    '/assets/js/modules/webrtc-multiplex.js?v=20261021-screen-mode1',
    '/assets/js/modules/webrtc-screen.js?v=20261021-screen-mode1',
    '/assets/js/main.js?v=20261021-screen-mode1',
    '/assets/js/libs/gtcrn-processor.js?v=20260921-5',
    '/assets/js/libs/gtcrn.wasm',
    '/assets/js/modules/webrtc-browser-secure.js',
    '/assets/js/modules/spatial-audio.js',
    '/assets/js/modules/rtc-health.js',
    '/assets/js/modules/rtc-failover.js',
    '/assets/js/modules/audio-mixer.js',
    '/assets/js/workers/rtc-analytics.worker.js',
    '/assets/js/modules/pip-manager.js',
    '/assets/js/modules/mentions.js',
    '/assets/js/modules/profile.js',
    '/assets/js/profile-color.js',
    '/assets/js/modules/ui-avatar-banner.js',
    '/assets/js/modules/lazy-media.js',
    '/assets/img/foxy.png',
    '/assets/img/foxy-mask.png',
    '/assets/js/libs/peerjs-foxy-1.5.2.js?v=foxy-perf-1',
    '/assets/js/libs/peerjs-foxy-1.5.2.js?v=foxy-sendrecv-fix2',
    '/assets/js/libs/peerjs.min.js?v=foxy-mux-1',
];

const NETWORK_FIRST = [
    '/web.html',
    '/',
    '/assets/js/device-detect.js',
    '/assets/js/foxy-composer.js',
    '/assets/js/modules/webrtc-base.js',
    '/assets/js/modules/servers.js',
    '/assets/js/modules/webrtc-data.js',
    '/assets/js/modules/webrtc-media.js',
    '/assets/js/modules/webrtc-screen.js',
    '/assets/js/modules/webrtc-multiplex.js',
    '/assets/js/modules/webrtc-browser-secure.js',
    '/assets/js/modules/spatial-audio.js',
    '/assets/js/modules/rtc-health.js',
    '/assets/js/modules/rtc-failover.js',
    '/assets/js/modules/audio-mixer.js',
    '/assets/js/workers/rtc-analytics.worker.js',
    '/assets/js/webrtc-core.js',
    '/assets/js/modules/ui-base.js',
    '/assets/js/modules/ui-controls.js',
    '/assets/js/modules/ui-messenger.js',
    '/assets/js/modules/ui-participants.js',
    '/assets/js/modules/friends.js',
    '/assets/js/modules/direct-messages.js',
    '/assets/js/modules/mentions.js',
    '/assets/js/modules/profile.js',
    '/assets/js/profile-color.js',
    '/assets/js/modules/ui-avatar-banner.js',
    '/assets/js/modules/lazy-media.js',
    '/assets/js/modules/pip-manager.js',
    '/assets/js/modules/gestures.js',
    '/assets/js/main.js',
    '/assets/js/ui-manager.js',
    '/assets/css/style.css',
    '/assets/error/down.html',
    '/assets/error/firebase-limit.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Pre-caching core assets...');
            // مهم: بنتأكد إن الاستجابة فعلاً من النوع الصح قبل ما نخزّنها.
            // بعض الاستضافات المجانية بترجّع صفحة خطأ HTML (بحالة 200) بدل الملف،
            // ولو خزّناها الكاش يتسمّم ويفضل الملف بايظ لحد ما المستخدم يمسح الداتا.
            await Promise.allSettled(ASSETS.map(async (asset) => {
                try {
                    const res = await fetch(asset, { cache: 'reload' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const ct = res.headers.get('content-type') || '';
                    const isDoc = (asset === '/' || asset.endsWith('.html'));
                    const html = ct.includes('html');
                    if (isDoc ? !html : html) throw new Error('unexpected content-type: ' + (ct || 'none'));
                    await cache.put(asset, res);
                } catch (err) {
                    console.warn(`[SW] Pre-cache skipped for ${asset}:`, err && err.message);
                }
            }));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const pathname = url.pathname;

    if (!url.protocol.startsWith('http')) return;

    if (pathname.endsWith('manifest.json')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const ct = response.headers.get('content-type') || '';
                    if (response.ok && (ct.includes('application/json') || ct.includes('application/manifest+json'))) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                        return response;
                    }
                    throw new Error('Manifest response is not JSON');
                })
                .catch(() => {
                    return caches.match(event.request, { ignoreSearch: true }).then(cached => {
                        if (cached) {
                            const ct = cached.headers.get('content-type') || '';
                            if (ct.includes('application/json') || ct.includes('application/manifest+json')) {
                                return cached;
                            }
                        }
                        return new Response(JSON.stringify({
                            "name": "Foxy",
                            "short_name": "Foxy",
                            "start_url": "./",
                            "display": "standalone",
                            "background_color": "#0d0e13",
                            "theme_color": "#3b82f6",
                            "icons": [{"src": "assets/img/foxy.png", "sizes": "192x192", "type": "image/png"}]
                        }), {
                            headers: { 'Content-Type': 'application/json; charset=utf-8' }
                        });
                    });
                })
        );
        return;
    }

    const isLocalAsset = url.origin === self.location.origin;
    const isCdnAsset = ['unpkg.com', 'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'ui-avatars.com', 'www.gstatic.com', 'wsrv.nl'].includes(url.hostname);
    const isImageUrl = ['i.ibb.co', 'wsrv.nl'].includes(url.hostname);

    if (!isLocalAsset && !isCdnAsset && !isImageUrl) return;

    const isJavaScript = pathname.endsWith('.js');
    // متعرّف برّه الـ then/catch عشان الاتنين يقدروا يستخدموه
    // (كان جوه .then فـ .catch كان بيرمي ReferenceError وقت الصفحة أوفلاين)
    const expectingDocument = pathname === '/' || pathname.endsWith('.html');

    // هل الاستجابة من النوع الصح؟ (صفحة HTML مكان ملف JS = صفحة خطأ من الاستضافة)
    const isValid = (res) => {
        if (!res || !res.ok) return false;
        const ct = res.headers.get('content-type') || '';
        const html = ct.includes('html');
        return expectingDocument ? html : !html;
    };

    const dropCache = (request) => caches.open(CACHE_NAME).then(c => c.delete(request));

    if (NETWORK_FIRST.includes(pathname) || pathname === '/' || isJavaScript) {
        event.respondWith((async () => {
            try {
                const response = await fetch(event.request);
                if (isValid(response)) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, response.clone());
                    return response;
                }
                // الاستضافة رجّعت صفحة HTML بدل الملف — نمسح أي نسخة قديمة مسمومة
                await dropCache(event.request);
                throw new Error(`Invalid asset response for ${pathname}`);
            } catch (err) {
                let cached = await caches.match(event.request, { ignoreSearch: true });
                const cachedType = cached ? (cached.headers.get('content-type') || '') : '';

                // لو النسخة المخزّنة صفحة HTML (من SW قديم أو صفحة خطأ) — نمسحها
                // ونحاول نجيب الملف تاني، وإلا نرجّع رد فاضي نضيف بدل ما المتصفح
                // يشغّل الصفحة كأنها سكريبت ("Unexpected token '<'").
                if (cached && !expectingDocument && cachedType.includes('html')) {
                    await dropCache(event.request);
                    cached = null;
                    try {
                        const retry = await fetch(event.request);
                        if (isValid(retry)) {
                            const cache = await caches.open(CACHE_NAME);
                            cache.put(event.request, retry.clone());
                            return retry;
                        }
                    } catch (_) {}
                }

                if (cached) return cached;

                if (expectingDocument) {
                    const fb = await caches.match('/assets/error/down.html', { ignoreSearch: true });
                    return fb || new Response(
                        '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
                        '<body style="font:16px system-ui;background:#0d0e13;color:#e6e6e6;padding:40px">' +
                        '<h1>لا يوجد اتصال</h1><p>تعذّر تحميل الصفحة ونسخة محلية غير متاحة.</p>',
                        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                    );
                }
                return new Response('', {
                    status: 503,
                    headers: { 'Content-Type': isJavaScript ? 'application/javascript' : 'text/plain' }
                });
            }
        })());
        return;
    }

    event.respondWith(
        caches.match(event.request, { ignoreSearch: isLocalAsset }).then((cachedResponse) => {
            if (cachedResponse) {
                if (isCdnAsset) {
                    fetch(event.request).then(networkResponse => {
                        if (networkResponse.ok) {
                            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
                        }
                    }).catch(() => {});
                }
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => {
                return caches.match('/assets/error/down.html', { ignoreSearch: true }).then(fallback => {
                    return fallback || new Response('Offline', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                });
            });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

//FIX: مافيش handler للإشعارات أصلاً ⇒ أزرار الإشعار (رد/رفض المكالمة، كتم
//المايك، قطع الاتصال…) كانت ميتة. بنوجّه الأكشن للصفحة المفتوحة.
self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const data = (notification && notification.data) || {};
    const rawAction = event.action || '';
    if (notification) notification.close();

    let action = rawAction;
    let payload = {};
    switch (rawAction) {
        case 'accept':
            action = 'ACCEPT_CALL';
            payload = { uid: data.friendUid, name: data.friendName };
            break;
        case 'decline':
            action = 'DECLINE_CALL';
            payload = { uid: data.friendUid, name: data.friendName };
            break;
        case 'mute':
            action = 'VOICE_MUTE';
            break;
        case 'deafen':
            action = 'VOICE_DEAFEN';
            break;
        case 'disconnect':
            action = 'VOICE_DISCONNECT';
            break;
        default:
            if (data && data.type === 'voice-call') {
                action = 'VOICE_FOCUS';
            } else if (data && data.action) {
                action = data.action;
                payload = { uid: data.friendUid, name: data.friendName };
            }
    }

    event.waitUntil((async () => {
        try {
            const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            let client = null;
            for (const candidate of all) {
                try {
                    if (new URL(candidate.url).origin === self.location.origin) { client = candidate; break; }
                } catch (_) {}
            }
            if (!client && all.length) client = all[0];
            if (client) {
                try { await client.focus(); } catch (_) {}
                client.postMessage({ action, ...payload, data });
            } else {
                await self.clients.openWindow((data && data.url) || '/');
            }
        } catch (_) {}
    })());
});
