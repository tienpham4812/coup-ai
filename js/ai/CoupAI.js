// Coup AI Decision Engine with Probability Calculation, Deduction & Personality Profiles
import { ROLES, ROLE_INFO, GENERAL_ACTIONS } from '../models/Card.js';

export class CoupAI {
  constructor(player, gameEngine) {
    this.player = player;
    this.game = gameEngine;
    this.personality = player.personality;
    this.thoughtLog = [];
  }

  logThought(message) {
    const entry = `[${this.player.name}] ${message}`;
    this.thoughtLog.push({
      time: Date.now(),
      text: message,
      playerName: this.player.name
    });
    // Limit thought log size
    if (this.thoughtLog.length > 50) this.thoughtLog.shift();
  }

  getRecentThoughts(count = 5) {
    return this.thoughtLog.slice(-count);
  }

  // --- Probability Engine ---

  /**
   * Count known copies of a role (in AI's hand + dead on table)
   */
  getKnownRoleCount(role) {
    // 1. In AI's active hand
    const inHand = this.player.aliveCards.filter(c => c.role === role).length;
    // 2. Dead/revealed across all players
    let revealed = 0;
    this.game.players.forEach(p => {
      revealed += p.revealedCards.filter(c => c.role === role).length;
    });
    return inHand + revealed;
  }

  /**
   * Remaining copies of role in unknown pool (other players' hands + court deck)
   */
  getRemainingRoleCount(role) {
    const known = this.getKnownRoleCount(role);
    return Math.max(0, 3 - known);
  }

  /**
   * Total unknown cards in the game from AI's perspective
   */
  getTotalUnknownCards() {
    let revealedTotal = 0;
    this.game.players.forEach(p => {
      revealedTotal += p.revealedCards.length;
    });
    const myHandCount = this.player.aliveCards.length;
    return Math.max(1, 15 - revealedTotal - myHandCount);
  }

  /**
   * Hypergeometric probability that a player holding handSize cards has at least 1 of role
   */
  calculateProbabilityPlayerHasRole(targetPlayer, role) {
    const remainingRole = this.getRemainingRoleCount(role);
    if (remainingRole <= 0) return 0.0;

    const totalUnknown = this.getTotalUnknownCards();
    const handSize = targetPlayer.aliveCards.length;

    if (totalUnknown < handSize) return 0.0;

    // Hypergeometric P(X >= 1) = 1 - (comb(totalUnknown - remainingRole, handSize) / comb(totalUnknown, handSize))
    const nonRoleUnknown = Math.max(0, totalUnknown - remainingRole);
    if (nonRoleUnknown < handSize) {
      // Must have at least one!
      return 1.0;
    }

    const combTotal = this._combinations(totalUnknown, handSize);
    const combNone = this._combinations(nonRoleUnknown, handSize);

    if (combTotal <= 0) return 0.0;
    const probNone = combNone / combTotal;
    return Math.max(0, Math.min(1, 1 - probNone));
  }

  _combinations(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    if (k > n / 2) k = n - k;
    let res = 1;
    for (let i = 1; i <= k; i++) {
      res = (res * (n - i + 1)) / i;
    }
    return Math.round(res);
  }

  // --- Target Selection ---

  getOpponents() {
    return this.game.players.filter(p => p.id !== this.player.id && p.isAlive);
  }

