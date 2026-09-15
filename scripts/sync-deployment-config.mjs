import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const deploymentPath = path.join(rootDir, 'deployment.json');
const targetConfigPath = path.join(rootDir, 'data', 'config.js');

let targetConfigJson = deploymentPath;
if (!fs.existsSync(deploymentPath)) {
  const templatePath = path.join(rootDir, 'deployment.template.json');
  if (fs.existsSync(templatePath)) {
    targetConfigJson = templatePath;
    console.log('ℹ️ [Sync Config] deployment.json not found, using deployment.template.json...');
  } else {
    console.error('❌ [Sync Config Error] Neither deployment.json nor deployment.template.json found!');
    process.exit(1);
  }
}

let deploymentData;
try {
  deploymentData = JSON.parse(fs.readFileSync(targetConfigJson, 'utf8'));
} catch (err) {
  console.error(`❌ [Sync Config Error] Failed to parse ${targetConfigJson}:`, err.message);
  process.exit(1);
}

const resources = deploymentData?.resources || {};
const webAppUrl = (resources.webAppUrl || '').trim();
const productionLiffUrl = (resources.productionLiffUrl || '').trim();

let liffId = '';
if (productionLiffUrl) {
  try {
    const parsedUrl = new URL(productionLiffUrl);
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    liffId = segments[0] || '';
  } catch (err) {
    console.error('❌ [Sync Config Error] Failed to parse productionLiffUrl URL:', err.message);
    process.exit(1);
  }
}

const configContent = `window.PMS_CLIENT_CONFIG = {
  version: "1.0.1",
  status: "ACTIVE_DEVELOPMENT",
  environment: "production",
  api: {
    gasWebAppUrl: "${webAppUrl}"
  },
  staticMaster: {
    addressCsvFilename: "address_master.csv",
    boundariesGeojsonFilename: "boundaries.geojson",
    electionHistoryFilename: "election_history.json"
  },
  line: {
    liffId: "${liffId}"
  },
  features: {
    photoUpload: true,
    gpsTracking: true
  }
};
`;

fs.writeFileSync(targetConfigPath, configContent, 'utf8');

console.log('✅ [Sync Config] data/config.js successfully synchronized from deployment.json:');
console.log(`   - webAppUrl: ${webAppUrl}`);
console.log(`   - liffId: ${liffId} (derived from ${productionLiffUrl})`);
console.log('   - spreadsheetId: [OMITTED - District-Agnostic]');
