'use strict';

const byId = id => document.getElementById(id);
const { FIELD_FARMS, isFieldSnapshot } = globalThis.CasurFieldData;
const number = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeZone: 'UTC' });
const compareLot = new Intl.Collator('es-NI', { numeric: true });
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const dash = '—';
const n = (value, unit = '') => Number.isFinite(value) ? number.format(value) + unit : dash;
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
  ? Date.parse(value.slice(0, 10) + 'T00:00:00Z') : NaN;
const d = value => Number.isFinite(day(value)) ? date.format(day(value)) : dash;
let snapshot;
let selection = FIELD_FARMS[0].code;
let installEvent;
let storedCopy = false;
let offlineReady = false;
const farmFilters = new Map();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function metric(label, value) {
  const item = element('div');
  item.append(element('dt', '', label), element('dd', '', value));
  return item;
}

function ageMonths(row) {
  if (row.renovacion && !row.fSiembra) return null;
  const actualDates = [day(row.fUltCte), day(row.fSiembra)].filter(Number.isFinite);
  const start = actualDates.length ? Math.max(...actualDates) : day(row.fBase);
  if (!Number.isFinite(start)) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, (today - start) / 86400000 / 30.4375);
}

function ageLabel(row) {
  return row.renovacion && !row.fSiembra ? 'Renovación' : n(ageMonths(row), ' meses');
}

function farmSelected() {
  return snapshot.farms.find(farm => farm.code === selection);
}

function stateBadge(row) {
  const style = row.participatesMilling ? 'mill' : row.participatesCurrentArea ? 'seed' : 'inactive';
  const label = row.operationalState || row.classification || 'Sin dato';
  return element('span', 'badge ' + style, label);
}

function chooseFarm(code) {
  if (code === selection) return;
  farmFilters.set(selection, [byId('search').value, byId('filter').value, byId('sort').value]);
  selection = code;
  const [query, filter, sort] = farmFilters.get(code) ?? ['', 'active', 'lot'];
  byId('search').value = query;
  byId('filter').value = filter;
  byId('sort').value = sort;
  renderFarm();
}

function renderFarm() {
  const farm = farmSelected();
  for (const button of byId('farms').children) {
    button.setAttribute('aria-pressed', String(button.dataset.code === selection));
  }
  byId('farm-title').textContent = farm.name;
  byId('farm-code').textContent = 'Finca ' + farm.code;
  byId('stats').replaceChildren(
    metric('Área activa', n(farm.area, ' ha')),
    metric('Suertes activas', farm.activeLots + ' de ' + farm.catalogLots),
    metric('TCH est. Z' + snapshot.season, n(farm.estimateTch))
  );
  renderLots();
}

function matchesFilter(row, filter) {
  switch (filter) {
    case 'active': return row.participatesCurrentArea;
    case 'milling': return row.participatesMilling;
    case 'seed': return row.participatesCurrentArea && row.classification === 'Semilla';
    case 'inactive': return !row.participatesCurrentArea;
    default: return true;
  }
}

function sortLots(a, b, sort) {
  let primary = 0;
  if (sort === 'harvest') primary = (day(a.proposedHarvest) || Infinity) - (day(b.proposedHarvest) || Infinity);
  if (sort === 'lastCut') primary = (day(b.fUltCte) || 0) - (day(a.fUltCte) || 0);
  if (sort === 'age') primary = (ageMonths(b) ?? -1) - (ageMonths(a) ?? -1);
  return primary || compareLot.compare(a.suerte, b.suerte);
}

function renderLots() {
  const query = normalize(byId('search').value);
  const filter = byId('filter').value;
  const sort = byId('sort').value;
  const farm = farmSelected();
  const rows = farm.lots.filter(row => {
    const shortCode = row.suerte.replace(/^0+(?=\d)/, '');
    const terms = normalize([row.suerte, shortCode, row.codLote, row.variedad].join(' '));
    return matchesFilter(row, filter) && query.split(/\s+/).every(word => terms.includes(word));
  }).sort((a, b) => sortLots(a, b, sort));

  byId('count').textContent = rows.length + ' de ' + farm.catalogLots;
  byId('empty').hidden = rows.length > 0;
  byId('list').replaceChildren(...rows.map(row => {
    const item = element('li');
    const card = element('article', 'lot-card');
    const button = element('button', 'open-lot', 'Suerte ' + row.suerte);
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', 'Abrir suerte ' + row.suerte + ' · ' + row.codLote);
    const top = element('span', 'lot-top');
    const identity = element('span', 'identity');
    identity.append(button, element('small', '', row.codLote));
    top.append(identity, stateBadge(row));
    const variety = element('span', 'variety', [row.variedad, row.tipoRiego].filter(Boolean).join(' · ') || dash);
    const data = element('dl', 'lot-metrics');
    data.append(metric('Área', n(row.area, ' ha')), metric('Edad actual', ageLabel(row)),
      metric('Cosecha propuesta', row.participatesCurrentArea ? d(row.proposedHarvest) : dash));
    card.append(top, variety, data);
    button.addEventListener('click', () => showLot(farm, row));
    item.append(card);
    return item;
  }));
}

