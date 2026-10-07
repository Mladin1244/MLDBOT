const { handleMessage } = require('../commands');
const { recordChatMessage, recordPublicCommand } = require('../utils/levelEvents');

module.exports = (client, services) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    try {
      await recordChatMessage(message);
      await handleMessage(message, {
        ...services,
        client,
        onPublicCommand: (commandName) => recordPublicCommand(
          message.guild,
          message.author,
          commandName,
          message.channel
        )
      });
    } catch (error) {
      console.error('Eroare la procesarea mesajului:', error);
      await message.reply('A apărut o eroare neașteptată. Încearcă din nou.');
    }
  });
};
