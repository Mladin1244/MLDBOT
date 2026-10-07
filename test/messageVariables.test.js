const test = require('node:test');
const assert = require('node:assert/strict');
const { MESSAGE_VARIABLES, replaceMessageVariables } = require('../utils/messageVariables');

test('înlocuiește valorile disponibile și oferă fallback pentru variabile necunoscute', () => {
  const result = replaceMessageVariables(
    '%member_name% · %inviter% · %inviter_invites% · %joined_duration%',
    {
      '%member_name%': 'Ana',
      '%inviter_invites%': 0,
      '%joined_duration%': '2 zile'
    }
  );
  assert.equal(result, 'Ana · necunoscut · 0 · 2 zile');
});

test('lista partajată de variabile conține fiecare token documentat', () => {
  assert.deepEqual(MESSAGE_VARIABLES, [
    '%member_mention%', '%member_name%', '%member_tag%', '%member_id%', '%member_avatar%',
    '%server_name%', '%member_count%', '%inviter%', '%inviter_mention%', '%inviter_id%',
    '%inviter_invites%', '%invite_code%', '%account_age%', '%joined_duration%'
  ]);
});
