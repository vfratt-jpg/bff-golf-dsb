// Golf Dashboard Service Worker
// Provides offline functionality and performance optimization

const CACHE_NAME = 'golf-dashboard-v1.2';
const STATIC_CACHE = 'golf-static-v1.2';
const DATA_CACHE = 'golf-data-v1.2';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/index.html',
    '/app.js',
    '/enhanced-styles.css',
    '/data/championships.json',
    '/our-story.html',
    '/analytics.html',
    // External CDN resources
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/date-fns@2.29.3/index.min.js'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES.map(url => {
                    return new Request(url, { cache: 'reload' });
                }));
            }),
            
            // Initialize data cache
            caches.open(DATA_CACHE).then((cache) => {
                console.log('Service Worker: Data cache initialized');
                return cache;
            })
        ]).then(() => {
            console.log('Service Worker: Installation complete');
            // Force activation of new service worker
            return self.skipWaiting();
        }).catch((error) => {
            console.error('Service Worker: Installation failed', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DATA_CACHE && 
                            cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Take control of all clients
            self.clients.claim()
        ]).then(() => {
            console.log('Service Worker: Activation complete');
        }).catch((error) => {
            console.error('Service Worker: Activation failed', error);
        })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle different types of requests
    if (request.method === 'GET') {
        if (isDataRequest(request)) {
            // Handle data requests with network-first strategy
            event.respondWith(handleDataRequest(request));
        } else if (isStaticResource(request)) {
            // Handle static resources with cache-first strategy
            event.respondWith(handleStaticRequest(request));
        } else if (isNavigationRequest(request)) {
            // Handle navigation requests
            event.respondWith(handleNavigationRequest(request));
        } else {
            // Handle other requests with network-first fallback
            event.respondWith(handleGenericRequest(request));
        }
    }
});

// Check if request is for data (JSON files)
function isDataRequest(request) {
    return request.url.includes('/data/') || 
           request.url.endsWith('.json');
}

// Check if request is for static resources
function isStaticResource(request) {
    return request.url.includes('.css') ||
           request.url.includes('.js') ||
           request.url.includes('.png') ||
           request.url.includes('.jpg') ||
           request.url.includes('.jpeg') ||
           request.url.includes('.gif') ||
           request.url.includes('.svg') ||
           request.url.includes('.ico') ||
           request.url.includes('cdn.jsdelivr.net');
}

// Check if request is for navigation (HTML pages)
function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
           request.url.endsWith('.html') ||
           (request.headers.get('accept') && 
            request.headers.get('accept').includes('text/html'));
}

// Handle data requests - Network first, cache fallback
async function handleDataRequest(request) {
    try {
        console.log('Service Worker: Fetching data from network', request.url);
        
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful response
            const cache = await caches.open(DATA_CACHE);
            cache.put(request, networkResponse.clone());
            console.log('Service Worker: Data cached', request.url);
            return networkResponse;
        }
        
        throw new Error(`Network response not ok: ${networkResponse.status}`);
        
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache', request.url);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('Service Worker: Serving from cache', request.url);
            return cachedResponse;
        }
        
        // If no cache, return offline response
        return createOfflineResponse(request);
    }
}

// Handle static resources - Cache first, network fallback
async function handleStaticRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('Service Worker: Serving static from cache', request.url);
            return cachedResponse;
        }
        
        console.log('Service Worker: Fetching static from network', request.url);
        
        // Fallback to network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful response
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
            console.log('Service Worker: Static resource cached', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Service Worker: Failed to fetch static resource', request.url, error);
        return createOfflineResponse(request);
    }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
    try {
        // Try network first for navigation
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful navigation response
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error(`Navigation response not ok: ${networkResponse.status}`);
        
    } catch (error) {
        console.log('Service Worker: Navigation network failed, trying cache', request.url);
        
        // Fallback to cached version
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback to index.html for SPA behavior
        const indexResponse = await caches.match('/index.html');
        if (indexResponse) {
            return indexResponse;
        }
        
        return createOfflineResponse(request);
    }
}

// Handle generic requests
async function handleGenericRequest(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        // Try cache fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return createOfflineResponse(request);
    }
}

// Create offline response
function createOfflineResponse(request) {
    if (request.headers.get('accept').includes('text/html')) {
        // Return offline HTML page
        return new Response(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - Golf Dashboard</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                        color: white;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        text-align: center;
                    }
                    .offline-container {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        padding: 40px;
                        border-radius: 15px;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    }
                    .offline-icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        margin-bottom: 20px;
                        color: #fff;
                    }
                    p {
                        margin-bottom: 30px;
                        opacity: 0.9;
                    }
                    .retry-btn {
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        transition: background 0.3s ease;
                    }
                    .retry-btn:hover {
                        background: #45a049;
                    }
                </style>
            </head>
            <body>
                <div class="offline-container">
                    <div class="offline-icon">🌐</div>
                    <h1>You're Offline</h1>
                    <p>It looks like you're not connected to the internet.<br>
                    Some features may not be available until you reconnect.</p>
                    <button class="retry-btn" onclick="window.location.reload()">
                        Try Again
                    </button>
                </div>
            </body>
            </html>
        `, {
            status: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache'
            }
        });
    }
    
    if (request.headers.get('accept').includes('application/json')) {
        // Return empty JSON for data requests
        return new Response('{"error": "Offline", "data": []}', {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    }
    
    // Generic offline response
    return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache'
        }
    });
}

// Background sync for data updates
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'background-sync-data') {
        event.waitUntil(syncData());
    }
});

// Sync data in background
async function syncData() {
    try {
        console.log('Service Worker: Syncing data in background');
        
        const response = await fetch('/data/championships.json');
        if (response.ok) {
            const cache = await caches.open(DATA_CACHE);
            await cache.put('/data/championships.json', response);
            console.log('Service Worker: Background data sync complete');
            
            // Notify clients about data update
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'DATA_UPDATED',
                    message: 'Tournament data has been updated'
                });
            });
        }
    } catch (error) {
        console.error('Service Worker: Background sync failed', error);
    }
}

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received', event);
    
    const options = {
        body: event.data ? event.data.text() : 'New tournament data available!',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View Dashboard',
                icon: '/favicon.ico'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/favicon.ico'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Golf Dashboard Update', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked', event);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Open the dashboard
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_UPDATE') {
        // Force cache update
        event.waitUntil(updateCache());
    }
});

// Update cache manually
async function updateCache() {
    try {
        console.log('Service Worker: Manual cache update triggered');
        
        const cache = await caches.open(STATIC_CACHE);
        const requests = STATIC_FILES.map(url => new Request(url, { cache: 'reload' }));
        
        await cache.addAll(requests);
        console.log('Service Worker: Manual cache update complete');
        
    } catch (error) {
        console.error('Service Worker: Manual cache update failed', error);
    }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    console.log('Service Worker: Periodic sync triggered', event.tag);
    
    if (event.tag === 'data-sync') {
        event.waitUntil(syncData());
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('Service Worker: Global error', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker: Unhandled promise rejection', event.reason);
});

console.log('Service Worker: Script loaded successfully');
Add service worker for offline functionality
