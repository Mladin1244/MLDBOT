const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { InviteTracker } = require('../utils/inviteTracker');

function createGuild(invites) {
  return {
    id: '10000000000000001',
    invites: {
      fetch: async () => new Map(invites.map((invite) => [invite.code, invite]))
    }
  };
}

test('urmărește invitațiile, totalurile inviter-ului și persistența după restart', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'invite-tracker-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'invites.json');
  const inviterId = '20000000000000002';
  const guild = createGuild([
    { code: 'invite-code', uses: 3, inviter: { id: inviterId } }
  ]);
  const tracker = new InviteTracker(filePath);

  tracker.initialize();
  await tracker.syncGuild(guild);
  guild.invites.fetch = async () => new Map([
    ['invite-code', {
      code: 'invite-code',
      uses: 4,
      inviter: { id: inviterId }
    }]
  ]);

  const attribution = await tracker.handleMemberJoin({ guild, id: '30000000000000003' });
  assert.deepEqual(attribution, { inviterId, inviteCount: 4 });

  const restartedTracker = new InviteTracker(filePath);
  restartedTracker.initialize();
  const nextAttribution = await restartedTracker.handleMemberJoin({
    guild: createGuild([
      { code: 'invite-code', uses: 5, inviter: { id: inviterId } }
    ]),
    id: '40000000000000004'
  });
  assert.deepEqual(nextAttribution, { inviterId, inviteCount: 5 });
});

test('nu atribuie o invitație când mai multe persoane au folosit linkuri diferite', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'invite-tracker-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const tracker = new InviteTracker(path.join(directory, 'invites.json'));
  const guild = createGuild([
    { code: 'first', uses: 0, inviter: { id: '20000000000000002' } },
    { code: 'second', uses: 0, inviter: { id: '30000000000000003' } }
  ]);

  tracker.initialize();
  await tracker.syncGuild(guild);
  guild.invites.fetch = async () => new Map([
    ['first', { code: 'first', uses: 1, inviter: { id: '20000000000000002' } }],
    ['second', { code: 'second', uses: 1, inviter: { id: '30000000000000003' } }]
  ]);

  const attribution = await tracker.handleMemberJoin({ guild, id: '40000000000000004' });
  assert.deepEqual(attribution, { inviterId: null, inviteCount: null });
});