  selectBestTarget(actionType = 'attack') {
    const opponents = this.getOpponents();
    if (opponents.length === 0) return null;

    // Rank opponents based on threat level
    const scoredOpponents = opponents.map(opp => {
      let score = 0;

      // 1. Coin threat: someone with 7+ coins is about to Coup!
      if (opp.coins >= 7) score += 60 + (opp.coins - 7) * 15;
      else if (opp.coins >= 3) score += 25 + opp.coins * 5;

      // 2. Influence: 2 cards is stronger than 1 card
      if (opp.influenceCount === 2) score += 20;

      // 3. Human threat priority (humans are unpredictable and clever)
      if (opp.isHuman) score += 15;

      // 4. If action is Steal: prefer players with at least 2 coins
      if (actionType === 'steal') {
        if (opp.coins >= 2) score += 50;
        else if (opp.coins === 1) score += 15;
        else score -= 1000; // Do not steal from 0 coins

        // Check if target is likely to have Captain or Ambassador to block
        const blockProb = Math.max(
          this.calculateProbabilityPlayerHasRole(opp, ROLES.CAPTAIN),
          this.calculateProbabilityPlayerHasRole(opp, ROLES.AMBASSADOR)
        );
        score -= blockProb * 35;
      }

      // 5. If action is Assassinate: prefer targets less likely to have Contessa
      if (actionType === 'assassinate') {
        const contessaProb = this.calculateProbabilityPlayerHasRole(opp, ROLES.CONTESSA);
        score -= contessaProb * 40;
        // Prioritize killing a player with 1 card for instant elimination
        if (opp.influenceCount === 1) score += 35;
      }

      // 6. Personality modifier
      if (this.personality.id === 'aggressive' && opp.isHuman) {
        score += 20;
      }

      return { player: opp, score };
    });

    // Filter out invalid targets for steal
    const valid = scoredOpponents.filter(item => item.score > -500);
    const pool = valid.length > 0 ? valid : scoredOpponents;

    pool.sort((a, b) => b.score - a.score);
    return pool[0].player;
  }

  // --- Main Turn Decision ---

