function evaluateHand(cards) {
  const values = cards.map((card) => card.value).sort((a, b) => b - a);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);

  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const unique = [...new Set(values)].sort((a, b) => a - b);
  const wheel = unique.join(',') === '2,3,4,5,14';
  const straight = unique.length === 5 && (unique[4] - unique[0] === 4 || wheel);
  const straightHigh = wheel ? 5 : unique[4];

  if (straight && flush && straightHigh === 14) return { rank: 9, kickers: [14], label: 'Royal Flush' };
  if (straight && flush) return { rank: 8, kickers: [straightHigh], label: 'Straight Flush' };
  if (groups[0][1] === 4) return { rank: 7, kickers: [groups[0][0], groups[1][0]], label: 'Four of a Kind' };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { rank: 6, kickers: [groups[0][0], groups[1][0]], label: 'Full House' };
  if (flush) return { rank: 5, kickers: values, label: 'Flush' };
  if (straight) return { rank: 4, kickers: [straightHigh], label: 'Straight' };
  if (groups[0][1] === 3) return { rank: 3, kickers: [groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)], label: 'Three of a Kind' };
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = groups.slice(0, 2).map(([value]) => value).sort((a, b) => b - a);
    return { rank: 2, kickers: [...pairs, groups[2][0]], label: 'Two Pair' };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map(([value]) => value).sort((a, b) => b - a);
    return { rank: 1, kickers: [groups[0][0], ...kickers], label: 'Pair' };
  }
  return { rank: 0, kickers: values, label: 'High Card' };
}

function compareHands(a, b) {
  const left = evaluateHand(a);
  const right = evaluateHand(b);
  if (left.rank !== right.rank) return left.rank > right.rank ? 1 : -1;
  for (let i = 0; i < Math.max(left.kickers.length, right.kickers.length); i += 1) {
    const difference = (left.kickers[i] || 0) - (right.kickers[i] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  return 0;
}

module.exports = { evaluateHand, compareHands };
