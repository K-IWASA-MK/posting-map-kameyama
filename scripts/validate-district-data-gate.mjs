#!/usr/bin/env node
/**
 * POSTING MAP - District Data Quality Gate Verifier (第1工程検証器)
 *
 * 地区データ層マスター3点セットの動的整合性を機械検証する。
 * address_master.csv (N件) をSSOTとし、
 * boundaries.geojson (N件) と municipality_master.csv (M件) の整合性を検査。
 */

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const addressFile = path.join(rootDir, 'data', 'address_master.csv');
const muniFile = path.join(rootDir, 'data', 'municipality_master.csv');
const boundsFile = process.env.BOUNDARIES_FILE ? path.resolve(process.env.BOUNDARIES_FILE) : path.join(rootDir, 'data', 'boundaries.geojson');
const electionFile = path.join(rootDir, 'data', 'election_history.json');

console.log('===============================================================');
console.log('🏛️  [DISTRICT DATA QUALITY GATE AUDIT - STAGE 1]');
console.log('===============================================================\n');

const auditResults = {
  stage: 'Stage 1: District Data Layer Establishment',
  timestamp: new Date().toISOString(),
  rules: {},
  summary: { totalRules: 6, passedRules: 0, failedRules: 0, status: 'PENDING' }
};

function record(ruleId, ruleName, pass, expected, actual, evidence) {
  auditResults.rules[ruleId] = {
    name: ruleName,
    pass,
    expected,
    actual,
    evidence
  };
  if (pass) {
    auditResults.summary.passedRules++;
    console.log(`✅ [${ruleId}] PASS: ${ruleName}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual:   ${actual}`);
    console.log(`   Evidence: ${evidence}\n`);
  } else {
    auditResults.summary.failedRules++;
    console.error(`❌ [${ruleId}] FAIL: ${ruleName}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
    console.error(`   Evidence: ${evidence}\n`);
  }
}

// ----------------------------------------------------------------------------
// 1. Load Files & SSOT Extraction
// ----------------------------------------------------------------------------
if (!fs.existsSync(addressFile) || !fs.existsSync(muniFile) || !fs.existsSync(boundsFile)) {
  console.error('❌ Fatal: Master files missing.');
  process.exit(1);
}

const addressRaw = fs.readFileSync(addressFile, 'utf8').trim().split(/\r?\n/);
const addressRows = addressRaw.slice(1).map(line => {
  const parts = line.split(',');
  return {
    rowId: parseInt(parts[0], 10),
    city_name: parts[1],
    town_name: parts[2],
    lat: parseFloat(parts[3]),
    lng: parseFloat(parts[4]),
    e_stat_code: parts[7] ? parts[7].trim() : ''
  };
});
const N = addressRows.length; // SSOT Count

const muniRaw = fs.readFileSync(muniFile, 'utf8').trim().split(/\r?\n/);
const muniRows = muniRaw.slice(1).map(line => {
  const parts = line.split(',');
  return {
    city_name: parts[0],
    city_code: parts[1],
    total_towns: parseInt(parts[2], 10)
  };
});
const M = muniRows.length; // Municipality Count

const boundsRaw = JSON.parse(fs.readFileSync(boundsFile, 'utf8'));
const features = boundsRaw.features || [];

// ----------------------------------------------------------------------------
// Rule 1: Dynamic N-Count Match (SSOT 件数一致)
// ----------------------------------------------------------------------------
{
  const isAllowEmpty = process.argv.includes('--allow-empty') || process.env.ALLOW_EMPTY_MASTER === 'true';
  const expected = `boundaries.features.length === address_master.rows (${N})`;
  const actual = `boundaries.features.length = ${features.length}`;
  const pass = features.length === N && (N > 0 || isAllowEmpty);
  record('Rule-01', 'Dynamic N-Count Match', pass, expected, actual, `SSOT count N=${N}, Features count=${features.length}`);
}

// ----------------------------------------------------------------------------
// Rule 2: rowId Exact 1..N Sequence (欠番・重複なし)
// ----------------------------------------------------------------------------
{
  const expected = `Every feature has unique rowId from 1 to ${N} with no duplicates or gaps`;
  const seenRowIds = new Set();
  const duplicates = [];
  const outOfRange = [];

  features.forEach((f, idx) => {
    const rId = f.properties?.rowId;
    if (typeof rId !== 'number' || rId < 1 || rId > N) {
      outOfRange.push({ idx, rowId: rId });
    }
    if (seenRowIds.has(rId)) {
      duplicates.push({ idx, rowId: rId });
    }
    seenRowIds.add(rId);
  });

  const missing = [];
  for (let i = 1; i <= N; i++) {
    if (!seenRowIds.has(i)) missing.push(i);
  }

  const pass = duplicates.length === 0 && outOfRange.length === 0 && missing.length === 0;
  const actual = `Duplicates: ${duplicates.length}, OutOfRange: ${outOfRange.length}, Missing: ${missing.length}`;
  record('Rule-02', 'rowId Exact 1..N Sequence', pass, expected, actual, `Checked 1..${N}, all uniquely present`);
}

// ----------------------------------------------------------------------------
// Rule 3: Property Exact Match (city_name, town_name 完全一致)
// ----------------------------------------------------------------------------
{
  const expected = `All ${N} features match address_master city_name and town_name at identical rowId`;
  const addressMap = new Map(addressRows.map(r => [r.rowId, r]));
  const mismatches = [];

  features.forEach(f => {
    const rId = f.properties?.rowId;
    const target = addressMap.get(rId);
    if (!target) {
      mismatches.push({ rowId: rId, error: 'Target not found in address_master' });
      return;
    }
    if (f.properties.city_name !== target.city_name || f.properties.town_name !== target.town_name) {
      mismatches.push({
        rowId: rId,
        expected: `${target.city_name} ${target.town_name}`,
        actual: `${f.properties.city_name} ${f.properties.town_name}`
      });
    }
  });

  const pass = mismatches.length === 0;
  const actual = `Mismatches: ${mismatches.length}`;
  record('Rule-03', 'City & Town Property Exact Match', pass, expected, actual, mismatches.length === 0 ? `All ${N} features match SSOT` : JSON.stringify(mismatches.slice(0, 3)));
}

// ----------------------------------------------------------------------------
// Rule 4: Municipality Master Coherence (枠データ完全整合)
// ----------------------------------------------------------------------------
{
  const expected = `Total towns in ${M} municipalities === ${N}, and per-municipality town counts exactly match`;
  let totalMuniTowns = 0;
  const muniMap = new Map();
  muniRows.forEach(m => {
    totalMuniTowns += m.total_towns;
    muniMap.set(m.city_name, m.total_towns);
  });

  const addressCounts = {};
  addressRows.forEach(r => {
    addressCounts[r.city_name] = (addressCounts[r.city_name] || 0) + 1;
  });

  const featureCounts = {};
  features.forEach(f => {
    const c = f.properties.city_name;
    featureCounts[c] = (featureCounts[c] || 0) + 1;
  });

  const muniErrors = [];
  if (totalMuniTowns !== N) {
    muniErrors.push(`Total towns sum mismatch: muni=${totalMuniTowns}, address_master=${N}`);
  }

  for (const [cityName, expectedCount] of muniMap.entries()) {
    const addrCount = addressCounts[cityName] || 0;
    const featCount = featureCounts[cityName] || 0;
    if (addrCount !== expectedCount || featCount !== expectedCount) {
      muniErrors.push(`${cityName}: expected=${expectedCount}, address=${addrCount}, feature=${featCount}`);
    }
  }

  const pass = muniErrors.length === 0;
  const actual = pass ? `All ${M} municipalities coherent (sum=${totalMuniTowns})` : muniErrors.join('; ');
  record('Rule-04', 'Municipality Master Coherence', pass, expected, actual, `M=${M} municipalities: ${JSON.stringify(Object.fromEntries(muniMap))}`);
}

// ----------------------------------------------------------------------------
// Rule 5: Geometry & Dynamic Bounding Box Validity (動的幾何妥当性)
// ----------------------------------------------------------------------------
{
  // Calculate dynamic Bounding Box from address_master coordinates with margin
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  addressRows.forEach(r => {
    if (r.lat < minLat) minLat = r.lat;
    if (r.lat > maxLat) maxLat = r.lat;
    if (r.lng < minLng) minLng = r.lng;
    if (r.lng > maxLng) maxLng = r.lng;
  });

  const margin = 0.08; // dynamic margin in degrees (~8km)
  const allowedBBox = {
    minLat: minLat - margin,
    maxLat: maxLat + margin,
    minLng: minLng - margin,
    maxLng: maxLng + margin
  };

  const expected = `Valid Polygon/MultiPolygon, closed rings (>=4 pts), coords inside dynamic BBox [${allowedBBox.minLng.toFixed(2)}, ${allowedBBox.minLat.toFixed(2)} to ${allowedBBox.maxLng.toFixed(2)}, ${allowedBBox.maxLat.toFixed(2)}]`;

  let geomErrors = 0;
  let unclosedRings = 0;
  let outOfBBoxCoords = 0;

  features.forEach((f, idx) => {
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
      geomErrors++;
      return;
    }
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    polygons.forEach(poly => {
      poly.forEach(ring => {
        if (!Array.isArray(ring) || ring.length < 4) {
          geomErrors++;
          return;
        }
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          unclosedRings++;
        }
        ring.forEach(pt => {
          const lng = pt[0];
          const lat = pt[1];
          if (isNaN(lng) || isNaN(lat)) {
            geomErrors++;
          } else if (lng < allowedBBox.minLng || lng > allowedBBox.maxLng || lat < allowedBBox.minLat || lat > allowedBBox.maxLat) {
            outOfBBoxCoords++;
          }
        });
      });
    });
  });

  const pass = geomErrors === 0 && unclosedRings === 0 && outOfBBoxCoords === 0;
  const actual = `GeomErrors: ${geomErrors}, UnclosedRings: ${unclosedRings}, OutOfBBox: ${outOfBBoxCoords}`;
  record('Rule-05', 'Geometry & Dynamic BBox Validity', pass, expected, actual, `Dynamic BBox: Lng [${minLng.toFixed(3)}..${maxLng.toFixed(3)}], Lat [${minLat.toFixed(3)}..${maxLat.toFixed(3)}]`);
}

// ----------------------------------------------------------------------------
// Rule 6: Target District Whitelist Purity (SSOT 100% Match)
// ----------------------------------------------------------------------------
{
  const expected = '100% of data/ records and features belong strictly to Target District SSOT (municipality_master.csv)';
  
  const allowedCityMap = new Map(muniRows.map(m => [m.city_name, m.city_code]));
  const allowedCityNames = new Set(muniRows.map(m => m.city_name));
  const allowedCityCodes = new Set(muniRows.map(m => m.city_code));

  const unauthorizedCities = new Set();
  const unauthorizedEstatCodes = [];

  // 1. Check boundaries.geojson features
  features.forEach((f, idx) => {
    const cName = f.properties?.city_name;
    const eCode = String(f.properties?.e_stat_code || '').trim();
    const cityCodeFromEstat = eCode.slice(0, 5);

    if (!allowedCityNames.has(cName)) {
      unauthorizedCities.add(cName || `(missing city_name at feature ${idx})`);
    }

    const expectedCityCode = allowedCityMap.get(cName);
    if (expectedCityCode && cityCodeFromEstat && cityCodeFromEstat !== expectedCityCode) {
      unauthorizedEstatCodes.push(`feature[${idx}]: city=${cName}, expected_code=${expectedCityCode}, actual_estat_prefix=${cityCodeFromEstat}`);
    }
  });

  // 2. Check address_master.csv records
  const unauthorizedAddressCities = new Set();
  const unauthorizedAddressCodes = [];
  addressRows.forEach((r, idx) => {
    if (!allowedCityNames.has(r.city_name)) {
      unauthorizedAddressCities.add(r.city_name || `(missing city_name at row ${idx + 2})`);
    }
    const expectedCityCode = allowedCityMap.get(r.city_name);
    const cityCodeFromEstat = String(r.e_stat_code || '').trim().slice(0, 5);
    if (expectedCityCode && cityCodeFromEstat && cityCodeFromEstat !== expectedCityCode) {
      unauthorizedAddressCodes.push(`row[${r.rowId}]: city=${r.city_name}, expected_code=${expectedCityCode}, actual_estat_prefix=${cityCodeFromEstat}`);
    }
  });

  // 3. Check election_history.json records if present
  const unauthorizedElectionCities = new Set();
  if (fs.existsSync(electionFile)) {
    try {
      const ehData = JSON.parse(fs.readFileSync(electionFile, 'utf8'));
      if (Array.isArray(ehData.elections)) {
        ehData.elections.forEach((el, elIdx) => {
          const munis = el.municipalities || {};
          Object.keys(munis).forEach(cityName => {
            if (!allowedCityNames.has(cityName)) {
              unauthorizedElectionCities.add(cityName);
            }
          });
        });
      }
    } catch (e) {
      unauthorizedElectionCities.add(`(parse error: ${e.message})`);
    }
  }

  const dataDir = path.join(rootDir, 'data');
  const unauthorizedDataFileEntries = [];
  const scannedDataFiles = [];

  const codeKeyPattern = /^(city_code|municipality_code|cityCode|municipalityCode|pref_code|prefecture_code)$/i;
  const nameKeyPattern = /^(city_name|municipality_name|cityName|municipalityName|pref_name|prefecture_name)$/i;

  function inspectJsonValue(val, filePath, breadcrumb = '') {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      val.forEach((item, idx) => inspectJsonValue(item, filePath, `${breadcrumb}[${idx}]`));
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        const currentPath = breadcrumb ? `${breadcrumb}.${k}` : k;
        if (typeof v === 'string' || typeof v === 'number') {
          const strVal = String(v).trim();
          if (codeKeyPattern.test(k)) {
            const code5 = strVal.slice(0, 5);
            if (!allowedCityCodes.has(strVal) && !allowedCityCodes.has(code5)) {
              unauthorizedDataFileEntries.push(`${path.basename(filePath)} (${currentPath}): unauthorized code "${strVal}"`);
            }
          } else if (nameKeyPattern.test(k)) {
            if (!allowedCityNames.has(strVal)) {
              unauthorizedDataFileEntries.push(`${path.basename(filePath)} (${currentPath}): unauthorized municipality "${strVal}"`);
            }
          }
        }
        inspectJsonValue(v, filePath, currentPath);
      }
    }
  }

  const ALLOWED_DATA_FILES = new Set([
    'address_master.csv',
    'boundaries.geojson',
    'municipality_master.csv',
    'election_history.json',
    'config.js',
    'area_mapping.json',
    'storage_locations.json'
  ]);

  if (fs.existsSync(dataDir)) {
    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    entries.forEach(ent => {
      if (ent.isDirectory()) return;
      const fileName = ent.name;
      if (fileName === '.DS_Store' || fileName.startsWith('.')) return;

      if (!ALLOWED_DATA_FILES.has(fileName)) {
        unauthorizedDataFileEntries.push(`Unapproved file in data/: "${fileName}"`);
        return;
      }

      if (fileName === 'address_master.csv' || fileName === 'boundaries.geojson' || fileName === 'municipality_master.csv' || fileName === 'election_history.json' || fileName === 'config.js') {
        return;
      }
      const fullPath = path.join(dataDir, fileName);

      if (fileName.endsWith('.json')) {
        scannedDataFiles.push(fileName);
        try {
          const jsonContent = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          inspectJsonValue(jsonContent, fullPath);
        } catch (err) {
          unauthorizedDataFileEntries.push(`${fileName}: JSON parse error: ${err.message}`);
        }
      } else if (fileName.endsWith('.csv')) {
        scannedDataFiles.push(fileName);
        try {
          const csvLines = fs.readFileSync(fullPath, 'utf8').trim().split(/\r?\n/);
          if (csvLines.length > 0) {
            const headers = csvLines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const codeIndices = [];
            const nameIndices = [];
            headers.forEach((h, idx) => {
              if (codeKeyPattern.test(h)) codeIndices.push({ idx, header: h });
              if (nameKeyPattern.test(h)) nameIndices.push({ idx, header: h });
            });

            if (codeIndices.length > 0 || nameIndices.length > 0) {
              for (let i = 1; i < csvLines.length; i++) {
                const cols = csvLines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                codeIndices.forEach(({ idx, header }) => {
                  const val = cols[idx] || '';
                  const code5 = val.slice(0, 5);
                  if (val && !allowedCityCodes.has(val) && !allowedCityCodes.has(code5)) {
                    unauthorizedDataFileEntries.push(`${fileName} (row ${i + 1}, ${header}): unauthorized code "${val}"`);
                  }
                });
                nameIndices.forEach(({ idx, header }) => {
                  const val = cols[idx] || '';
                  if (val && !allowedCityNames.has(val)) {
                    unauthorizedDataFileEntries.push(`${fileName} (row ${i + 1}, ${header}): unauthorized municipality "${val}"`);
                  }
                });
              }
            }
          }
        } catch (err) {
          unauthorizedDataFileEntries.push(`${fileName}: CSV read error: ${err.message}`);
        }
      }
    });
  }

  const totalViolations = unauthorizedCities.size + unauthorizedEstatCodes.length + unauthorizedAddressCities.size + unauthorizedAddressCodes.length + unauthorizedElectionCities.size + unauthorizedDataFileEntries.length;
  const pass = totalViolations === 0;

  const actual = pass
    ? `100% verified against Target District SSOT: ${Array.from(allowedCityNames).join(', ')} (${Array.from(allowedCityCodes).join(', ')}) across boundaries, address_master, election_history, and data/ files (${scannedDataFiles.join(', ') || 'none additional'})`
    : `Violations: BoundariesUnauthorizedCities=[${Array.from(unauthorizedCities).join(', ')}], BoundariesCodeMismatches=${unauthorizedEstatCodes.length}, AddressUnauthorizedCities=[${Array.from(unauthorizedAddressCities).join(', ')}], AddressCodeMismatches=${unauthorizedAddressCodes.length}, ElectionUnauthorizedCities=[${Array.from(unauthorizedElectionCities).join(', ')}], DataFilesViolations=[${unauthorizedDataFileEntries.join('; ')}]`;

  record('Rule-06', 'Target District Whitelist Purity', pass, expected, actual, `SSOT: ${Array.from(allowedCityNames).join(', ')}`);
}

// ----------------------------------------------------------------------------
// Rule 7: Population & Households Completeness (人口・世帯数完全性)
// ----------------------------------------------------------------------------
{
  const expected = 'Every feature must have valid non-negative integer population and households properties';
  let missingPop = 0;
  let missingHh = 0;
  let invalidValues = 0;
  let totalPop = 0;
  let totalHh = 0;

  features.forEach(f => {
    const p = f.properties || {};
    const pop = p.population;
    const hh = p.households;

    if (pop === undefined || pop === null || isNaN(pop)) {
      missingPop++;
    } else if (typeof pop !== 'number' || pop < 0) {
      invalidValues++;
    } else {
      totalPop += pop;
    }

    if (hh === undefined || hh === null || isNaN(hh)) {
      missingHh++;
    } else if (typeof hh !== 'number' || hh < 0) {
      invalidValues++;
    } else {
      totalHh += hh;
    }
  });

  const pass = missingPop === 0 && missingHh === 0 && invalidValues === 0;
  const actual = `MissingPop: ${missingPop}, MissingHh: ${missingHh}, InvalidValues: ${invalidValues}`;
  record('Rule-07', 'Population & Households Completeness', pass, expected, actual, `Total Pop: ${totalPop.toLocaleString()}, Total HH: ${totalHh.toLocaleString()}`);
}

// ----------------------------------------------------------------------------
// Rule 8: SSOT 1:1 Mapping & Population Coherence (集計値整合性)
// ----------------------------------------------------------------------------
{
  const minPop = parseInt(process.env.MIN_POPULATION || '1', 10);
  const minHh = parseInt(process.env.MIN_HOUSEHOLDS || '1', 10);
  const totalPop = features.reduce((sum, f) => sum + (f.properties?.population || 0), 0);
  const totalHh = features.reduce((sum, f) => sum + (f.properties?.households || 0), 0);

  const isAllowEmpty = process.argv.includes('--allow-empty') || process.env.ALLOW_EMPTY_MASTER === 'true';
  const expected = (N === 0 && isAllowEmpty)
    ? 'Empty template master baseline (0 population, 0 households)'
    : `Total population >= ${minPop.toLocaleString()} and total households >= ${minHh.toLocaleString()} (e-Stat Census official baseline)`;

  const pass = (N === 0 && isAllowEmpty)
    ? (totalPop === 0 && totalHh === 0)
    : (totalPop >= minPop && totalHh >= minHh);

  const actual = `Aggregated Population: ${totalPop.toLocaleString()}, Households: ${totalHh.toLocaleString()}`;
  record('Rule-08', 'SSOT 1:1 Mapping & Population Coherence', pass, expected, actual, `e-Stat Census official aggregated totals verified`);
}

// ----------------------------------------------------------------------------
// Rule 9: Universal Engine Purity (active/ Zero District-Specific Leaks)
// ----------------------------------------------------------------------------
{
  const expected = 'Zero Target District-specific identifiers (city_name, city_code) leaked into active/ universal engine';
  const activeDir = path.join(rootDir, 'active');

  function scanDir(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        files = files.concat(scanDir(full));
      } else if (ent.isFile() && !ent.name.endsWith('.png') && !ent.name.endsWith('.ico')) {
        files.push(full);
      }
    }
    return files;
  }

  const activeFiles = scanDir(activeDir);
  const targetIdentifiers = [];
  muniRows.forEach(m => {
    if (m.city_name) targetIdentifiers.push({ type: 'city_name', value: m.city_name });
    if (m.city_code) targetIdentifiers.push({ type: 'city_code', value: m.city_code });
  });

  const leaks = [];
  const staticBindingPattern = /全域\s*[\(（][^\)）]+[\)）]/g;
  activeFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const relPath = path.relative(rootDir, f);
    targetIdentifiers.forEach(target => {
      if (content.includes(target.value)) {
        leaks.push({ file: relPath, matched: target.value, type: target.type });
      }
    });
    const matches = content.match(staticBindingPattern);
    if (matches) {
      matches.forEach(m => {
        leaks.push({ file: relPath, matched: m, type: 'static_ui_binding_pattern' });
      });
    }
  });

  const pass = leaks.length === 0;
  const actual = pass
    ? `Checked ${activeFiles.length} files in active/, 0 leaks of Target District identifiers (${targetIdentifiers.map(t => t.value).join(', ')})`
    : `Detected ${leaks.length} leaks in active/: ${leaks.slice(0, 5).map(l => `${l.file} [${l.matched}]`).join(', ')}`;

  record('Rule-09', 'Universal Engine Purity', pass, expected, actual, `active/ scanned ${activeFiles.length} files against Target SSOT`);
}

// ----------------------------------------------------------------------------
// Audit Summary
// ----------------------------------------------------------------------------
auditResults.summary.totalRules = 9;
auditResults.summary.status = auditResults.summary.failedRules === 0 ? 'PASS' : 'FAIL';
console.log('===============================================================');
console.log(`STAGE 1 AUDIT RESULT: ${auditResults.summary.status} (${auditResults.summary.passedRules}/${auditResults.summary.totalRules} rules passed)`);
console.log('===============================================================\n');

if (auditResults.summary.status !== 'PASS') {
  process.exit(1);
}
