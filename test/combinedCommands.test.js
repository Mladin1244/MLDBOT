const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { commands } = require('../utils/registerCommands');

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
  assert.deepEqual(verifyOptions.map((option) => [option.name, option.type, option.required]), [
    ['rol', 8, true]
  ]);

  const ticketOptions = commands.find((entry) => entry.data.name === 'setup-ticket')
    .data.toJSON().options;
  assert.deepEqual(ticketOptions.map((option) => [option.name, option.type, option.required]), [
    ['categorie', 7, true],
    ['staff', 8, true],
    ['sugestii', 7, true],
    ['loguri', 7, false],
    ['panou', 7, false]
  ]);

  const levelSetupOptions = commands.find((entry) => entry.data.name === 'setup-level')
    .data.toJSON().options;
  assert.deepEqual(
    levelSetupOptions.map((option) => [option.name, option.type, option.required]),
    [['canal', 7, true], ['imagine', 11, false]]
  );
});
