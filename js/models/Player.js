// Player model representing Human and AI participants

export const PERSONALITIES = {
  BALANCED: {
    id: 'balanced',
    name: 'Duke Victor',
    archetype: 'The Aristocrat',
    tagline: 'Calculated, dignified, and unforgiving of petty thieves.',
    avatar: '👑',
    avatarBg: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
    bluffChance: 0.22,
    challengeThreshold: 0.55, // needs 55% suspicion to challenge
    blockChance: 0.65,
    aggression: 0.4
  },
  AGGRESSIVE: {
    id: 'aggressive',
    name: 'Lady Evelyn',
    archetype: 'The Viper',
    tagline: 'Ruthlessly eliminates rivals. Strikes swiftly with daggers.',
    avatar: '🗡️',
    avatarBg: 'linear-gradient(135deg, #dc2626, #991b1b)',
    bluffChance: 0.45,
    challengeThreshold: 0.42, // willing to gamble challenges
    blockChance: 0.80,
    aggression: 0.85
  },
  LOGICIAN: {
    id: 'logician',
    name: 'Lord Carlisle',
    archetype: 'The Mastermind',
    tagline: 'Card-counting genius. Computes exact mathematical probabilities.',
    avatar: '📜',
    avatarBg: 'linear-gradient(135deg, #059669, #065f46)',
    bluffChance: 0.15,
    challengeThreshold: 0.70, // only challenges when math is on his side
    blockChance: 0.55,
    aggression: 0.35
  },
  CHAOTIC: {
    id: 'chaotic',
    name: 'Rogue Silas',
    archetype: 'The Gambler',
    tagline: 'Loves high-stakes bluffs and sudden counter-attacks.',
    avatar: '🎭',
    avatarBg: 'linear-gradient(135deg, #d97706, #b45309)',
    bluffChance: 0.55,
    challengeThreshold: 0.38,
    blockChance: 0.75,
    aggression: 0.65
  }
};

export class Player {
  constructor(id, name, isHuman = false, personality = null) {
    this.id = id;
    this.name = name;
    this.isHuman = isHuman;
    this.personality = personality || PERSONALITIES.BALANCED;
    this.coins = 2; // In standard Coup, players start with 2 coins
    this.cards = []; // 2 influence cards initially
    this.stats = {
      coupsLaunched: 0,
      assassinations: 0,
      steals: 0,
      taxes: 0,
      challengesMade: 0,
      challengesWon: 0,
      bluffsMade: 0,
      bluffsCaught: 0
    };
  }

  get aliveCards() {
    return this.cards.filter(c => !c.revealed);
  }

  get revealedCards() {
    return this.cards.filter(c => c.revealed);
  }

  get isAlive() {
    return this.aliveCards.length > 0;
  }

  get influenceCount() {
    return this.aliveCards.length;
  }

  hasRole(role) {
    return this.aliveCards.some(c => c.role === role);
  }

  getCardByRole(role) {
    return this.aliveCards.find(c => c.role === role);
  }

  loseInfluence(cardId = null) {
    let targetCard = null;
    if (cardId) {
      targetCard = this.aliveCards.find(c => c.id === cardId);
    }
    if (!targetCard) {
      // Default to first alive card
      targetCard = this.aliveCards[0];
    }
    if (targetCard) {
      targetCard.reveal();
      return targetCard;
    }
    return null;
  }

  addCoins(amount) {
    this.coins = Math.max(0, this.coins + amount);
    return this.coins;
  }

  removeCoins(amount) {
    this.coins = Math.max(0, this.coins - amount);
    return this.coins;
  }

  canAfford(cost) {
    return this.coins >= cost;
  }

  mustCoup() {
    // Official Coup rule: if a player has 10 or more coins, they MUST Coup
    return this.coins >= 10;
  }
}
