const { PermissionFlagsBits } = require('discord.js');
const { numberArg } = require('./economy');
const { embed, credits } = require('../utils/discord');

function isAdmin(ctx) {
  const owners = (process.env.OWNER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  return owners.includes(ctx.message.author.id) ||
    Boolean(ctx.message.member?.permissions.has(PermissionFlagsBits.ManageGuild));
}

async function execute(command, ctx) {
  try {
    if (!['admin_add_credits', 'admin_remove_credits', 'admin_reset'].includes(command)) return;
    if (!isAdmin(ctx)) throw new Error('Această comandă este disponibilă doar administratorilor serverului sau owner-ului botului.');
    const target = ctx.message.mentions.users.first();
    if (!target || target.bot) throw new Error('Menționează un utilizator uman.');

    if (command === 'admin_reset') {
      ctx.db.reset(target.id, target.username);
      await ctx.message.reply({ embeds: [embed('🔄 Cont resetat', `${target} are acum 1.000 de credite.`, 0xe67e22)] });
      return;
    }

    const amount = numberArg(ctx.args.find((arg) => /^\d+$/.test(arg)));
    const change = command === 'admin_add_credits' ? amount : -amount;
    ctx.db.adminChange(target.id, target.username, change);
    const balance = ctx.db.getBalance(target.id, target.username);
    await ctx.message.reply({ embeds: [embed('✅ Sold actualizat',
      `${target} ${change > 0 ? 'a primit' : 'a pierdut'} **${credits(amount)}** credite. Sold: **${credits(balance)}**.`, 0x2ecc71)] });
  } catch (error) {
    await ctx.message.reply(`❌ ${error.message}`);
  }
}

module.exports = { execute };
