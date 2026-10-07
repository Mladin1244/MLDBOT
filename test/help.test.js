const test = require('node:test');
const assert = require('node:assert/strict');
const helpData = require('../utils/helpData');
const {
  CATEGORY_KEYS,
  HELP_TIMEOUT,
  LANGUAGE_TIMEOUT,
  createHelpEmbed,
  helpComponents,
  languagePickerPayload
} = require('../utils/help');
const slashCommand = require('../interactions/commands/glitchhelp');
const { suggestionFor } = require('../commands');

test('help include categoriile cerute bilingv și exclude comenzile admin', () => {
  assert.deepEqual(CATEGORY_KEYS, ['economy', 'casino', 'multiplayer']);
  for (const language of ['ro', 'en']) {
    assert.deepEqual(helpData[language].economy.map((command) => command.name),
      language === 'ro'
        ? ['Credite', 'Transfer', 'Recompensă zilnică', 'Clasament', 'Statistici']
        : ['Credits', 'Transfer', 'Daily Reward', 'Leaderboard', 'Statistics']);
    assert.equal(helpData[language].casino.length, 3);
    assert.equal(helpData[language].multiplayer.length, 3);
  }
  assert.equal(JSON.stringify(helpData).includes('admin_'), false);
});

test('embed-urile localizează categorii, comenzi, footer și prefix', () => {
  const client = { user: null };
  const roHome = createHelpEmbed(0, 'ro', client, '!');
  const enHome = createHelpEmbed(0, 'en', client, '!');
  const roEconomy = createHelpEmbed(1, 'ro', client, '?');
  const enEconomy = createHelpEmbed(1, 'en', client, '?');
  assert.equal(roHome.data.title, '🎮 Ajutor GlitchBot');
  assert.equal(enHome.data.title, '🎮 GlitchBot Help');
  assert.equal(roHome.data.footer.text, 'Română • Pagina 1/4');
  assert.equal(enHome.data.footer.text, 'English • Page 1/4');
  assert.equal(roEconomy.data.color, 0x2ecc71);
  assert.ok(roEconomy.data.fields[0].value.includes('`?credite`'));
  assert.ok(enEconomy.data.fields[0].value.includes('`?credits`'));
  assert.equal(helpComponents(0, 'ro').length, 3);
  assert.equal(helpComponents(1, 'en').length, 2);
  assert.equal(HELP_TIMEOUT, 120000);
  assert.equal(LANGUAGE_TIMEOUT, 60000);
});

test('selectorul de limbă și slash command expun limbile și categoria', () => {
  const picker = languagePickerPayload('!');
  assert.equal(picker.components[0].components.length, 2);
  assert.deepEqual(picker.components[0].components.map((button) => button.data.custom_id),
    ['glitchhelp_language_ro', 'glitchhelp_language_en']);

  const data = slashCommand.data.toJSON();
  assert.equal(data.name, 'glitchhelp');
  assert.deepEqual(data.options[0].choices.map((choice) => choice.value),
    ['economy', 'casino', 'multiplayer']);
  assert.deepEqual(data.options[1].choices.map((choice) => choice.value), ['ro', 'en']);
  assert.equal(data.options.every((option) => option.required === false), true);
});

test('o comandă scrisă greșit sugerează doar o comandă publică apropiată', () => {
  assert.equal(suggestionFor('glitchhlep'), 'glitchhelp');
  assert.equal(suggestionFor('blackjacl'), 'blackjack');
  assert.equal(suggestionFor('admin_add_credits'), null);
});
