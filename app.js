// ── EV PLUGPOINT ──

// ── ICONS ──
const statusIcon = { available: '⚡', busy: '🔄', offline: '⛔' };

const typeIcon = (s) => ({
  'Mal & Pusat Perbelanjaan': '🏬',
  'Fasilitas Kesehatan': '🏥',
  'SPBU': '⛽',
  'Destinasi Wisata': '🏖',
  'Hotel & Penginapan': '🏨',
  'Kampus & Pendidikan': '🎓',
  'Bandara': '✈️',
  'Rest Area Tol': '🛣',
  'Perkantoran': '🏢'
}[s] || '⚡');

// ── STATE ──
let filtered = [...stations];
let activeFilter = 'all';
let selectedId = null;
let map, markers = {}, tileLayers = {}, currentLayer = 'street';

// ── INIT MAP ──
function initMap() {
  map = L.map('map-container', { center: [-7.87, 110.35], zoom: 11, zoomControl: false });

  tileLayers.street    = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' });
  tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' });
  tileLayers.dark      = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CartoDB' });

  tileLayers.street.addTo(map);
  placeMarkers();
  updateStats();
  renderList();
}

// ── CUSTOM MARKER ──
function makeIcon(s) {
  const colors = { available: '#00C896', busy: '#FF8C42', offline: '#FF4757' };
  const c = colors[s] || colors.available;
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${c}22;border:3px solid ${c};display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);">${statusIcon[s]}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20]
  });
}

function placeMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  stations.forEach(s => {
    const m = L.marker([s.lat, s.lng], { icon: makeIcon(s.status) }).addTo(map);
    m.on('click', () => selectStation(s.id));
    markers[s.id] = m;
  });
}

// ── SELECT STATION ──
function selectStation(id) {
  selectedId = id;
  const s = stations.find(x => x.id === id);
  if (!s) return;
  map.flyTo([s.lat, s.lng], 15, { duration: 1 });
  showDetail(s);
  document.querySelectorAll('.station-item').forEach(el => {
    el.classList.toggle('selected', +el.dataset.id === id);
  });
}

function showDetail(s) {
  const statusLabel = { available: '✅ Tersedia', busy: '🔄 Sedang penuh', offline: '⛔ Offline' }[s.status];
  const connHTML = s.connectors.map(c => `
    <div class="dp-connector">
      <div class="dp-conn-type">${c.type}</div>
      <div class="dp-conn-power">${c.power}</div>
      <div class="dp-conn-unit">kW</div>
      <div class="dp-conn-avail ${c.avail > 0 ? 'ok' : 'no'}">${c.avail > 0 ? `${c.avail}/${c.total} tersedia` : 'Tidak tersedia'}</div>
    </div>`).join('');

  document.getElementById('dp-content').innerHTML = `
    <div class="dp-type">${typeIcon(s.type)} ${s.type}</div>
    <div class="dp-name">${s.name}</div>
    <div class="dp-addr">📍 ${s.loc}</div>
    <div class="dp-status-bar">
      <div class="dp-status-pill ${s.status}">${statusLabel}</div>
      <div class="dp-last-update">Update: ${s.lastUpdate}</div>
    </div>
    <div class="dp-connectors">${connHTML}</div>
    <div class="dp-meta-grid">
      <div class="dp-meta-item"><div class="dp-meta-lbl">💰 TARIF</div><div class="dp-meta-val">Rp ${s.price.toLocaleString('id')}/kWh</div></div>
      <div class="dp-meta-item"><div class="dp-meta-lbl">🕐 JAM OPERASI</div><div class="dp-meta-val">${s.hours}</div></div>
      <div class="dp-meta-item"><div class="dp-meta-lbl">🏢 OPERATOR</div><div class="dp-meta-val">${s.operator}</div></div>
      <div class="dp-meta-item"><div class="dp-meta-lbl">⭐ RATING</div><div class="dp-meta-val">${s.rating}/5.0</div></div>
    </div>
    <div class="dp-actions">
      <button class="dp-btn dp-btn-primary" onclick="openNav(${s.lat},${s.lng})">🗺 Navigasi</button>
      <button class="dp-btn dp-btn-secondary" onclick="showToast('Info stasiun disalin!')">📋 Salin Info</button>
    </div>`;

  document.getElementById('detail-panel').classList.add('show');
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('show');
  selectedId = null;
  document.querySelectorAll('.station-item').forEach(el => el.classList.remove('selected'));
}

