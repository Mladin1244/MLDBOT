const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWelcomeConfig } = require('../utils/welcomeConfig');
const setupWelcome = require('../commands/setup-welcome');
const disableWelcome = require('../commands/disable-welcome');

test('salvează separat pentru fiecare server canalul și imaginea încărcată', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'welcome-config-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = createWelcomeConfig(
    path.join(directory, 'config.json'),
    path.join(directory, 'images')
  );
  const firstGuild = '10000000000000001';
  const secondGuild = '20000000000000002';

  await config.set(firstGuild, {
    channelId: '30000000000000003',
    imageBuffer: Buffer.from('welcome-image'),
    imageExtension: '.png'
  });
  await config.set(secondGuild, { channelId: '40000000000000004' });

  const saved = config.get(firstGuild);
  assert.equal(saved.channelId, '30000000000000003');
  assert.equal(fs.readFileSync(config.getImagePath(saved.imageFile), 'utf8'), 'welcome-image');
  assert.deepEqual(config.get(secondGuild), {
    channelId: '40000000000000004',
    imageFile: null
  });

  const restartedConfig = createWelcomeConfig(
    path.join(directory, 'config.json'),
    path.join(directory, 'images')
  );
  assert.deepEqual(restartedConfig.get(firstGuild), saved);
  assert.equal(restartedConfig.remove(firstGuild), true);
  assert.equal(fs.existsSync(config.getImagePath(saved.imageFile)), false);
  assert.equal(restartedConfig.get(firstGuild), null);
});

test('comenzile de configurare permit selectarea canalului și încărcarea unei imagini', () => {
  const setup = setupWelcome.data.toJSON();
  assert.equal(setup.name, 'setup-welcome');
  assert.deepEqual(setup.options.map((option) => [option.name, option.type, option.required]), [
    ['canal', 7, true],
    ['imagine', 11, false]
  ]);
  assert.equal(disableWelcome.data.toJSON().name, 'disable-welcome');
});
