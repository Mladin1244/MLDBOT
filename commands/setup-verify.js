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

function getButtonEmoji() {
  return "<:verify:1556683750660898886>";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-verify")
    .setDescription("Configurează rolul și trimite mesajul de verificare în acest canal.")
    .addRoleOption((option) => option
      .setName("rol")
      .setDescription("Rolul acordat membrilor după verificare.")
      .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!(await requireAdministrator(interaction))) return;

    const imagePath = path.join(__dirname, "..", "assets", "mldbot-verify.jpg");
    if (!fs.existsSync(imagePath)) {
      console.error(`Verification image is missing: ${imagePath}`);
      await interaction.reply({
        content: "Imaginea de verificare lipsește. Adaugă mldbot-verify.jpg în folderul assets.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const banner = new AttachmentBuilder(imagePath, { name: "verify.jpeg" });
    const footer = new AttachmentBuilder(imagePath, { name: "footer.jpeg" });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) {
        throw new Error("The command must be used in a text-based channel.");
      }
      const role = interaction.options.getRole("rol");
      if (!(role instanceof Role) || role.id === interaction.guild.id) {
        throw new Error("A valid, assignable verification role must be selected.");
      }
      const patch = {
        verifyChannelId: interaction.channel.id,
        verifyRoleId: role.id
      };
      serverConfig.update(interaction.guildId, patch);
      await cloudDashboardSync.pushServerPatch(interaction.guildId, patch);

      const embed = new EmbedBuilder()
        .setColor(0x0526da)
        .setTitle("☑️ Verificare MLDBOT ☑️")
        .setDescription(
          [
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
          ].join("\n"),
        )
        .setImage("attachment://verify.jpeg")
        .setFooter({
          text: "MLDBOT Verify Message",
          iconURL: "attachment://footer.jpeg",
        });

      const button = new ButtonBuilder()
        .setCustomId("verify_button")
        .setLabel("Verificare / Verify")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getButtonEmoji());

      await interaction.channel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
        files: [banner, footer],
      });

      await interaction.editReply("Mesajul de verificare a fost trimis.");
    } catch (error) {
      console.error("Failed to send verification message:", error);
      await interaction.editReply(
        "Nu am putut trimite mesajul de verificare. Verifică permisiunile și configurația botului.",
      );
    }
  },
};
