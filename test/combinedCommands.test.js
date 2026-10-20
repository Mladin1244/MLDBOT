const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { commands } = require('../utils/registerCommands');
const setupTicketCommand = require('../commands/setup-ticket');
const { resolveServerEmoji } = require('../utils/setupAssets');

test('înregistrează comenzile de casino, verificare, ticket și postare fără duplicate', () => {
  const definitions = commands.map((entry) => entry.data.toJSON());
  const names = definitions.map((entry) => entry.name);

  assert.equal(new Set(names).size, names.length);
  for (const name of [
    'credite',
    'blackjack',
    'glitchhelp',
    'setup-verify',
    'setup-ticket',
    'post',
    'setup-welcome',
    'disable-welcome',
    'setup-level',
    'level',
    'missions'
  ]) {
    assert.ok(names.includes(name), `Lipsește comanda /${name}.`);
  }

  for (const name of [
    'setup-verify',
    'setup-ticket',
    'post',
    'setup-welcome',
    'disable-welcome',
    'setup-level'
  ]) {
    const command = definitions.find((entry) => entry.name === name);
    assert.equal(
      command.default_member_permissions,
      PermissionFlagsBits.Administrator.toString(),
      `/${name} trebuie să fie accesibilă administratorilor.`
    );
  }

  const verifyOptions = commands.find((entry) => entry.data.name === 'setup-verify')
    .data.toJSON().options;
  assert.deepEqual(
    verifyOptions.map((option) => [option.name, option.type, option.required]),
    [
      ['rol', 8, true],
      ['titlu', 3, false],
      ['text', 3, false],
      ['imagine', 11, false],
      ['emoji', 3, false]
    ]
  );

  const ticketOptions = commands.find((entry) => entry.data.name === 'setup-ticket')
    .data.toJSON().options;
  assert.deepEqual(ticketOptions.map((option) => [option.name, option.type, option.required]), [
    ['categorie', 7, true],
    ['staff', 8, true],
    ['sugestii', 7, true],
    ['nume1', 3, true],
    ['emoji1', 3, true],
    ['loguri', 7, false],
    ['panou', 7, false],
    ['titlu', 3, false],
    ['prompt', 3, false],
    ['text', 3, false],
    ['imagine', 11, false],
    ['nume2', 3, false],
    ['emoji2', 3, false],
    ['tip2', 3, false],
    ['nume3', 3, false],
    ['emoji3', 3, false],
    ['tip3', 3, false]
  ]);

  const levelSetupOptions = commands.find((entry) => entry.data.name === 'setup-level')
    .data.toJSON().options;
  assert.deepEqual(
    levelSetupOptions.map((option) => [option.name, option.type, option.required]),
    [['canal', 7, true], ['imagine', 11, false]]
  );
});

test('configurează prima categorie și permite categoriile 2 și 3 ca opțiuni', async () => {
  const guild = { emojis: { cache: { find: () => undefined } } };
  const values = {
    nume1: 'Game Bug',
    emoji1: '🐞',
    nume2: 'Game Suggestions',
    emoji2: '💡',
    tip2: 'suggestion',
    nume3: 'Game Cheater',
    emoji3: '🚨'
  };
  const types = await setupTicketCommand.parseTicketTypes(
    { getString: (name) => values[name] ?? null },
    guild
  );

  assert.deepEqual(types.map(({ key, label, action }) => [key, label, action]), [
    ['game-bug', 'Game Bug', 'ticket'],
    ['game-suggestions', 'Game Suggestions', 'suggestion'],
    ['game-cheater', 'Game Cheater', 'ticket']
  ]);
  assert.equal(types[0].details, 'Te rugăm să oferi detalii despre: Game Bug.');
  assert.equal(types[1].details, '');
  await assert.rejects(
    setupTicketCommand.parseTicketTypes(
      { getString: (name) => ({
        nume1: 'Game Bug',
        emoji1: '🐞',
        emoji2: '💡'
      }[name] ?? null) },
      guild
    ),
    /atât numele, cât și emojiul/
  );
});

test('acceptă emojiuri personalizate doar dacă aparțin serverului', async () => {
  const guildId = '10000000000000001';
  const emojiId = '20000000000000002';
  const guild = {
    id: guildId,
    emojis: {
      cache: { get: () => undefined },
      fetch: async (id) => ({
        id,
        name: 'custom',
        animated: false,
        guild: { id: guildId }
      })
    }
  };

  assert.deepEqual(await resolveServerEmoji(guild, `<:custom:${emojiId}>`), {
    id: emojiId,
    name: 'custom',
    animated: false
  });
  await assert.rejects(
    resolveServerEmoji({
      ...guild,
      emojis: {
        ...guild.emojis,
        fetch: async (id) => ({
          id,
          name: 'external',
          animated: false,
          guild: { id: '30000000000000003' }
        })
      }
    }, emojiId),
    /trebuie să aparțină acestui server/
  );
});
