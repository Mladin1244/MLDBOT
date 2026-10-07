const test = require('node:test');
const assert = require('node:assert/strict');
const { commands } = require('../interactions/commands');

test('toate comenzile publice și admin sunt definite pentru slash', () => {
  const definitions = commands.map((entry) => entry.data.toJSON());
  const names = definitions.map((entry) => entry.name);
  assert.deepEqual(names, [
    'credite', 'credits', 'transfer', 'daily', 'leaderboard', 'stats',
    'blackjack', 'poker', 'craps',
    'admin_add_credits', 'admin_remove_credits', 'admin_reset', 'glitchhelp',
    'level', 'missions'
  ]);
  for (const definition of definitions) {
    assert.ok(definition.description.length > 0 && definition.description.length <= 100);
    assert.match(definition.name, /^[a-z0-9_-]{1,32}$/);
  }
});

test('slash jocurile cer miza și permit un adversar opțional', () => {
  for (const name of ['blackjack', 'poker', 'craps']) {
    const game = commands.find((entry) => entry.data.name === name).data.toJSON();
    assert.deepEqual(game.options.map((option) => [option.name, option.required]), [
      ['bet', true],
      ['opponent', false]
    ]);
    assert.equal(game.options[0].min_value, 1);
  }
});

test('slash transfer și admin au opțiuni obligatorii tipizate', () => {
  for (const name of ['transfer', 'admin_add_credits', 'admin_remove_credits', 'admin_reset']) {
    const definition = commands.find((entry) => entry.data.name === name).data.toJSON();
    assert.equal(definition.options[0].type, 6);
    assert.equal(definition.options[0].required, true);
    if (name !== 'admin_reset') {
      assert.equal(definition.options[1].type, 4);
      assert.equal(definition.options[1].required, true);
      assert.equal(definition.options[1].min_value, 1);
    }
  }
});
