// Service worker : réception des notifications push et ouverture de la bonne page au clic.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "MaFeliza", body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "MaFeliza", {
    body: data.body || "", icon: data.icon || "/img/icon-192.png", badge: "/img/icon-192.png", data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => new URL(c.url).pathname === new URL(url, self.location.origin).pathname);
    return open ? open.focus() : clients.openWindow(url);
  }));
});
