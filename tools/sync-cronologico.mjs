import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import '../docs/schema.js';

const { FIELD_FARMS, isFieldSnapshot } = globalThis.CasurFieldData;
const source = 'https://montealtoc7.github.io/Negocios_de_Cana_CASUR_APP/modules/produccion/data/';
const snapshotFile = new URL('../docs/data/cronologico.json', import.meta.url);
const localSource = process.argv[2];
const tempFile = new URL(`cronologico.${process.pid}.tmp`, snapshotFile);

async function readSource(file) {
  if (localSource) return readFile(join(localSource, file));
  const response = await fetch(new URL(file, source), { cache: 'no-cache', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw Error(`Maestro · ${file} · HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function verify(bytes, file, integrity) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== integrity.files?.[file]) throw Error(`SHA-256 incorrecto en ${file}`);
  return JSON.parse(bytes);
}

const [manifestBytes, versionBytes, chronoBytes] = await Promise.all(
  ['integrity.json', 'version.json', 'cronologico.json'].map(readSource)
);
const integrity = JSON.parse(manifestBytes);
const release = verify(versionBytes, 'version.json', integrity);
const master = verify(chronoBytes, 'cronologico.json', integrity);
if (integrity.schemaVersion !== 1 || master.meta?.dataVersion !== integrity.dataVersion ||
    release.version !== integrity.dataVersion || master.meta.rows !== release.cronologicoRows ||
    master.meta.sourceSha256 !== release.sourceSha256) {
  throw Error('La generación del Maestro es inconsistente');
}

const rowFields = [
  'code', 'suerte', 'codLote', 'area', 'inventoryArea', 'participatesCurrentArea', 'participatesMilling',
  'classification', 'operationalState', 'variedad', 'surco', 'corte', 'tch', 'tchEst2627', 'tonEst2627',
  'millingEstimatedTons', 'textura', 'fBase', 'fUltCte', 'fSiembra', 'destino', 'tipoRiego',
  'numeroRiegos', 'distancia', 'renovacion', 'sourcePresence', 'tipoCultivo'
];
const farms = FIELD_FARMS.map(({ code, name, officialName }) => {
  const matches = master.producers.filter(producer => String(producer.code) === code);
  if (matches.length !== 1 || matches[0].name !== officialName) throw Error(`Identidad de finca inesperada · ${code}`);
  const farm = matches[0];
  const lots = farm.details.map(row => ({
    ...Object.fromEntries(rowFields.map(key => [key, row[key] ?? null])),
    proposedHarvest: row.plan?.date?.iso || null,
    proposedCut: row.plan?.cut || null,
    proposedAge: row.plan?.age ?? null
  }));
  return {
    code, name, officialName, area: farm.area, activeLots: farm.activeLots,
    catalogLots: farm.catalogLots, millingArea: farm.millingArea, seedArea: farm.seedArea,
    estimateTch: farm.estimateTch, lots
  };
});
const snapshot = {
  schema: 1, version: release.version, generated: master.meta.generated ?? null,
  publishedAt: master.meta.publishedAt ?? null, importedAt: master.meta.importedAt,
  estimateDate: master.meta.tchEst2627EffectiveDate ?? null, season: master.meta.estimateSeason,
  upstreamSha256: integrity.files['cronologico.json'], farms
};
if (!isFieldSnapshot(snapshot)) throw Error('La selección no cumple el contrato del Cronológico de Campo');
if (!localSource && !manifestBytes.equals(await readSource('integrity.json'))) {
  throw Error('El Maestro cambió durante la descarga. Repetí la sincronización.');
}

const previous = await readFile(snapshotFile, 'utf8').then(JSON.parse, error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (previous && Date.parse(previous.importedAt) > Date.parse(snapshot.importedAt)) {
  throw Error('La generación disponible es anterior a la copia de campo');
}
await writeFile(tempFile, JSON.stringify(snapshot) + '\n', { flag: 'wx' });
await rename(tempFile, snapshotFile);
console.log(snapshot.version, farms.map(farm => `${farm.name}: ${farm.catalogLots} catálogo / ${farm.activeLots} activas`).join(' · '));
