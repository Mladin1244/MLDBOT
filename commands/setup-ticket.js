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

const imagePath = path.join(__dirname, "..", "assets", "mldbot-ticket.jpg");

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

      const patch = {
        ticketCategoryId: category.id,
        staffRoleIds: [staffRole.id],
        suggestionsChannelId: suggestionsChannel.id,
        ticketLogChannelId: logChannel?.id || null,
        ticketPanelChannelId: panelChannel.id
      };
      serverConfig.update(interaction.guildId, patch);
      await cloudDashboardSync.pushServerPatch(interaction.guildId, patch);

      const embed = new EmbedBuilder()
        .setColor(0x0526da)
        .setTitle("🎫 CREATE A TICKET")
        .setDescription(
          "Alege categoria potrivită din meniul de mai jos pentru a crea un tichet. " +
            "Selectează Game Bug, Game Cheater sau Game Suggestions.\n\n" +
            "Choose the appropriate category below to create a ticket. " +
            "Select Game Bug, Game Cheater, or Game Suggestions.\n\n" +
            "Tichetele false sau spam nu sunt permise. / False or spam tickets are not allowed.",
        )
        .setFooter({ text: "MLDBOT Support Team" });

      const files = [];
      if (fs.existsSync(imagePath)) {
        const image = new AttachmentBuilder(imagePath, { name: "ticket-banner.jpeg" });
        embed.setImage("attachment://ticket-banner.jpeg");
        files.push(image);
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_menu")
        .setPlaceholder("Alege categoria / Select a category")
        .addOptions(
          {
            label: "𝐆𝐚𝐦𝐞 𝐁𝐮𝐠",
            value: "bug",
            emoji: "<a:important:1556685194516373504>",
            description: "Raportează un bug / Report a bug",
          },
          {
            label: "𝐆𝐚𝐦𝐞 𝐂𝐡𝐞𝐚𝐭𝐞𝐫",
            value: "cheater",
            emoji: "<:dogcry:1556684667900534904>",
            description: "Raportează un cheater / Report a cheater",
          },
          {
            label: "𝐆𝐚𝐦𝐞 𝐒𝐮𝐠𝐠𝐞𝐬𝐭𝐢𝐨𝐧𝐬",
            value: "suggestion",
            emoji: "<:suggest:1556689503731589120>",
            description: "Trimite o sugestie / Send a suggestion",
          },
        );

      await panelChannel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
        files,
      });
      await interaction.editReply(
        `Setările tichetelor au fost salvate. Panoul a fost trimis în ${panelChannel}.`
      );
    } catch (error) {
      console.error("Failed to send ticket panel:", error);
      const content = "Nu am putut trimite panoul de tichete. Verifică permisiunile botului.";

      if (interaction.deferred) {
        await interaction.editReply(content);
      } else if (interaction.replied) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
  },
};
