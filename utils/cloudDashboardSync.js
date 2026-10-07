const DASHBOARD_FIELDS = [
  'verifyChannelId',
  'verifyRoleId',
  'levelChannelId',
  'ticketCategoryId',
  'ticketPanelChannelId',
  'suggestionsChannelId',
  'ticketLogChannelId',
  'staffRoleIds'
];
const POLL_INTERVAL_MS = 15_000;

const endpoint = process.env.DASHBOARD_SYNC_URL;
const secret = process.env.DASHBOARD_SYNC_SECRET;
let polling = false;

function configured() {
  return Boolean(endpoint && secret);
}

async function request(path = '', options = {}) {
  const url = new URL(endpoint);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}${path ? `/${path.replace(/^\/+/, '')}` : ''}`;
  if (url.protocol !== 'https:') throw new Error('DASHBOARD_SYNC_URL trebuie să folosească HTTPS.');
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(12_000),
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: 'application/json',
      ...options.headers
    }
  });
}

async function readResponse(response) {
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`Dashboard-ul Cloudflare a returnat JSON invalid (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(result.error || `Sincronizarea cu dashboardul a eșuat (HTTP ${response.status}).`);
  }
  return result;
}

async function synchronize() {
  if (!configured() || polling) return;
  polling = true;
  try {
    const serverConfig = require('./serverConfig');
    const casinoConfig = require('./casinoConfig');
    const response = await request();
    const snapshot = await readResponse(response);
    if (!Array.isArray(snapshot.guilds)) throw new Error('Snapshot-ul dashboardului nu conține lista serverelor.');

    const cloudGuildIds = new Set();
    const acknowledged = [];
    for (const entry of snapshot.guilds) {
      if (!entry || !/^\d{17,20}$/.test(entry.guildId) ||
          !Number.isSafeInteger(entry.revision) || entry.revision < 1 ||
          !entry.server || typeof entry.server !== 'object' ||
          !entry.casino || typeof entry.casino !== 'object') {
        throw new Error('Snapshot-ul dashboardului conține o configurație invalidă.');
      }
      cloudGuildIds.add(entry.guildId);
      serverConfig.update(entry.guildId, entry.server);
      casinoConfig.set(entry.guildId, entry.casino);
      acknowledged.push({ guildId: entry.guildId, revision: entry.revision });
    }

    const localServerConfigs = serverConfig.getAll();
    const localCasinoConfigs = casinoConfig.getAll();
    const localGuildIds = new Set([
      ...Object.keys(localServerConfigs),
      ...Object.keys(localCasinoConfigs)
    ]);
    for (const guildId of localGuildIds) {
      if (cloudGuildIds.has(guildId)) continue;
      const server = Object.fromEntries(
        Object.entries(localServerConfigs[guildId] || {})
          .filter(([field]) => DASHBOARD_FIELDS.includes(field))
      );
      await readResponse(await request(`/${encodeURIComponent(guildId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, casino: casinoConfig.get(guildId) })
      }));
    }

    if (acknowledged.length) {
      await readResponse(await request('/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: acknowledged })
      }));
    }
  } catch (error) {
    console.error('Sincronizarea setărilor dashboardului a eșuat:', error);
  } finally {
    polling = false;
  }
}

async function pushServerPatch(guildId, patch) {
  if (!configured()) return;
  const server = Object.fromEntries(
    Object.entries(patch).filter(([field]) => DASHBOARD_FIELDS.includes(field))
  );
  if (!Object.keys(server).length) return;
  try {
    await readResponse(await request(`/${encodeURIComponent(guildId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server })
    }));
  } catch (error) {
    console.error(`Nu am putut sincroniza setările serverului ${guildId} cu Cloudflare:`, error);
  }
}

function start() {
  if (!configured()) {
    console.warn('Sincronizarea cu dashboardul este dezactivată; configurează DASHBOARD_SYNC_URL și DASHBOARD_SYNC_SECRET în Railway.');
    return;
  }
  void synchronize();
  const timer = setInterval(() => void synchronize(), POLL_INTERVAL_MS);
  timer.unref();
}

module.exports = { start, synchronize, pushServerPatch };
