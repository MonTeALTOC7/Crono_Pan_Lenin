'use strict';

(() => {
  const FIELD_FARMS = Object.freeze([
    Object.freeze({ code: '993', name: 'Pansaco', officialName: 'Pansaco' }),
    Object.freeze({ code: '25', name: 'Claudio Reyes', officialName: 'Claudio Alberto Reyes Ruiz' })
  ]);

  function isFieldSnapshot(data) {
    if (data?.schema !== 1 || typeof data.version !== 'string' || !data.version ||
        !Number.isFinite(Date.parse(data.importedAt)) || !Array.isArray(data.farms) ||
        data.farms.length !== FIELD_FARMS.length) return false;

    return FIELD_FARMS.every(({ code, officialName }, index) => {
      const farm = data.farms[index];
      if (farm?.code !== code || farm.officialName !== officialName ||
          !Number.isFinite(farm.area) || !Array.isArray(farm.lots) || !farm.lots.length ||
          farm.lots.length !== farm.catalogLots) return false;
      const keys = new Set();
      let active = 0;
      for (const row of farm.lots) {
        if (row?.code !== code || typeof row.suerte !== 'string' || !row.suerte ||
            row.codLote !== code + row.suerte || keys.has(row.codLote) ||
            !Number.isFinite(row.area) || row.area < 0 ||
            typeof row.participatesCurrentArea !== 'boolean') return false;
        keys.add(row.codLote);
        if (row.participatesCurrentArea) active += 1;
      }
      return active === farm.activeLots;
    });
  }

  globalThis.CasurFieldData = Object.freeze({ FIELD_FARMS, isFieldSnapshot });
})();
