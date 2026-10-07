const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mldbot-test-'));
process.env.DATA_FILE = path.join(temporaryDirectory, 'database.json');
const db = require('../db');
const { evaluateHand, compareHands } = require('../games/handRanking');
const { value: blackjackValue, payoutFor } = require('../games/blackjack');

function hand(values, suitNames) {
  return values.map((value, index) => ({
    value,
    suit: suitNames ? suitNames[index] : '♠️'
  }));
}

test('classifică toate categoriile de mâini și wheel straight', () => {
  assert.equal(evaluateHand(hand([14, 13, 12, 11, 10])).label, 'Royal Flush');
  assert.equal(evaluateHand(hand([9, 8, 7, 6, 5])).label, 'Straight Flush');
  assert.equal(evaluateHand(hand([14, 14, 14, 14, 2], ['♠️', '♥️', '♦️', '♣️', '♠️'])).label, 'Four of a Kind');
  assert.equal(evaluateHand(hand([10, 10, 10, 4, 4], ['♠️', '♥️', '♦️', '♣️', '♠️'])).label, 'Full House');
  assert.equal(evaluateHand(hand([14, 11, 8, 5, 2], ['♠️', '♠️', '♠️', '♠️', '♠️'])).label, 'Flush');
  assert.equal(evaluateHand(hand([14, 2, 3, 4, 5], ['♠️', '♥️', '♦️', '♣️', '♠️'])).label, 'Straight');
  assert.equal(evaluateHand(hand([7, 7, 7, 4, 2], ['♠️', '♥️', '♦️', '♣️', '♠️'])).label, 'Three of a Kind');
  assert.equal(evaluateHand(hand([7, 7, 4, 4, 2], ['♠️', '♥️', '♦️', '♣️', '♠️'])).label, 'Two Pair');
  assert.equal(evaluateHand(hand([7, 7, 14, 4, 2], ['♠️', '♥️', '♦️', '♣️', '♠️'])).label, 'Pair');
  assert.equal(evaluateHand(hand([14, 11, 8, 5, 2], ['♠️', '♥️', '♦️', '♣️', '♠️'])).label, 'High Card');
});

test('compară egalitățile după kicker', () => {
  const pairOfAces = hand([14, 14, 13, 8, 3], ['♠️', '♥️', '♦️', '♣️', '♠️']);
  const pairOfAcesLowerKicker = hand([14, 14, 12, 8, 3], ['♦️', '♣️', '♠️', '♥️', '♦️']);
  assert.equal(compareHands(pairOfAces, pairOfAcesLowerKicker), 1);
});

test('calculează corect valorile Blackjack cu ași flexibili', () => {
  assert.equal(blackjackValue([{ value: 14 }, { value: 9 }]), 20);
  assert.equal(blackjackValue([{ value: 14 }, { value: 9 }, { value: 5 }]), 15);
  assert.equal(blackjackValue([{ value: 13 }, { value: 12 }, { value: 10 }]), 30);
});

test('plătește blackjack natural la 3:2', () => {
  assert.equal(payoutFor('natural', 100), 250);
  assert.equal(payoutFor('win', 100), 200);
  assert.equal(payoutFor('push', 100), 100);
  assert.equal(payoutFor('loss', 100), 0);
});

test('rezervă, decontează și persistă soldul și statisticile', () => {
  db.initialize();
  db.reserve([{ id: 'player-a', username: 'A' }, { id: 'player-b', username: 'B' }], 200);
  assert.equal(db.getBalance('player-a', 'A'), 800);
  db.settle([
    { id: 'player-a', username: 'A', amount: 400, result: 'win', profit: 200 },
    { id: 'player-b', username: 'B', amount: 0, result: 'loss', profit: -200 }
  ]);
  assert.equal(db.getBalance('player-a', 'A'), 1200);
  assert.equal(db.getUser('player-a', 'A').stats.wins, 1);
  assert.equal(db.getUser('player-b', 'B').stats.profit, -200);
  db.initialize();
  assert.equal(db.getBalance('player-a', 'A'), 1200);
});

test('daily poate fi revendicat o singură dată în 24 de ore', () => {
  const start = 1_800_000_000_000;
  assert.equal(db.daily('daily-user', 'Daily', start, 86400000).claimed, true);
  assert.equal(db.daily('daily-user', 'Daily', start + 86399999, 86400000).claimed, false);
  assert.equal(db.daily('daily-user', 'Daily', start + 86400000, 86400000).claimed, true);
  assert.equal(db.getBalance('daily-user', 'Daily'), 1200);
});

test('refuză transferul insuficient fără să schimbe soldurile', () => {
  assert.throws(() => db.transfer('player-a', 'A', 'player-b', 'B', 999999), /suficiente credite/);
  assert.equal(db.getBalance('player-a', 'A'), 1200);
});

test('salvează preferința de limbă în profil și o păstrează după reîncărcare', () => {
  db.setLanguage('language-user', 'Language User', 'ro');
  assert.equal(db.getUser('language-user', 'Language User').language, 'ro');
  db.initialize();
  assert.equal(db.getUser('language-user', 'Language User').language, 'ro');
  assert.throws(() => db.setLanguage('language-user', 'Language User', 'fr'), /ro.*en/);
});

test.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
