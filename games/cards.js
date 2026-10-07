const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function deck() {
  return SUITS.flatMap((suit) => RANKS.map((rank, index) => ({
    suit,
    rank,
    value: index + 2,
    text: `${rank}${suit}`
  })));
}

function shuffledDeck() {
  const cards = deck();
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function cardText(cards) {
  return cards.map((card) => card.text).join('  ');
}

module.exports = { shuffledDeck, cardText };