function openNav(lat, lng) {
  showToast('Membuka Google Maps…');
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
}

// ── FILTER & SEARCH ──
function setFilter(f, el) {
  activeFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filterStations();
}

function filterStations() {
  const q   = document.getElementById('search-input').value.toLowerCase();
  const kab = document.getElementById('kab-select').value;
  filtered  = stations.filter(s => {
    const matchFilter = activeFilter === 'all' || s.status === activeFilter;
    const matchQ      = !q || (s.name.toLowerCase().includes(q) || s.loc.toLowerCase().includes(q) || s.kabupaten.toLowerCase().includes(q));
    const matchKab    = !kab || s.kabupaten === kab;
    return matchFilter && matchQ && matchKab;
  });
  renderList();
  updateMarkerVisibility();
}

function updateMarkerVisibility() {
  const visIds = new Set(filtered.map(s => s.id));
  stations.forEach(s => {
    if (markers[s.id]) {
      if (visIds.has(s.id))  { if (!map.hasLayer(markers[s.id])) map.addLayer(markers[s.id]); }
      else                   { if (map.hasLayer(markers[s.id]))  map.removeLayer(markers[s.id]); }
    }
  });
}

// ── RENDER LIST ──
function renderList() {
  const container = document.getElementById('station-list');
  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-results">🔍 Tidak ada stasiun ditemukan</div>';
    return;
  }
  container.innerHTML = filtered.map(s => `
    <div class="station-item ${s.id === selectedId ? 'selected' : ''}" data-id="${s.id}" onclick="selectStation(${s.id})">
      <div class="si-icon ${s.status}">${statusIcon[s.status]}</div>
      <div class="si-body">
        <div class="si-name">${s.name}</div>
        <div class="si-loc">📍 ${s.kabupaten}</div>
        <div class="si-meta">
          <div class="si-badge ${s.status}">${{ available: '● Tersedia', busy: '● penuh', offline: '● Offline' }[s.status]}</div>
          <div class="si-power">⚡ ${Math.max(...s.connectors.map(c => c.power))} kW</div>
          <div class="si-connector">${s.connectors.map(c => c.type).join(' · ')}</div>
        </div>
      </div>
    </div>`).join('');
}

// ── STATS ──
function updateStats() {
  const avail   = stations.filter(s => s.status === 'available').length;
  const busy    = stations.filter(s => s.status === 'busy').length;
  const offline = stations.filter(s => s.status === 'offline').length;
  const total   = stations.length;

  document.getElementById('hstat-total').textContent   = total;
  document.getElementById('hstat-avail').textContent   = avail;
  document.getElementById('count-avail').textContent   = avail;
  document.getElementById('count-busy').textContent    = busy;
  document.getElementById('count-offline').textContent = offline;
  document.getElementById('prog-avail').style.width    = `${avail / total * 100}%`;
  document.getElementById('prog-busy').style.width     = `${busy / total * 100}%`;
  document.getElementById('prog-offline').style.width  = `${offline / total * 100}%`;
}

// ── LAYER ──
function setLayer(name, el) {
  Object.values(tileLayers).forEach(l => map.removeLayer(l));
  tileLayers[name].addTo(map);
  currentLayer = name;
  document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ── FIT BOUNDS ──
function fitBounds() {
  const latLngs = stations.map(s => [s.lat, s.lng]);
  map.fitBounds(latLngs, { padding: [60, 60] });
}

// ── TOGGLE SIDEBAR ──
function toggleSidebar() {
  const sb     = document.getElementById('sidebar');
  const legend = document.getElementById('map-legend');
  const dp     = document.getElementById('detail-panel');
  sb.classList.toggle('collapsed');
  const offset = sb.classList.contains('collapsed') ? '16px' : '356px';
  legend.style.left = offset;
  dp.style.left     = offset;
}

// ── REFRESH ──
function refreshData() {
  showToast('⚡ Data diperbarui!');
  const statuses = ['available', 'available', 'available', 'busy', 'offline'];
  stations.forEach(s => {
    if (Math.random() < 0.2) s.status = statuses[Math.floor(Math.random() * statuses.length)];
    s.lastUpdate = 'Baru saja';
  });
  placeMarkers();
  updateStats();
  renderList();
  if (selectedId) {
    const s = stations.find(x => x.id === selectedId);
    if (s) showDetail(s);
  }
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── START ──
document.addEventListener('DOMContentLoaded', initMap);
