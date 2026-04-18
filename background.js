const POLL_INTERVAL_MS = 5 * 60 * 1000;
const HISTORY_DAYS = 7;
const TRANSITION_WINDOW_MS = 30 * 1000;
const MAX_HISTORY_ITEMS = 5000;

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isSkippable(url) {
  if (!url) return true;
  const skip = ["chrome://", "chrome-extension://", "about:", "data:", "javascript:"];
  return skip.some(p => url.startsWith(p));
}

async function buildGraphData() {
  const startTime = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;

  const items = await chrome.history.search({
    text: "",
    startTime,
    maxResults: MAX_HISTORY_ITEMS
  });

  const visitDetails = await Promise.all(
    items.map(item =>
      chrome.history.getVisits({ url: item.url }).then(visits =>
        visits.map(v => ({ url: item.url, domain: getDomain(item.url), time: v.visitTime }))
      )
    )
  );

  const allVisits = visitDetails
    .flat()
    .filter(v => v.domain && !isSkippable(v.url))
    .sort((a, b) => a.time - b.time);

  const nodeMap = {};
  const edgeMap = {};

  for (const visit of allVisits) {
    const d = visit.domain;
    if (!nodeMap[d]) {
      nodeMap[d] = { id: d, visits: 0, times: [] };
    }
    nodeMap[d].visits++;
    nodeMap[d].times.push(visit.time);
  }

  for (let i = 1; i < allVisits.length; i++) {
    const prev = allVisits[i - 1];
    const curr = allVisits[i];
    if (
      prev.domain !== curr.domain &&
      curr.time - prev.time <= TRANSITION_WINDOW_MS
    ) {
      const key = [prev.domain, curr.domain].sort().join("|||");
      if (!edgeMap[key]) {
        edgeMap[key] = { source: prev.domain, target: curr.domain, weight: 0 };
      }
      edgeMap[key].weight++;
    }
  }

  const nodes = Object.values(nodeMap);
  const edges = Object.values(edgeMap).filter(e =>
    nodeMap[e.source] && nodeMap[e.target]
  );

  const graphData = {
    nodes,
    edges,
    updatedAt: Date.now()
  };

  await chrome.storage.local.set({ graphData });
  return graphData;
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_GRAPH") {
    chrome.storage.local.get("graphData").then(result => {
      if (result.graphData) {
        sendResponse({ data: result.graphData });
      } else {
        buildGraphData().then(data => sendResponse({ data }));
      }
    });
    return true;
  }

  if (msg.type === "REFRESH_GRAPH") {
    buildGraphData().then(data => sendResponse({ data }));
    return true;
  }
});

async function pollLoop() {
  await buildGraphData();
  setInterval(buildGraphData, POLL_INTERVAL_MS);
}

pollLoop();
