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
  url.pathname = path.startsWith('/api/')
    ? path
    : `${url.pathname.replace(/\/+$/, '')}${path ? `/${path.replace(/^\/+/, '')}` : ''}`;
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

async function fetchBanner(guildId, key) {
  if (!configured() || typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId) ||
      typeof key !== 'string' || !key.startsWith(`${guildId}/`) ||
      !/^[\d]{17,20}\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/.test(key)) {
    throw new Error('Cheia bannerului nu este validă.');
  }
  const filename = key.slice(guildId.length + 1);
  const response = await request(`/api/internal/banners/${guildId}/${encodeURIComponent(filename)}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Imaginea bannerului nu a putut fi descărcată (HTTP ${response.status}): ${body}`);
  }
  return Buffer.from(await response.arrayBuffer());
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
    const welcomeConfig = require('./welcomeConfig');
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
      serverConfig.update(entry.guildId, {
        ...entry.server,
        ...(entry.welcome ? { welcome: entry.welcome } : {}),
        ...(entry.leave ? { leave: entry.leave } : {})
      });
      casinoConfig.set(entry.guildId, entry.casino);
      acknowledged.push({ guildId: entry.guildId, revision: entry.revision });
    }

    const localServerConfigs = serverConfig.getAll();
    const localCasinoConfigs = casinoConfig.getAll();
    const legacyWelcomes = welcomeConfig.getAll();
    const localGuildIds = new Set([
      ...Object.keys(localServerConfigs),
      ...Object.keys(localCasinoConfigs),
      ...Object.keys(legacyWelcomes)
    ]);
    for (const guildId of localGuildIds) {
      if (cloudGuildIds.has(guildId)) continue;
      const server = Object.fromEntries(
        Object.entries(localServerConfigs[guildId] || {})
          .filter(([field]) => DASHBOARD_FIELDS.includes(field))
      );
      const local = localServerConfigs[guildId] || {};
      const legacy = legacyWelcomes[guildId];
      const welcome = local.welcome || (legacy ? {
        enabled: true,
        channelId: legacy.channelId,
        emoji: '',
        types: Object.fromEntries(['normal', 'vanity', 'unknown', 'bot'].map((type) => [type, {
          messageText: type === 'normal'
            ? '%member_mention% a fost invitat de %inviter% și are acum %inviter_invites% invitații.'
            : '',
          embedEnabled: type === 'normal',
          embedJson: {
            title: '',
            description: type === 'normal'
              ? '%member_mention% a fost invitat de %inviter% și are acum %inviter_invites% invitații.'
              : '',
            color: '#5865f2',
            footer: '',
            thumbnailMember: true,
            imageBanner: true
          },
          bannerEnabled: type === 'normal',
          bannerLayers: [],
          bannerImageKey: null
        }]))
      } : null);
      await readResponse(await request(`/${encodeURIComponent(guildId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server,
          casino: casinoConfig.get(guildId),
          ...(welcome ? { welcome } : {}),
          ...(local.leave ? { leave: local.leave } : {})
        })
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
  const { welcome, leave, casino, ...serverPatch } = patch;
  const server = Object.fromEntries(
    Object.entries(serverPatch).filter(([field]) => DASHBOARD_FIELDS.includes(field))
  );
  if (!Object.keys(server).length && !welcome && !leave && !casino) return;
  try {
    await readResponse(await request(`/${encodeURIComponent(guildId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(Object.keys(server).length ? { server } : {}),
        ...(welcome ? { welcome } : {}),
        ...(leave ? { leave } : {}),
        ...(casino ? { casino } : {})
      })
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

module.exports = { fetchBanner, start, synchronize, pushServerPatch };
