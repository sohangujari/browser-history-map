# browser-history-map

Visualize your browsing history as a live force-directed graph. Sites cluster by how often you jump between them, edges reveal your distraction loops, and every node tells the story of where your attention actually goes.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![D3.js](https://img.shields.io/badge/D3.js-v7-orange)

---

## What it looks like

- **Nodes** — every domain you visited in the last 7 days. Size = visit count.
- **Edges** — drawn between sites you navigated between within 30 seconds. Thickness = how often you made that jump.
- **Clusters** — your actual mental models and distraction loops, visible at a glance.
- **Sidebar** — click any node to see connected sites and a 7-day visit bar chart.

---

## Install (no developer account needed)

> Works on any Chrome-based browser — Chrome, Edge, Brave, Arc.

**Option A — drag and drop (easiest)**

1. Download `browser-history-map.zip` from the [Releases](../../releases) page
2. Open `chrome://extensions` in your browser
3. Toggle **Developer mode** on (top right corner)
4. Drag and drop the `.zip` file anywhere onto the extensions page
5. Click the extension icon in your toolbar — the graph opens in a new tab

**Option B — load unpacked**

1. Download and unzip `browser-history-map.zip`
2. Open `chrome://extensions`
3. Toggle **Developer mode** on
4. Click **Load unpacked** → select the unzipped `browser-history-map` folder

---

## Usage

| Action | What it does |
|---|---|
| Click a node | Opens sidebar with connected sites + visit timeline |
| Click a neighbor chip | Jumps to and selects that node |
| Scroll | Zoom in / out |
| Drag a node | Pin it to a position |
| Click background | Deselects current node |
| Refresh button | Rebuilds the graph from latest history |
| Fit button | Resets zoom to show the full graph |

The graph auto-refreshes every 5 minutes in the background.

---

## Permissions

| Permission | Why |
|---|---|
| `history` | Reads your local browsing history to build the graph |
| `tabs` | Detects tab navigation to track site transitions |
| `storage` | Caches graph data locally so it loads instantly |

All data stays on your machine. Nothing is sent anywhere.

---

## How the graph is built

1. Fetches up to 5,000 history items from the last 7 days via the Chrome History API
2. Extracts domains and visit timestamps, strips internal Chrome URLs
3. Finds sequential visits where two different sites were visited within 30 seconds of each other — those become edges
4. Aggregates edge weights (how many times you made each jump)
5. Runs a D3 force simulation — charge repulsion keeps nodes apart, link force pulls connected nodes together, collision force prevents overlap
6. Node size and color intensity scale with visit count; edge thickness and opacity scale with transition frequency

---

## Stack

- **Chrome Extension Manifest V3** — service worker background, no persistent pages
- **D3.js v7** — force simulation, zoom, drag
- **Chrome History API** — local history access
- **Chrome Storage API** — local graph caching
- Vanilla JS + CSS — no build step, no framework

---

## Development

Clone the repo and load unpacked — no build step needed.

```bash
git clone https://github.com/sohangujari/browser-history-map.git
```

Then load the folder via `chrome://extensions` → **Load unpacked**.

Edit any file and click the refresh icon on the extensions page to reload.

---

## License

MIT
