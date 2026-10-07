require('dotenv').config();
const { registerCommands } = require('./utils/registerCommands');

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
const applicationId = process.env.APPLICATION_ID || process.env.CLIENT_ID;
const { GUILD_ID } = process.env;
if (!token || !applicationId) {
  throw new Error('Setează DISCORD_TOKEN (sau TOKEN) și CLIENT_ID (sau APPLICATION_ID) în .env înainte să înregistrezi comenzile slash.');
}

registerCommands({ token, applicationId, guildId: GUILD_ID })
  .then((count) => console.log(`${count} comenzi slash înregistrate ${GUILD_ID ? `în serverul ${GUILD_ID}` : 'global'}.`))
  .catch((error) => {
    console.error('Înregistrarea slash commands a eșuat:', error);
    process.exitCode = 1;
  });
