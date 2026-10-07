const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLevelSystem } = require('../utils/levelSystem');

const guildId = '10000000000000001';
const userId = '20000000000000002';

test('acordă XP pentru chat doar la cooldown și păstrează nivelul după restart', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'level-system-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'levels.json');
  const levels = createLevelSystem(filePath);
  const start = Date.UTC(2026, 9, 7, 12);

  levels.initialize();
  const first = levels.recordActivity(guildId, userId, 'message', start);
  const cooldown = levels.recordActivity(
    guildId,
    userId,
    'message',
    start + levels.XP_COOLDOWN_MS - 1
  );
  const afterCooldown = levels.recordActivity(
    guildId,
    userId,
    'message',
    start + levels.XP_COOLDOWN_MS
  );

  assert.ok(first.xpAwarded >= 15 && first.xpAwarded <= 25);
  assert.equal(cooldown.xpAwarded, 0);
  assert.equal(afterCooldown.xpAwarded >= 15, true);
  assert.equal(levels.getUser(guildId, userId, start).missions.chat.progress, 2);

  const restarted = createLevelSystem(filePath);
  restarted.initialize();
  assert.deepEqual(
    restarted.getUser(guildId, userId, start),
    levels.getUser(guildId, userId, start)
  );
});

test('misiunile zilnice se rotesc între comenzi publice și oferă XP la completare', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'level-system-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const levels = createLevelSystem(path.join(directory, 'levels.json'));
  const start = Date.UTC(2026, 9, 7, 12);
  const initial = levels.getUser(guildId, userId, start);
  const targetCommand = initial.missions.command.name;

  assert.ok(levels.PUBLIC_MISSION_COMMANDS.includes(targetCommand));
  assert.equal(
    levels.PUBLIC_MISSION_COMMANDS.some((name) => name.startsWith('admin_') || name.startsWith('setup-')),
    false
  );
  assert.deepEqual(
    levels.recordActivity(guildId, userId, 'command', start, { commandName: targetCommand })
      .completedMissions,
    []
  );
  const completed = levels.recordActivity(
    guildId,
    userId,
    'command',
    start + 1,
    { commandName: targetCommand }
  );
  assert.deepEqual(completed.completedMissions, ['command']);
  assert.equal(completed.xpAwarded, levels.MISSION_REWARD_XP);
  assert.equal(completed.profile.missions.command.progress, 2);
});

test('resetează misiunile zilnice la schimbarea datei UTC', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'level-system-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const levels = createLevelSystem(path.join(directory, 'levels.json'));
  const firstDay = Date.UTC(2026, 9, 7, 23, 59);
  const secondDay = Date.UTC(2026, 9, 8, 0, 1);

  levels.recordActivity(guildId, userId, 'message', firstDay);
  const nextDay = levels.recordActivity(guildId, userId, 'message', secondDay);
  assert.equal(nextDay.profile.missions.date, '2026-10-08');
  assert.equal(nextDay.profile.missions.chat.progress, 1);
});

test('anunță progresul prin niveluri la completarea unei misiuni de chat', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'level-system-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const levels = createLevelSystem(path.join(directory, 'levels.json'));
  const start = Date.UTC(2026, 9, 7, 12);
  let result;

  for (let message = 0; message < 10; message += 1) {
    result = levels.recordActivity(
      guildId,
      userId,
      'message',
      start + message * levels.XP_COOLDOWN_MS
    );
  }

  assert.ok(result.completedMissions.includes('chat'));
  assert.ok(result.levelUps.length > 0);
  assert.ok(result.profile.level > 0);
});
