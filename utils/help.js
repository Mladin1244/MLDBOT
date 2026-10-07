const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder
} = require('discord.js');
const helpData = require('./helpData');
const {
  getPreferredLanguage,
  savePreferredLanguage,
  SUPPORTED_LANGUAGES
} = require('./languageManager');

const CATEGORY_KEYS = ['economy', 'casino', 'multiplayer'];
const CATEGORY_EMOJIS = { economy: '💰', casino: '🎰', multiplayer: '🎮' };
const HELP_TIMEOUT = 120000;
const LANGUAGE_TIMEOUT = 60000;

function categoryIndex(category) {
  return CATEGORY_KEYS.indexOf(category);
}

function getCategoryName(language, category) {
  return helpData[language].categoryLabels[category].replace(/^\S+\s/, '');
}

function createHelpEmbed(index, language, client, prefix, notice) {
  const content = helpData[language];
  const isHome = index === 0;
  const categoryKey = isHome ? null : CATEGORY_KEYS[index - 1];
  const category = categoryKey ? content[categoryKey] : null;
  const embed = new EmbedBuilder()
    .setColor(categoryKey === 'economy' ? 0x2ecc71
      : categoryKey === 'casino' ? 0xf1c40f
        : categoryKey === 'multiplayer' ? 0x3498db : 0x5865f2)
    .setTitle(categoryKey
      ? `${content.title} — ${content.categoryLabels[categoryKey]}`
      : content.title)
    .setFooter({ text: content.footer(index + 1, CATEGORY_KEYS.length + 1) })
    .setTimestamp();

  if (client.user) embed.setThumbnail(client.user.displayAvatarURL());
  if (notice) embed.setDescription(`${notice}\n\n${isHome ? content.menuDescription : ''}`.trim());
  else if (isHome) embed.setDescription(content.menuDescription);

  if (isHome) {
    embed.addFields(CATEGORY_KEYS.map((key) => ({
      name: content.categoryLabels[key],
      value: content.categoryDescriptions[key],
      inline: false
    })));
    embed.addFields({ name: '\u200b', value: content.instructions, inline: false });
  } else {
    for (const entry of category) {
      embed.addFields({
        name: `${entry.emoji} ${entry.name}`,
        value: [
          entry.description,
          `**${language === 'ro' ? 'Sintaxă' : 'Syntax'}:** \`${entry.syntax.replaceAll('!', prefix)}\``,
          `**${language === 'ro' ? 'Exemplu' : 'Example'}:** \`${entry.example.replaceAll('!', prefix)}\``,
          `**${language === 'ro' ? 'Rezultat' : 'Result'}:** ${entry.result}`
        ].join('\n'),
        inline: false
      });
    }
  }
  return embed;
}

function helpComponents(index, language, disabled = false) {
  const content = helpData[language];
  const navigation = content.navigation;
  const rows = [];

  if (index === 0) {
    rows.push(new ActionRowBuilder().addComponents(CATEGORY_KEYS.map((key) =>
      new ButtonBuilder()
        .setCustomId(`glitchhelp_category_${key}`)
        .setLabel(getCategoryName(language, key))
        .setEmoji(CATEGORY_EMOJIS[key])
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled))));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('glitchhelp_previous')
      .setLabel(navigation.back)
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || index === 0 || index === 1),
    new ButtonBuilder()
      .setCustomId('glitchhelp_next')
      .setLabel(navigation.next)
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || index === 0 || index === CATEGORY_KEYS.length),
    new ButtonBuilder()
      .setCustomId('glitchhelp_close')
      .setLabel(navigation.close)
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  ));

  rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('glitchhelp_select')
      .setPlaceholder(navigation.select)
      .setDisabled(disabled)
      .addOptions(
        { label: navigation.home, value: 'home', emoji: '🏠', default: index === 0 },
        ...CATEGORY_KEYS.map((key, categoryPosition) => ({
          label: getCategoryName(language, key),
          value: key,
          emoji: CATEGORY_EMOJIS[key],
          default: index === categoryPosition + 1
        }))
      )
  ));
  return rows;
}

function languagePickerPayload(prefix) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('glitchhelp_language_ro')
      .setLabel('Română')
      .setEmoji('🇷🇴')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('glitchhelp_language_en')
      .setLabel('English')
      .setEmoji('🇬🇧')
      .setStyle(ButtonStyle.Primary)
  );
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🌍 Selectează limba / Select a language')
      .setDescription('Alege limba în care vrei să citești comenzile / Choose the language for the command guide.\n\nPreferința ta va fi salvată pentru data viitoare.')
      .setFooter({ text: `Răspunde în 60s • Choose within 60s • ${prefix}glitchhelp switch` })],
    components: [row]
  };
}

function requesterOf(source, slash) {
  return slash ? source.user : source.author;
}

async function checkHelpPermissions(source, client, prefix, slash) {
  const permissions = source.channel?.permissionsFor(client.user);
  if (!slash && permissions && !permissions.has(PermissionFlagsBits.SendMessages)) {
    console.error(`Nu pot afișa glitchhelp în canalul ${source.channel.id}: lipsește permisiunea Send Messages.`);
    return false;
  }
  if (permissions && !permissions.has(PermissionFlagsBits.EmbedLinks)) {
    const message = `⚠️ I need the **Embed Links** permission to show the interactive help menu.`;
    if (slash) await source.reply({ content: message, ephemeral: true });
    else await source.reply(message);
    return false;
  }
  return true;
}