  chooseTurnAction() {
    const coins = this.player.coins;
    const hasDuke = this.player.hasRole(ROLES.DUKE);
    const hasAssassin = this.player.hasRole(ROLES.ASSASSIN);
    const hasCaptain = this.player.hasRole(ROLES.CAPTAIN);
    const hasAmbassador = this.player.hasRole(ROLES.AMBASSADOR);
    const opponents = this.getOpponents();

    // 1. Mandatory Coup at 10+ coins
    if (this.player.mustCoup()) {
      const target = this.selectBestTarget('coup');
      this.logThought(`Mandatory Coup! Launching Coup against ${target.name}.`);
      return { actionId: 'coup', targetId: target.id, roleClaim: null };
    }

    // 2. Can Coup at 7+ coins?
    if (coins >= 7) {
      // Aggressive or high threat opponents makes Coup almost always optimal
      const threatTarget = this.selectBestTarget('coup');
      this.logThought(`Sufficient treasury (${coins} coins). Executing Coup on ${threatTarget.name}.`);
      return { actionId: 'coup', targetId: threatTarget.id, roleClaim: null };
    }

    // Candidate actions
    const candidates = [];

    // Assassinate option (requires 3 coins)
    if (coins >= 3) {
      const target = this.selectBestTarget('assassinate');
      if (target) {
        const contessaProb = this.calculateProbabilityPlayerHasRole(target, ROLES.CONTESSA);
        let weight = 0;
        if (hasAssassin) {
          // Genuine Assassin
          weight = 65 - (contessaProb * 25);
          if (target.influenceCount === 1) weight += 20; // Finish off
        } else {
          // Bluffing Assassin
          const bluffRoll = Math.random();
          if (bluffRoll < this.personality.bluffChance && contessaProb < 0.6) {
            weight = 40 * this.personality.aggression;
          }
        }
        if (weight > 0) {
          candidates.push({
            actionId: 'assassinate',
            targetId: target.id,
            roleClaim: ROLES.ASSASSIN,
            weight,
            reason: hasAssassin ? `Assassinating ${target.name} with true Assassin.` : `Bluffing Assassin against ${target.name}!`
          });
        }
      }
    }

    // Tax option (+3 coins)
    {
      const remainingDukes = this.getRemainingRoleCount(ROLES.DUKE);
      let weight = 0;
      if (hasDuke) {
        weight = 55;
      } else {
        // Bluff Duke
        const dukeDeadOrInHand = this.getKnownRoleCount(ROLES.DUKE);
        if (dukeDeadOrInHand < 3 && Math.random() < this.personality.bluffChance * 1.2) {
          weight = 35 * (3 - dukeDeadOrInHand);
        }
      }
      if (weight > 0) {
        candidates.push({
          actionId: 'tax',
          targetId: null,
          roleClaim: ROLES.DUKE,
          weight,
          reason: hasDuke ? 'Collecting 3 coins Tax with Duke.' : 'Bluffing Duke for 3 coins Tax.'
        });
      }
    }

    // Steal option (Captain)
    {
      const target = this.selectBestTarget('steal');
      if (target && target.coins > 0) {
        let weight = 0;
        if (hasCaptain) {
          weight = 45 + target.coins * 8;
        } else {
          if (Math.random() < this.personality.bluffChance) {
            weight = 30 + target.coins * 5;
          }
        }
        if (weight > 0) {
          candidates.push({
            actionId: 'steal',
            targetId: target.id,
            roleClaim: ROLES.CAPTAIN,
            weight,
            reason: hasCaptain ? `Stealing from ${target.name} with Captain.` : `Bluffing Captain to rob ${target.name}.`
          });
        }
      }
    }

    // Exchange option (Ambassador)
    {
      let weight = 0;
      if (hasAmbassador) {
        weight = 25; // Useful to reshape hand
        // If holding duplicate or weak cards, exchange is more valuable
        if (this.player.aliveCards.length === 2 && this.player.aliveCards[0].role === this.player.aliveCards[1].role) {
          weight += 20;
        }
      } else {
        if (Math.random() < this.personality.bluffChance * 0.4) {
          weight = 15;
        }
      }
      if (weight > 0) {
        candidates.push({
          actionId: 'exchange',
          targetId: null,
          roleClaim: ROLES.AMBASSADOR,
          weight,
          reason: hasAmbassador ? 'Exchanging cards with Court Deck.' : 'Bluffing Ambassador to cycle cards.'
        });
      }
    }

    // Foreign Aid option (+2 coins)
    {
      // Check if any opponent is likely to Duke-block
      let maxDukeProb = 0;
      opponents.forEach(opp => {
        const prob = this.calculateProbabilityPlayerHasRole(opp, ROLES.DUKE);
        if (prob > maxDukeProb) maxDukeProb = prob;
      });

      const remainingDukes = this.getRemainingRoleCount(ROLES.DUKE);
      let weight = 30;
      if (remainingDukes === 0) {
        weight = 75; // Nobody has Duke! Foreign Aid is guaranteed +2 coins!
      } else {
        weight -= maxDukeProb * 30;
      }
      if (weight > 0) {
        candidates.push({
          actionId: 'foreign_aid',
          targetId: null,
          roleClaim: null,
          weight: Math.max(10, weight),
          reason: remainingDukes === 0 ? 'Foreign Aid is completely safe (all Dukes accounted for)!' : 'Taking Foreign Aid (+2 coins).'
        });
      }
    }

    // Income option (+1 coin, guaranteed)
    candidates.push({
      actionId: 'income',
      targetId: null,
      roleClaim: null,
      weight: 15,
      reason: 'Taking safe 1 coin Income.'
    });

    // Pick candidate with weighted random
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = candidates[0];

    for (const cand of candidates) {
      rand -= cand.weight;
      if (rand <= 0) {
        chosen = cand;
        break;
      }
    }

    this.logThought(chosen.reason);
    return chosen;
  }

  // --- Deciding Challenges ---

