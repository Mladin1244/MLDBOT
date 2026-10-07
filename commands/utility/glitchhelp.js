const { presentHelp } = require('../../utils/help');

async function execute(ctx) {
  const switchLanguage = ctx.args[0]?.toLowerCase() === 'switch';
  const category = switchLanguage ? undefined : ctx.args[0]?.toLowerCase();
  await presentHelp({
    source: ctx.message,
    category,
    client: ctx.client,
    prefix: ctx.prefix,
    db: ctx.db,
    switchLanguage
  });
}

module.exports = { execute };