async function createResponse(source, payload, slash) {
  if (slash) {
    await source.reply(payload);
    return source.fetchReply();
  }
  return source.reply(payload);
}

function indexForCategory(category) {
  const selected = categoryIndex(category);
  return selected < 0 ? 0 : selected + 1;
}

function attachHelpCollector(response, { source, client, prefix, db, slash, language, index }) {
  const requester = requesterOf(source, slash);
  const collector = response.createMessageComponentCollector({ time: HELP_TIMEOUT });
  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== requester.id) {
      await interaction.reply({ content: helpData[language].unauthorized, ephemeral: true });
      return;
    }
    try {
      if (interaction.customId === 'glitchhelp_close') {
        await interaction.update({
          embeds: [createHelpEmbed(index, language, client, prefix, helpData[language].closed)],
          components: []
        });
        collector.stop('closed');
        return;
      }
      if (interaction.customId.startsWith('glitchhelp_category_')) {
        index = indexForCategory(interaction.customId.slice('glitchhelp_category_'.length));
      } else if (interaction.customId === 'glitchhelp_select') {
        index = interaction.values[0] === 'home' ? 0 : indexForCategory(interaction.values[0]);
      } else if (interaction.customId === 'glitchhelp_previous') {
        index = Math.max(0, index - 1);
      } else if (interaction.customId === 'glitchhelp_next') {
        index = Math.min(CATEGORY_KEYS.length, index + 1);
      }
      await interaction.update({
        embeds: [createHelpEmbed(index, language, client, prefix)],
        components: helpComponents(index, language)
      });
    } catch (error) {
      console.error('Nu s-a putut actualiza meniul help:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'The help menu could not be updated. Please try again.', ephemeral: true });
      }
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason === 'closed') return;
    response.edit({ components: helpComponents(index, language, true) }).catch((error) => {
      console.error('Nu s-au putut dezactiva controalele help expirate:', error);
    });
  });
}

function attachLanguageCollector(response, options) {
  const { source, client, prefix, db, slash, category } = options;
  const requester = requesterOf(source, slash);
  const collector = response.createMessageComponentCollector({ time: LANGUAGE_TIMEOUT });
  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== requester.id) {
      await interaction.reply({ content: 'Only the user who requested help can choose its language.', ephemeral: true });
      return;
    }
    try {
      const language = interaction.customId === 'glitchhelp_language_ro' ? 'ro' : 'en';
      savePreferredLanguage(db, requester, language);
      const index = indexForCategory(category);
      await interaction.update({
        embeds: [createHelpEmbed(index, language, client, prefix, helpData[language].languageSelected)],
        components: helpComponents(index, language)
      });
      collector.stop('selected');
      attachHelpCollector(response, { ...options, language, index });
    } catch (error) {
      console.error('Nu s-a putut salva limba preferată:', error);
      await interaction.reply({ content: 'The language preference could not be saved. Please try again.', ephemeral: true });
    }
  });
  collector.on('end', (_collected, reason) => {
    if (reason === 'selected') return;
    if (reason === 'time') {
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle('🌍 Selectează limba / Select a language')
        .setDescription(`${helpData.ro.selectLanguage.timeout}\n${helpData.en.selectLanguage.timeout}`);
      response.edit({ embeds: [timeoutEmbed], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('glitchhelp_language_ro').setLabel('Română').setEmoji('🇷🇴').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('glitchhelp_language_en').setLabel('English').setEmoji('🇬🇧').setStyle(ButtonStyle.Primary).setDisabled(true)
      )] }).catch((error) => console.error('Nu s-a putut actualiza selectorul de limbă expirat:', error));
    }
  });
}

async function presentHelp({ source, category, language, client, prefix, db, slash = false, switchLanguage = false }) {
  if (!await checkHelpPermissions(source, client, prefix, slash)) return;
  const requester = requesterOf(source, slash);
  const storedLanguage = getPreferredLanguage(db, requester);
  const requestedLanguage = language && SUPPORTED_LANGUAGES.includes(language) ? language : null;

  if (requestedLanguage) savePreferredLanguage(db, requester, requestedLanguage);
  const selectedLanguage = requestedLanguage || storedLanguage;
  if (switchLanguage || !selectedLanguage) {
    const response = await createResponse(source, languagePickerPayload(prefix), slash);
    attachLanguageCollector(response, {
      source, client, prefix, db, slash, category
    });
    return;
  }

  let notice;
  if (category && !CATEGORY_KEYS.includes(category)) {
    notice = selectedLanguage === 'ro'
      ? `Categoria „${category}” nu există. Iată meniul principal.`
      : `The “${category}” category does not exist. Here is the main menu.`;
  }
  const index = indexForCategory(category);
  const response = await createResponse(source, {
    embeds: [createHelpEmbed(index, selectedLanguage, client, prefix, notice)],
    components: helpComponents(index, selectedLanguage)
  }, slash);
  attachHelpCollector(response, {
    source, client, prefix, db, slash, language: selectedLanguage, index
  });
}

module.exports = {
  CATEGORY_KEYS,
  HELP_TIMEOUT,
  LANGUAGE_TIMEOUT,
  createHelpEmbed,
  helpComponents,
  languagePickerPayload,
  presentHelp
};