  /**
   * Decide whether to challenge a player's action claim or block claim
   * @param {Object} claim - { claimant: Player, role: string, isBlock: boolean, originalAction: string }
   */
  shouldChallenge(claim) {
    const { claimant, role, isBlock } = claim;
    const remainingRole = this.getRemainingRoleCount(role);

    // 1. Absolutely 0 remaining copies of role in unknown pool: GUARANTEED BLUFF!
    if (remainingRole === 0) {
      this.logThought(`CHALLENGE! I hold or have seen all 3 ${role} cards. ${claimant.name} is 100% bluffing!`);
      return true;
    }

    // 2. Probability that claimant holds the claimed role
    const probHasRole = this.calculateProbabilityPlayerHasRole(claimant, role);
    const bluffProb = 1 - probHasRole;

    // 3. AI's own vulnerability
    const myInfluence = this.player.influenceCount;
    const threshold = this.personality.challengeThreshold;

    // If AI only has 1 influence left, losing a challenge means ELIMINATION! Be very conservative.
    if (myInfluence === 1 && bluffProb < 0.88) {
      this.logThought(`Suspect ${claimant.name} (${(bluffProb * 100).toFixed(0)}% bluff prob), but I have only 1 card left. Too risky to challenge.`);
      return false;
    }

    // If claimant is directly attacking this AI (Assassinate or Steal)
    let attackModifier = 0;
    if (claim.targetId === this.player.id) {
      attackModifier = 0.15; // More willing to challenge direct threat
    }

    // Logician is purely math driven
    if (this.personality.id === 'logician') {
      const mathDecision = bluffProb >= (threshold - attackModifier);
      this.logThought(`Calculated ${(bluffProb * 100).toFixed(0)}% bluff probability for ${claimant.name}'s ${role}. Decision: ${mathDecision ? 'CHALLENGE' : 'PASS'}.`);
      return mathDecision;
    }

    // Aggressive & Chaotic gamble more
    const finalScore = bluffProb + attackModifier + (Math.random() * 0.2 - 0.1);
    const decision = finalScore >= threshold;

    if (decision) {
      this.logThought(`Calling bluff on ${claimant.name}'s ${role}! (Estimated ${(bluffProb * 100).toFixed(0)}% bluff probability).`);
    }
    return decision;
  }

  // --- Deciding Blocks (Counteraction) ---

  /**
   * Decide whether this AI should attempt to block an incoming action
   * @param {Object} action - { actor: Player, actionId: string, targetId: string }
   */
  shouldBlock(action) {
    const { actor, actionId, targetId } = action;

    // Foreign Aid: any player can block claiming Duke
    if (actionId === 'foreign_aid') {
      const hasDuke = this.player.hasRole(ROLES.DUKE);
      if (hasDuke) {
        // Honest block with Duke
        const should = Math.random() < this.personality.blockChance;
        if (should) this.logThought(`Blocking ${actor.name}'s Foreign Aid with Duke.`);
        return should ? ROLES.DUKE : null;
      } else {
        // Bluff Duke block
        const remainingDukes = this.getRemainingRoleCount(ROLES.DUKE);
        if (remainingDukes > 0 && Math.random() < this.personality.bluffChance * 0.5) {
          this.logThought(`Bluffing Duke block against ${actor.name}'s Foreign Aid.`);
          return ROLES.DUKE;
        }
      }
      return null;
    }

    // Steal: only the targeted player can block (claiming Captain or Ambassador)
    if (actionId === 'steal' && targetId === this.player.id) {
      const hasCaptain = this.player.hasRole(ROLES.CAPTAIN);
      const hasAmbassador = this.player.hasRole(ROLES.AMBASSADOR);

      if (hasCaptain) {
        this.logThought(`Blocking ${actor.name}'s Steal with Captain.`);
        return ROLES.CAPTAIN;
      }
      if (hasAmbassador) {
        this.logThought(`Blocking ${actor.name}'s Steal with Ambassador.`);
        return ROLES.AMBASSADOR;
      }

      // Neither card in hand: decide whether to bluff block
      // If AI has 1 influence left and only 1-2 coins, bluffing might be risky, but getting stolen hurts
      if (Math.random() < this.personality.bluffChance * 0.8) {
        // Pick whichever role has more remaining copies
        const capRem = this.getRemainingRoleCount(ROLES.CAPTAIN);
        const ambRem = this.getRemainingRoleCount(ROLES.AMBASSADOR);
        const bluffRole = ambRem >= capRem ? ROLES.AMBASSADOR : ROLES.CAPTAIN;
        this.logThought(`Bluffing ${bluffRole} block against ${actor.name}'s Steal.`);
        return bluffRole;
      }
      return null;
    }

    // Assassinate: only the targeted player can block (claiming Contessa)
    if (actionId === 'assassinate' && targetId === this.player.id) {
      const hasContessa = this.player.hasRole(ROLES.CONTESSA);

      if (hasContessa) {
        this.logThought(`Blocking ${actor.name}'s Assassination with genuine Contessa.`);
        return ROLES.CONTESSA;
      }

      // Does NOT have Contessa:
      // Critical Coup game theory:
      // If AI has only 1 influence left, NOT blocking means INSTANT DEATH!
      // Bluffing Contessa gives a chance the assassin will not challenge (or loses).
      // So at 1 influence, bluffing Contessa is overwhelmingly the rational move!
      if (this.player.influenceCount === 1) {
        this.logThought(`Cornered with 1 influence! Desperation bluff: Claiming Contessa against ${actor.name}.`);
        return ROLES.CONTESSA;
      }

      // If AI has 2 influences:
      // If AI bluffs and gets challenged, AI loses BOTH cards (double-kill elimination)!
      // So cautious AI prefers taking 1 hit rather than risking instant elimination.
      if (Math.random() < this.personality.bluffChance * 0.35) {
        this.logThought(`Gamble bluff: Claiming Contessa with 2 influences against ${actor.name}.`);
        return ROLES.CONTESSA;
      }

      this.logThought(`Accepting assassination hit from ${actor.name} to avoid double-elimination.`);
      return null;
    }

    return null;
  }

