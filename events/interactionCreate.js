const { commandsByName } = require('../interactions/commands');
const { recordPublicCommand } = require('../utils/levelEvents');
const { PUBLIC_COMMANDS } = require('../commands');

module.exports = (client, services) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commandsByName.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, { ...services, client, prefix: process.env.PREFIX || '!' });
      if (PUBLIC_COMMANDS.includes(interaction.commandName)) {
        await recordPublicCommand(
          interaction.guild,
          interaction.user,
          interaction.commandName,
          interaction.channel
        );
      }
    } catch (error) {
      console.error(`Eroare la comanda slash /${interaction.commandName}:`, error);
      const reply = { content: 'Comanda nu a putut fi executată. Verifică permisiunile botului și încearcă din nou.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });
};
