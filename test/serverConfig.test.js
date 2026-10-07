const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServerConfig } = require('../utils/serverConfig');

test('persistă setările selectate pe server, păstrând configurațiile independente', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'server-config-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'servers.json');
  const serverId = '10000000000000001';
  const secondServerId = '20000000000000002';
  const settings = createServerConfig(filePath);

  settings.update(serverId, {
    verifyRoleId: '30000000000000003',
    ticketCategoryId: '40000000000000004',
    staffRoleIds: ['50000000000000005'],
    suggestionsChannelId: '60000000000000006',
    ticketLogChannelId: null
  });
  settings.update(secondServerId, {
    verifyRoleId: '70000000000000007'
  });

  const restartedSettings = createServerConfig(filePath);
  assert.deepEqual(restartedSettings.get(serverId), {
    verifyRoleId: '30000000000000003',
    ticketCategoryId: '40000000000000004',
    staffRoleIds: ['50000000000000005'],
    suggestionsChannelId: '60000000000000006',
    ticketLogChannelId: null
  });
  assert.deepEqual(restartedSettings.get(secondServerId), {
    verifyRoleId: '70000000000000007'
  });
});

test('refuză salvarea unui ID de canal sau rol invalid', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'server-config-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const settings = createServerConfig(path.join(directory, 'servers.json'));

  assert.throws(() => settings.update('invalid-server', { verifyRoleId: '123' }), /ID-ul serverului/);
  assert.throws(
    () => settings.update('10000000000000001', { suggestionsChannelId: 'invalid-channel' }),
    /suggestionsChannelId/
  );
});