  // --- Sacrifice Selection ---

  /**
   * Choose which card to reveal when losing an influence
   */
  chooseCardToLose() {
    const alive = this.player.aliveCards;
    if (alive.length <= 1) return alive[0];

    // Score cards to KEEP. The card with lowest score will be sacrificed.
    const scoreCard = (card) => {
      let score = 0;
      switch (card.role) {
        case ROLES.DUKE:
          // Duke is great early/mid game for coins
          score += 30 + (this.player.coins < 7 ? 20 : 0);
          break;
        case ROLES.CONTESSA:
          // Essential defense if any player can assassinate
          score += 35;
          break;
        case ROLES.ASSASSIN:
          // Deadly offensive tool if AI can afford 3 coins
          score += 25 + (this.player.coins >= 3 ? 20 : 0);
          break;
        case ROLES.CAPTAIN:
          // Great offensive & defensive tool against steal
          score += 28;
          break;
        case ROLES.AMBASSADOR:
          // Good utility, but often lowest priority in late game
          score += 20;
          break;
      }
      return score;
    };

    alive.sort((a, b) => scoreCard(a) - scoreCard(b));
    const sacrifice = alive[0];
    this.logThought(`Sacrificing ${sacrifice.role} influence card.`);
    return sacrifice;
  }

  // --- Exchange Selection (Ambassador) ---

  /**
   * Given available cards (alive cards + 2 drawn cards), choose which to keep
   */
  chooseCardsToKeep(allCards, countToKeep) {
    // Score each card
    const scoreCard = (card) => {
      let score = 0;
      const role = card.role;
      if (role === ROLES.DUKE) score = 50 + (this.player.coins < 7 ? 20 : 0);
      else if (role === ROLES.CONTESSA) score = 48;
      else if (role === ROLES.ASSASSIN) score = 42 + (this.player.coins >= 3 ? 15 : 0);
      else if (role === ROLES.CAPTAIN) score = 40;
      else if (role === ROLES.AMBASSADOR) score = 30;

      // Penalize exact duplicates so AI has diverse toolkit
      return score;
    };

    const sorted = [...allCards].sort((a, b) => {
      let scoreA = scoreCard(a);
      let scoreB = scoreCard(b);
      return scoreB - scoreA;
    });

    const chosen = [];
    const returned = [];
    const chosenRoles = new Set();

    // Prefer distinct roles first
    for (const card of sorted) {
      if (chosen.length < countToKeep) {
        if (!chosenRoles.has(card.role) || (sorted.length - returned.length <= countToKeep)) {
          chosen.push(card);
          chosenRoles.add(card.role);
          continue;
        }
      }
      returned.push(card);
    }

    // Fill remaining if needed
    while (chosen.length < countToKeep && returned.length > 0) {
      chosen.push(returned.shift());
    }

    this.logThought(`Exchanged cards. Keeping [${chosen.map(c => c.role).join(', ')}].`);
    return { keep: chosen, return: returned };
  }
}
