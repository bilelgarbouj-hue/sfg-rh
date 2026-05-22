/* firebase-messaging-sw.js — À placer à la RACINE du projet */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDOdhOTBINTItOGI3Mi00YTRkLWFkYjMtZjQ2MWMzNjAyM2Q5",
  authDomain: "garbouj-app.firebaseapp.com",
  databaseURL: "https://garbouj-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "garbouj-app",
  storageBucket: "garbouj-app.appspot.com",
  messagingSenderId: "1053408365509",
  appId: "1:1053408365509:web:2c1629fdd59ec858f619ac"
});

const messaging = firebase.messaging();

/* Notif reçue app FERMÉE */
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(title || "SFG Garbouj", {
    body: body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data
  });
});

/* Clic sur notif → ouvrir l'app */
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = "/";
  if (data.type === "demande" || data.type === "demande_status") url = "/index.html";
  if (data.type === "message" || data.type === "admin_reply")   url = "/index.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin)) { w.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});
