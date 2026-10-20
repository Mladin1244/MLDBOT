const {
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  ActionRowBuilder,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const serverConfig = require("../utils/serverConfig");
const cloudDashboardSync = require("../utils/cloudDashboardSync");
const { requireAdministrator } = require("../utils/requireAdministrator");
const { downloadImage, resolveServerEmoji } = require("../utils/setupAssets");

function emojiForConfig(emoji) {
  return typeof emoji === "string"
    ? emoji
    : `${emoji.animated ? "<a:" : "<:"}${emoji.name}:${emoji.id}>`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-verify")
    .setDescription("Configurează rolul și trimite mesajul de verificare în acest canal.")
    .addRoleOption((option) => option
      .setName("rol")
      .setDescription("Rolul acordat membrilor după verificare.")
      .setRequired(true))
    .addStringOption((option) => option
      .setName("titlu")
      .setDescription("Titlul mesajului de verificare.")
      .setMaxLength(256)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("text")
      .setDescription("Textul afișat în mesajul de verificare.")
      .setMaxLength(4000)
      .setRequired(false))
    .addAttachmentOption((option) => option
      .setName("imagine")
      .setDescription("Imaginea afișată în mesajul de verificare.")
      .setRequired(false))
    .addStringOption((option) => option
      .setName("emoji")
      .setDescription("Emojiul butonului (Unicode sau emoji personalizat din server).")
      .setMaxLength(100)
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!(await requireAdministrator(interaction))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) {
        throw new Error("The command must be used in a text-based channel.");
      }
      const role = interaction.options.getRole("rol");
      if (!(role instanceof Role) || role.id === interaction.guild.id) {
        throw new Error("A valid, assignable verification role must be selected.");
      }
      const previousSettings = serverConfig.get(interaction.guildId);
      const title = interaction.options.getString("titlu") ||
        previousSettings.verifyTitle || "☑️ Verificare MLDBOT ☑️";
      const description = interaction.options.getString("text") ||
        previousSettings.verifyDescription || [
          "———————————",
          "➤ Bun venit pe canalul de Verificare",
          "➤ Pentru acces, dă click pe Butonul acces de mai jos",
          "➤ Citește Regulile Serverului după ce ai fost verificat",
          "➤ Adaugă prietenii tai pe Serverul nostru",
          "———————————",
          "",
          "**☑️ MLDBOT Verify ☑️**",
          "",
          "———————————",
          "➤ Welcome to the Verify Channel",
          "➤ To gain access, click the enabled Button below",
          "➤ Read the Server Rules once you get Verified",
          "➤ Add your friends in our Server",
          "———————————",
        ].join("\n");
      const configuredEmoji = interaction.options.getString("emoji");
      const buttonEmoji = configuredEmoji
        ? emojiForConfig(await resolveServerEmoji(interaction.guild, configuredEmoji))
        : previousSettings.verifyEmoji || "✅";
      const uploadedImage = interaction.options.getAttachment("imagine");
      const image = uploadedImage ? await downloadImage(uploadedImage) : null;
      const imagePath = path.join(__dirname, "..", "assets", "mldbot-verify.jpg");
      if (!image && !fs.existsSync(imagePath)) {
        throw new Error("Imaginea de verificare lipsește. Încarcă o imagine cu opțiunea imagine.");
      }

      const patch = {
        verifyChannelId: interaction.channel.id,
        verifyRoleId: role.id,
        verifyTitle: title,
        verifyDescription: description,
        verifyEmoji: buttonEmoji
      };
      serverConfig.update(interaction.guildId, patch);
      await cloudDashboardSync.pushServerPatch(interaction.guildId, patch);

      const banner = image
        ? new AttachmentBuilder(image.buffer, { name: `verify-banner${image.extension}` })
        : new AttachmentBuilder(imagePath, { name: "verify.jpeg" });
      const footer = image
        ? new AttachmentBuilder(image.buffer, { name: `verify-footer${image.extension}` })
        : new AttachmentBuilder(imagePath, { name: "footer.jpeg" });
      const imageName = image ? `verify-banner${image.extension}` : "verify.jpeg";
      const footerName = image ? `verify-footer${image.extension}` : "footer.jpeg";
      const embed = new EmbedBuilder()
        .setColor(0x0526da)
        .setTitle(title)
        .setDescription(description)
        .setImage(`attachment://${imageName}`)
        .setFooter({
          text: "MLDBOT Verify Message",
          iconURL: `attachment://${footerName}`,
        });

      const button = new ButtonBuilder()
        .setCustomId("verify_button")
        .setLabel("Verificare / Verify")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(buttonEmoji);

      await interaction.channel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
        files: [banner, footer],
      });

      await interaction.editReply("Mesajul de verificare a fost trimis.");
    } catch (error) {
      console.error("Failed to send verification message:", error);
      await interaction.editReply(
        error instanceof Error
          ? error.message
          : "Nu am putut trimite mesajul de verificare. Verifică permisiunile și configurația botului.",
      );
    }
  },
};
