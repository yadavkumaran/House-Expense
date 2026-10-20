const status = document.querySelector("#pwa-status");
const installButton = document.querySelector("#install-app");
const updateButton = document.querySelector("#update-app");
let installPrompt = null;
let waitingWorker = null;
let reloading = false;

function updateConnectionStatus() {
  const offline = !navigator.onLine;
  status.textContent = offline ? "Offline — shared data needs an internet connection." : "Online";
  status.classList.toggle("offline", offline);
  status.classList.add("visible");
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  try {
    await installPrompt.prompt();
    await installPrompt.userChoice;
  } catch (error) {
    console.error("House Expense installation prompt failed.", error);
    status.textContent = "Could not open the installation prompt. Try the browser menu instead.";
    status.classList.add("visible");
  } finally {
    installPrompt = null;
    installButton.classList.add("hidden");
  }
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.classList.add("hidden");
});

updateButton.addEventListener("click", () => {
  waitingWorker?.postMessage({ type: "SKIP_WAITING" });
});

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("./service-worker.js").then(registration => {
    const offerUpdate = worker => {
      waitingWorker = worker;
      updateButton.classList.remove("hidden");
    };
    if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
  }).catch(error => {
    console.error("House Expense service worker registration failed.", error);
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
