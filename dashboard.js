const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let simulation = null;
let currentData = null;
let selectedNode = null;
let zoom = null;
let svg = null;
let container = null;

const colorScale = d3.scaleSequential()
  .domain([0, 1])
  .interpolator(t => d3.interpolateRgb("#378ADD", "#7F77DD")(t));

function getNodeRadius(visits, maxVisits) {
  return 5 + Math.sqrt(visits / maxVisits) * 22;
}

function getEdgeWidth(weight, maxWeight) {
  return 1 + (weight / maxWeight) * 6;
}

function getEdgeOpacity(weight, maxWeight) {
  return 0.08 + (weight / maxWeight) * 0.55;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function initSVG() {
  const wrap = document.getElementById('graph-wrap');
  svg = d3.select('#graph-svg');
  svg.selectAll('*').remove();

  svg.append('defs').append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -4 8 8')
    .attr('refX', 8)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', 'rgba(255,255,255,0.15)');

  container = svg.append('g').attr('class', 'container');

  zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', e => container.attr('transform', e.transform));

  svg.call(zoom);

  document.getElementById('btn-zoom-in').onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
  document.getElementById('btn-zoom-out').onclick = () => svg.transition().call(zoom.scaleBy, 0.77);
  document.getElementById('btn-zoom-fit').onclick = fitGraph;
}

function fitGraph() {
  if (!currentData || !currentData.nodes.length) return;
  const wrap = document.getElementById('graph-wrap');
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const bounds = container.node().getBBox();
  if (!bounds.width || !bounds.height) return;
  const scale = Math.min(0.85, Math.min(w / bounds.width, h / bounds.height));
  const tx = w / 2 - scale * (bounds.x + bounds.width / 2);
  const ty = h / 2 - scale * (bounds.y + bounds.height / 2);
  svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

function renderGraph(data) {
  currentData = data;
  const wrap = document.getElementById('graph-wrap');
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;

  const nodes = data.nodes.map(d => ({ ...d }));
  const edges = data.edges.map(d => ({ ...d }));

  const nodeById = {};
  nodes.forEach(n => nodeById[n.id] = n);

  const validEdges = edges.filter(e => nodeById[e.source] && nodeById[e.target]);

  const maxVisits = Math.max(...nodes.map(n => n.visits), 1);
  const maxWeight = Math.max(...validEdges.map(e => e.weight), 1);

  if (simulation) simulation.stop();

  container.selectAll('*').remove();

  const linkG = container.append('g').attr('class', 'links');
  const nodeG = container.append('g').attr('class', 'nodes');

  const link = linkG.selectAll('line')
    .data(validEdges)
    .enter().append('line')
    .attr('class', 'link')
    .attr('stroke-width', d => getEdgeWidth(d.weight, maxWeight))
    .attr('stroke-opacity', d => getEdgeOpacity(d.weight, maxWeight));

  const node = nodeG.selectAll('g')
    .data(nodes)
    .enter().append('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', dragStart)
      .on('drag', dragged)
      .on('end', dragEnd)
    )
    .on('click', (event, d) => {
      event.stopPropagation();
      selectNode(d, nodes, validEdges, maxVisits);
    });

  node.append('circle')
    .attr('r', d => getNodeRadius(d.visits, maxVisits))
    .attr('fill', d => colorScale(d.visits / maxVisits))
    .attr('fill-opacity', 0.85);

  node.append('text')
    .attr('class', 'node-label')
    .attr('dy', d => getNodeRadius(d.visits, maxVisits) + 12)
    .attr('text-anchor', 'middle')
    .text(d => d.id.length > 18 ? d.id.slice(0, 16) + '…' : d.id);

  svg.on('click', () => {
    if (selectedNode) {
      selectedNode = null;
      nodeG.selectAll('g').classed('selected', false);
      closeSidebar();
    }
  });

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(validEdges)
      .id(d => d.id)
      .distance(d => 80 + 60 * (1 - d.weight / maxWeight))
      .strength(d => 0.3 + 0.4 * (d.weight / maxWeight))
    )
    .force('charge', d3.forceManyBody().strength(d => -250 - d.visits * 2))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => getNodeRadius(d.visits, maxVisits) + 10))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    })
    .on('end', fitGraph);

  updateStats(data);
}