function showLot(farm, row) {
  byId('lot-title').textContent = 'Suerte ' + row.suerte;
  byId('lot-farm').textContent = farm.name + ' · ' + row.codLote;
  const main = element('dl', 'detail-grid');
  main.append(metric('TCH estimado Z' + snapshot.season, row.participatesMilling ? n(row.tchEst2627) : dash),
    metric('Cosecha propuesta', row.participatesCurrentArea ? d(row.proposedHarvest) : dash),
    metric('Área activa de la suerte', n(row.area, ' ha')), metric('Edad actual', ageLabel(row)));
  const other = element('dl', 'detail-list');
  const details = [
    ['Variedad', row.variedad], ['Tipo de riego', row.tipoRiego], ['N.º de riegos registrado', row.numeroRiegos],
    ['Último corte registrado', d(row.fUltCte)], ['Fecha de siembra', d(row.fSiembra)], ['N.º de cortes', row.corte],
    ['TCH anterior', n(row.tch)], ['Toneladas estimadas', row.participatesMilling ? n(row.millingEstimatedTons, ' t') : dash],
    ['Área de inventario', n(row.inventoryArea, ' ha')], ['Separación entre surcos', row.surco ? row.surco + ' m' : null],
    ['Textura', row.textura], ['Distancia', n(row.distancia, ' km')]
  ];
  if (row.participatesCurrentArea && row.proposedHarvest) {
    details.splice(4, 0, ['Edad a cosecha propuesta', n(row.proposedAge, ' meses')], ['Tipo de corte propuesto', row.proposedCut]);
  }
  other.append(...details.map(([label, value]) => metric(label, value === '' || value == null ? dash : value)));
  const contents = [stateBadge(row), main, other];
  if (row.participatesCurrentArea && row.proposedHarvest) {
    contents.push(element('p', 'detail-note', 'La fecha de cosecha es una propuesta del Maestro.'));
  }
  byId('lot-detail').replaceChildren(...contents);
  const dialog = byId('lot-dialog');
  dialog.showModal();
  dialog.scrollTop = 0;
}

function statusMessage(message = '') {
  const status = byId('connection');
  const text = message || (!navigator.onLine ? 'Sin internet · copia guardada en este teléfono' :
    storedCopy ? 'Mostrando la última copia guardada' : offlineReady ? 'Disponible sin internet' : '');
  status.textContent = text;
  status.hidden = !text;
}

async function loadData(checking = false) {
  const refresh = byId('refresh');
  refresh.disabled = true;
  try {
    const response = await fetch('./data/cronologico.json', { cache: 'no-cache', signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw Error('Datos no disponibles');
    const data = await response.json();
    if (!isFieldSnapshot(data)) throw Error('Copia no válida');
    const old = snapshot?.version;
    snapshot = data;
    storedCopy = response.headers.get('X-CASUR-Offline') === '1';
    const source = snapshot.publishedAt ? 'Corte publicado ' : 'Datos generados ';
    byId('source').textContent = source + d(snapshot.publishedAt || snapshot.generated) + ' · ' + snapshot.version;
    byId('source').title = 'Copia del Maestro · incorporada ' + d(snapshot.importedAt) + ' · Aforo efectivo ' + d(snapshot.estimateDate);
    byId('workspace').hidden = false;
    renderFarm();
    statusMessage(checking && !storedCopy && navigator.onLine && offlineReady
      ? (old === snapshot.version ? 'Ya tenés el corte disponible más reciente' : 'Corte actualizado') + ' · disponible sin internet'
      : '');
  } catch {
    if (!snapshot) byId('source').textContent = 'Cronológico pendiente de descarga';
    statusMessage(snapshot ? 'No se pudo comprobar el corte · se conserva la copia abierta' : 'No se pudo cargar el cronológico. Revisá la conexión y tocá el icono de actualizar.');
  } finally {
    refresh.disabled = false;
  }
}

for (const farm of FIELD_FARMS) {
  const button = element('button', '', farm.name);
  button.type = 'button';
  button.dataset.code = farm.code;
  button.addEventListener('click', () => chooseFarm(farm.code));
  byId('farms').append(button);
}
byId('refresh').addEventListener('click', () => void loadData(true));
byId('search').addEventListener('input', renderLots);
byId('filter').addEventListener('change', renderLots);
byId('sort').addEventListener('change', renderLots);
byId('reset').addEventListener('click', () => {
  byId('search').value = '';
  byId('filter').value = 'all';
  renderLots();
  byId('search').focus();
});
window.addEventListener('offline', () => statusMessage(snapshot ? '' : 'Sin internet · falta la descarga inicial'));
window.addEventListener('online', () => void loadData());

const installButton = byId('install');
function updateInstallButton() {
  installButton.hidden = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installEvent = event;
});
window.addEventListener('appinstalled', () => { installButton.hidden = true; });
installButton.addEventListener('click', async () => {
  if (!installEvent) {
    byId('install-dialog').showModal();
    return;
  }
  const event = installEvent;
  installEvent = null;
  await event.prompt();
});
updateInstallButton();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    offlineReady = true;
    if (snapshot) statusMessage();
  }).catch(() => {});
}
void loadData();
