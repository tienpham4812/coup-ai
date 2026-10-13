import { ROLES, Card } from './Card.js';

export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    // 3 copies of each role in standard Coup
    const roles = [
      ROLES.DUKE,
      ROLES.ASSASSIN,
      ROLES.CAPTAIN,
      ROLES.AMBASSADOR,
      ROLES.CONTESSA
    ];

    roles.forEach(role => {
      for (let i = 0; i < 3; i++) {
        this.cards.push(new Card(role, `deck_${role}_${i}_${Date.now()}_${Math.random()}`));
      }
    });

    this.shuffle();
  }

  shuffle() {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(count = 1) {
    if (this.cards.length < count) {
      console.warn(`Deck has only ${this.cards.length} cards, requested ${count}`);
    }
    const drawn = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      drawn.push(this.cards.pop());
    }
    return drawn;
  }

  returnCards(cards, reshuffle = true) {
    if (!Array.isArray(cards)) cards = [cards];
    cards.forEach(card => {
      // Ensure card is not marked as revealed when going back into court deck
      card.revealed = false;
      this.cards.push(card);
    });
    if (reshuffle) {
      this.shuffle();
    }
  }

  get remaining() {
    return this.cards.length;
  }
}
