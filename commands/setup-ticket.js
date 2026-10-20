const {
  ActionRowBuilder,
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const serverConfig = require("../utils/serverConfig");
const cloudDashboardSync = require("../utils/cloudDashboardSync");
const { requireAdministrator } = require("../utils/requireAdministrator");
const { downloadImage, resolveServerEmoji } = require("../utils/setupAssets");

const imagePath = path.join(__dirname, "..", "assets", "mldbot-ticket.jpg");
const DEFAULT_TYPES = [
  {
    key: "bug",
    label: "Game Bug",
    description: "Raportează un bug",
    emoji: "🐞",
    details: "Please provide a description, steps to reproduce, and screenshots or video.",
    action: "ticket"
  },
  {
    key: "cheater",
    label: "Game Cheater",
    description: "Raportează un cheater",
    emoji: "🚨",
    details: "Please provide the cheater's nickname, proof, screenshots or video, and the date/time.",
    action: "ticket"
  },
  {
    key: "suggestion",
    label: "Game Suggestions",
    description: "Trimite o sugestie",
    emoji: "💡",
    details: "",
    action: "suggestion"
  }
];

function createTicketTypeKey(label, index, usedKeys) {
  const base = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || `categorie-${index + 1}`;
  let key = base;
  let suffix = 2;
  while (usedKeys.has(key)) {
    const ending = `-${suffix}`;
    key = `${base.slice(0, 50 - ending.length)}${ending}`;
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

async function createTicketType(label, emojiInput, action, guild, previousTypes = []) {
  if (!label || label.length > 100 || !emojiInput ||
      !["ticket", "suggestion"].includes(action)) {
    throw new Error("Introdu un nume și un emoji valid pentru categoria de ticket.");
  }
  if (action === "suggestion" && previousTypes.some((type) => type.action === "suggestion")) {
    throw new Error("Poți configura o singură categorie pentru sugestii.");
  }
  const usedKeys = new Set(previousTypes.map((type) => type.key));
  return {
    key: createTicketTypeKey(label, previousTypes.length, usedKeys),
    label,
    description: action === "suggestion" ? "Trimite o sugestie" : "Creează un tichet",
    emoji: await resolveServerEmoji(guild, emojiInput),
    details: action === "ticket" ? `Te rugăm să oferi detalii despre: ${label}.` : "",
    action
  };
}

async function parseTicketTypes(options, guild) {
  const inputs = [1, 2, 3].map((index) => ({
    label: options.getString(`nume${index}`),
    emoji: options.getString(`emoji${index}`),
    action: options.getString(`tip${index}`) || "ticket"
  }));
  if (inputs[0].label === null || inputs[0].emoji === null) {
    throw new Error("Completează numele și emojiul pentru prima categorie.");
  }

  const configured = inputs.filter(({ label, emoji, action }) =>
    label !== null || emoji !== null || action !== "ticket"
  );
  if (configured.some(({ label, emoji }) => label === null || emoji === null)) {
    throw new Error("Pentru fiecare categorie completată trebuie să alegi atât numele, cât și emojiul.");
  }

  const types = [];
  for (const input of configured) {
    types.push(await createTicketType(
      input.label,
      input.emoji,
      input.action,
      guild,
      types
    ));
  }
  return types;
}

function createTicketMenu(ticketTypes, prompt) {
  return new StringSelectMenuBuilder()
    .setCustomId("ticket_menu")
    .setPlaceholder(prompt)
    .addOptions(ticketTypes.map((type) => ({
      label: type.label,
      value: type.key,
      emoji: type.emoji,
      description: type.description
    })));
}

function emojiForConfig(emoji) {
  return typeof emoji === "string"
    ? emoji
    : `${emoji.animated ? "<a:" : "<:"}${emoji.name}:${emoji.id}>`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("Configurează tichetele și trimite panoul de creare.")
    .addChannelOption((option) => option
      .setName("categorie")
      .setDescription("Categoria unde vor fi create tichetele.")
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(true))
    .addRoleOption((option) => option
      .setName("staff")
      .setDescription("Rolul care poate vedea și gestiona tichetele.")
      .setRequired(true))
    .addChannelOption((option) => option
      .setName("sugestii")
      .setDescription("Canalul unde vor fi publicate sugestiile.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addStringOption((option) => option
      .setName("nume1")
      .setDescription("Numele obligatoriu al primei categorii.")
      .setMaxLength(100)
      .setRequired(true))
    .addStringOption((option) => option
      .setName("emoji1")
      .setDescription("Emojiul primei categorii.")
      .setMaxLength(100)
      .setRequired(true))
    .addChannelOption((option) => option
      .setName("loguri")
      .setDescription("Canal opțional pentru logurile tichetelor.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false))
    .addChannelOption((option) => option
      .setName("panou")
      .setDescription("Canalul panoului; implicit este canalul comenzii.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("titlu")
      .setDescription("Titlul panoului de tichete.")
      .setMaxLength(256)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("prompt")
      .setDescription("Textul afișat în meniul «Alege categoria».")
      .setMaxLength(150)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("text")
      .setDescription("Textul afișat deasupra meniului de categorii.")
      .setMaxLength(4000)
      .setRequired(false))
    .addAttachmentOption((option) => option
      .setName("imagine")
      .setDescription("Imagine opțională pentru panou.")
      .setRequired(false))
    .addStringOption((option) => option
      .setName("nume2")
      .setDescription("Numele opțional al celei de-a doua categorii.")
      .setMaxLength(100)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("emoji2")
      .setDescription("Emojiul categoriei 2, dacă ai completat numele.")
      .setMaxLength(100)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("tip2")
      .setDescription("Alege dacă categoria 2 creează un ticket sau primește sugestii.")
      .addChoices(
        { name: "Ticket", value: "ticket" },
        { name: "Sugestie", value: "suggestion" }
      )
      .setRequired(false))
    .addStringOption((option) => option
      .setName("nume3")
      .setDescription("Numele opțional al celei de-a treia categorii.")
      .setMaxLength(100)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("emoji3")
      .setDescription("Emojiul categoriei 3, dacă ai completat numele.")
      .setMaxLength(100)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("tip3")
      .setDescription("Alege dacă categoria 3 creează un ticket sau primește sugestii.")
      .addChoices(
        { name: "Ticket", value: "ticket" },
        { name: "Sugestie", value: "suggestion" }
      )
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!(await requireAdministrator(interaction))) return;

    try {
      if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) {
        throw new Error("The command must be used in a text-based channel.");
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const category = interaction.options.getChannel("categorie");
      const staffRole = interaction.options.getRole("staff");
      const suggestionsChannel = interaction.options.getChannel("sugestii");
      const logChannel = interaction.options.getChannel("loguri");
      const panelChannel = interaction.options.getChannel("panou") || interaction.channel;
      const previousSettings = serverConfig.get(interaction.guildId);
      const ticketTitle = interaction.options.getString("titlu") ||
        previousSettings.ticketPanelTitle || "🎫 CREATE A TICKET";
      const ticketPrompt = interaction.options.getString("prompt") ||
        previousSettings.ticketPanelPrompt || "Alege categoria / Select a category";
      const ticketDescription = interaction.options.getString("text") ||
        previousSettings.ticketPanelDescription ||
        "Alege categoria potrivită din meniul de mai jos pentru a crea un tichet.";
      const ticketTypes = await parseTicketTypes(
        interaction.options,
        interaction.guild
      );
      const uploadedImage = interaction.options.getAttachment("imagine");
      const image = uploadedImage ? await downloadImage(uploadedImage) : null;
      const savedTypes = ticketTypes.map((type) => ({
        ...type,
        emoji: emojiForConfig(type.emoji)
      }));

      const patch = {
        ticketCategoryId: category.id,
        staffRoleIds: [staffRole.id],
        suggestionsChannelId: suggestionsChannel.id,
        ticketLogChannelId: logChannel?.id || null,
        ticketPanelChannelId: panelChannel.id,
        ticketPanelTitle: ticketTitle,
        ticketPanelDescription: ticketDescription,
        ticketPanelPrompt: ticketPrompt,
        ticketPanelMessageId: null,
        ticketTypes: savedTypes
      };
      serverConfig.update(interaction.guildId, patch);
      await cloudDashboardSync.pushServerPatch(interaction.guildId, patch);

      const embed = new EmbedBuilder()
        .setColor(0x0526da)
        .setTitle(ticketTitle)
        .setDescription(ticketDescription)
        .setFooter({ text: "MLDBOT Support Team" });

      const files = [];
      if (image) {
        const attachment = new AttachmentBuilder(image.buffer, {
          name: `ticket-banner${image.extension}`
        });
        embed.setImage(`attachment://${attachment.name}`);
        files.push(attachment);
      } else if (fs.existsSync(imagePath)) {
        const image = new AttachmentBuilder(imagePath, { name: "ticket-banner.jpeg" });
        embed.setImage("attachment://ticket-banner.jpeg");
        files.push(image);
      }

      const panelMessage = await panelChannel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
          createTicketMenu(ticketTypes, ticketPrompt)
        )],
        files,
      });
      serverConfig.update(interaction.guildId, {
        ticketPanelMessageId: panelMessage.id
      });
      await interaction.editReply({
        content: `Setările tichetelor au fost salvate. Panoul a fost trimis în ${panelChannel}.`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_add_category")
            .setLabel("Adaugă categorie")
            .setEmoji("➕")
            .setStyle(ButtonStyle.Secondary)
        )]
      });
    } catch (error) {
      console.error("Failed to send ticket panel:", error);
      const content = error instanceof Error
        ? error.message
        : "Nu am putut trimite panoul de tichete. Verifică permisiunile botului.";

      if (interaction.deferred) {
        await interaction.editReply(content);
      } else if (interaction.replied) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
  },
  getTicketTypes(settings = {}) {
    return Array.isArray(settings.ticketTypes) ? settings.ticketTypes : DEFAULT_TYPES;
  },
  parseTicketTypes,
  createTicketType,
  createTicketMenu,
};
