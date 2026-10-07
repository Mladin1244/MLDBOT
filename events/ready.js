const { registerCommands } = require('../utils/registerCommands');

module.exports = (client) => {
  client.once('ready', async () => {
    console.log(`Botul este conectat ca ${client.user.tag}.`);
    try {
      const count = await registerCommands({
        token: process.env.DISCORD_TOKEN || process.env.TOKEN,
        applicationId: client.application.id,
        guildId: process.env.GUILD_ID
      });
      console.log(`${count} comenzi slash au fost înregistrate după pornirea botului.`);
    } catch (error) {
      console.error('Înregistrarea automată a slash commands a eșuat:', error);
    }
  });
  client.on('error', (error) => console.error('Eroare Discord client:', error));
};