function dragStart(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnd(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

function selectNode(d, nodes, edges, maxVisits) {
  selectedNode = d;
  d3.selectAll('.node').classed('selected', n => n.id === d.id);

  const connected = edges
    .filter(e => e.source.id === d.id || e.target.id === d.id)
    .map(e => ({
      domain: e.source.id === d.id ? e.target.id : e.source.id,
      weight: e.weight
    }))
    .sort((a, b) => b.weight - a.weight);

  document.getElementById('sidebar-domain').textContent = d.id;
  document.getElementById('ss-visits').textContent = d.visits.toLocaleString();
  document.getElementById('ss-connections').textContent = connected.length;

  const neighborsEl = document.getElementById('sidebar-neighbors');
  neighborsEl.innerHTML = connected.slice(0, 12).map(c =>
    `<button class="neighbor-chip" onclick="jumpToNode('${c.domain}')">${c.domain} <span style="color:var(--text3);margin-left:4px;">×${c.weight}</span></button>`
  ).join('');

  renderTimeline(d.times);
  openSidebar();
}

function renderTimeline(times) {
  const byDay = {};
  times.forEach(t => {
    const day = new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    byDay[day] = (byDay[day] || 0) + 1;
  });

  const entries = Object.entries(byDay).sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 7);
  const maxCount = Math.max(...entries.map(e => e[1]), 1);

  const el = document.getElementById('sidebar-timeline');
  el.innerHTML = entries.map(([day, count]) => `
    <div class="tl-day">${day}</div>
    <div class="tl-bar-wrap">
      <div class="tl-bar-bg"><div class="tl-bar-fill" style="width:${Math.round(count/maxCount*100)}%"></div></div>
      <div class="tl-count">${count}</div>
    </div>
  `).join('');
}

function jumpToNode(domain) {
  if (!currentData) return;
  const node = currentData.nodes.find(n => n.id === domain);
  if (!node) return;
  const maxVisits = Math.max(...currentData.nodes.map(n => n.visits), 1);
  const validEdges = currentData.edges.filter(e => {
    const nodeById = {};
    currentData.nodes.forEach(n => nodeById[n.id] = n);
    return nodeById[e.source] && nodeById[e.target];
  });
  selectNode(node, currentData.nodes, validEdges, maxVisits);

  if (node.x && node.y) {
    const wrap = document.getElementById('graph-wrap');
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    svg.transition().duration(400).call(
      zoom.transform,
      d3.zoomIdentity.translate(W/2 - node.x, H/2 - node.y).scale(1.2)
    );
  }
}

function openSidebar() {
  document.getElementById('sidebar').classList.remove('hidden');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.add('hidden');
}

function updateStats(data) {
  document.getElementById('stat-nodes').textContent = data.nodes.length.toLocaleString();
  document.getElementById('stat-edges').textContent = data.edges.length.toLocaleString();
  const totalVisits = data.nodes.reduce((s, n) => s + n.visits, 0);
  document.getElementById('stat-visits').textContent = totalVisits.toLocaleString();
  document.getElementById('updated-label').textContent = 'Updated ' + timeAgo(data.updatedAt);
}

function showLoading(show) {
  const el = document.getElementById('loading-overlay');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

async function loadGraph(forceRefresh = false) {
  showLoading(true);
  try {
    const type = forceRefresh ? 'REFRESH_GRAPH' : 'GET_GRAPH';
    const res = await chrome.runtime.sendMessage({ type });
    if (res && res.data) {
      renderGraph(res.data);
    }
  } catch (err) {
    document.getElementById('loading-text').textContent = 'Failed to load history. Try refreshing.';
    console.error(err);
    return;
  }
  showLoading(false);
}

document.getElementById('btn-refresh').onclick = () => loadGraph(true);
document.getElementById('sidebar-close').onclick = () => {
  selectedNode = null;
  d3.selectAll('.node').classed('selected', false);
  closeSidebar();
};

window.jumpToNode = jumpToNode;

initSVG();
loadGraph();

setInterval(() => loadGraph(true), REFRESH_INTERVAL_MS);

setInterval(() => {
  if (currentData) {
    document.getElementById('updated-label').textContent = 'Updated ' + timeAgo(currentData.updatedAt);
  }
}, 30000);
