const toggleBtn = document.getElementById("toggleBtn");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const timerEl = document.getElementById("timer");
const serverSelect = document.getElementById("serverSelect");

const SERVERS_API = "https://dev.eeaglevpn.com/server"; // [ref] https://dev.eeaglevpn.com
const SERVERS_API_KEY = "svhhdbhweuydhscwhbduy7823ouyewebdhvhhas";
const DEFAULT_SERVER = { value: "188.166.185.166:1080", label: "default server- 1" };

let timerInterval;

function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => resolve(items));
  });
}

function setInStorage(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

async function loadServers(preferredServer) {
  const previousValue = preferredServer;
  let servers = [];
  try {
    const res = await fetch(SERVERS_API, { headers: { "x-api-key": SERVERS_API_KEY }, cache: "no-store" });
    if (!res.ok) throw new Error("Bad response");
    const payload = await res.json();
    const free = payload?.data?.free || [];
    const premium = payload?.data?.premium || [];

    function flattenGroups(groups) {
      const list = [];
      for (const group of groups) {
        const country = group?.countryName || "";
        const locations = Array.isArray(group?.locations) ? group.locations : [];
        for (const loc of locations) {
          const host = loc?.serverUrl;
          if (!host) continue;
          const name = loc?.name || country || host;
          list.push({ value: `${host}:1080`, label: `${country ? country + " - " : ""}${name}` });
        }
      }
      return list;
    }

    servers = [...flattenGroups(free), ...flattenGroups(premium)];
  } catch (_) {
    // Ignore and fallback
  }

  // Fallback to existing option if fetch failed or empty
  if (!servers.length) {
    servers = [DEFAULT_SERVER];
  }

  // Ensure the default server is present at the top exactly once
  const hasDefault = servers.some(s => s.value === DEFAULT_SERVER.value);
  if (!hasDefault) {
    servers.unshift(DEFAULT_SERVER);
  } else {
    // Move default to top if it's not already first
    servers = [DEFAULT_SERVER, ...servers.filter(s => s.value !== DEFAULT_SERVER.value)];
  }

  // Populate select
  serverSelect.innerHTML = "";
  for (const s of servers) {
    const opt = document.createElement("option");
    opt.value = s.value;
    opt.textContent = s.label || s.value;
    serverSelect.appendChild(opt);
  }

  // Determine selection
  let selected = previousValue && servers.some(s => s.value === previousValue)
    ? previousValue
    : DEFAULT_SERVER.value;
  if (selected) {
    serverSelect.value = selected;
    await setInStorage({ server: selected });
  }

  return selected;
}

function updateUI(connected, server, startTime) {
  toggleBtn.innerHTML = connected ? "Disconnect 😞" : "Go Private 🚀 ";
  statusEl.className = connected ? "connected" : "disconnected";
  timerEl.className = connected ? "timer-circle connected" : "timer-circle disconnected";

  if (connected) {
    const host = (server || "").split(":")[0] || server || "";
    const selectedOption = serverSelect.options[serverSelect.selectedIndex];
    const name = selectedOption?.text || host || "Server";
    statusText.innerHTML = `Connected 🔥`;
    serverName.textContent = `Server : ${name} `;
    serverHost.textContent = ` IP : (${host})`;
  } else {
    statusText.textContent = "Disconnected";
    serverName.textContent = "";
    serverHost.textContent = "";
  }

  if (connected) {
    startTimer(startTime);
    serverSelect.disabled = true;
  } else {
    stopTimer();
    timerEl.textContent =  "00:00:00"
    serverSelect.disabled = false;
  }
}

function startTimer(startTime) {
  stopTimer();
  timerInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const s = String(diff % 60).padStart(2, "0");
    timerEl.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

(async () => {
  const { connected, server, startTime } = await getFromStorage(["connected", "server", "startTime"]);
  const selectedServer = await loadServers(server);
  updateUI(!!connected, selectedServer || serverSelect.value, startTime || Date.now());
})();

toggleBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "toggle" }, (res) => {
    if (res.connected) {
      chrome.storage.local.set({ startTime: Date.now() });
      updateUI(true, res.server, Date.now());
    } else {
      chrome.storage.local.remove("startTime");
      updateUI(false, res.server);
    }
  });
});

serverSelect.addEventListener("change", (e) => {
  const server = e.target.value;
  chrome.runtime.sendMessage({ action: "setServer", server }, () => {});
  setInStorage({ server });
});
