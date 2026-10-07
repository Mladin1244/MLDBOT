const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBanner } = require('../utils/bannerRenderer');

test('randează straturi de banner în dimensiunea fixă 1024×320', async () => {
  const output = await renderBanner('12345678901234567', {
    bannerLayers: [
      { type: 'rect', x: 0, y: 0, width: 1024, height: 320, color: '#112233' },
      { type: 'text', x: 20, y: 20, width: 500, height: 80, text: 'Salut %member_name%', font: 'Arial', fontSize: 32, color: '#ffffff', align: 'left' }
    ]
  }, { user: { username: 'Ana' }, displayName: 'Ana' }, { '%member_name%': 'Ana' });

  assert.equal(output.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(output.readUInt32BE(16), 1024);
  assert.equal(output.readUInt32BE(20), 320);
});
