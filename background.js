chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ connected: false, server: "188.166.185.166:1080" });
});

function setProxy(enable, server) {
  if (enable) {
    const [host, port] = server.split(":");
    chrome.proxy.settings.set(
      {
        value: {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: "socks5",
              host,
              port: parseInt(port, 10)
            }
          }
        },
        scope: "regular"
      }
    );
  } else {
    chrome.proxy.settings.clear({ scope: "regular" });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "toggle") {
    chrome.storage.local.get(["connected", "server"], ({ connected, server }) => {
      const newState = !connected;
      setProxy(newState, server);
      if (newState) {
        chrome.storage.local.set({ connected: true, startTime: Date.now() });
      } else {
        chrome.storage.local.set({ connected: false });
        chrome.storage.local.remove("startTime");
      }
      sendResponse({ connected: newState, server });
    });
    return true;
  }

  if (msg.action === "setServer") {
    chrome.storage.local.set({ server: msg.server }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
