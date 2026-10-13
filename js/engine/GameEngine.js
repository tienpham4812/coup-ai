// Coup Core Game Engine State Machine
import { ROLES, ROLE_INFO, GENERAL_ACTIONS } from '../models/Card.js';
import { Deck } from '../models/Deck.js';
import { Player, PERSONALITIES } from '../models/Player.js';
import { CoupAI } from '../ai/CoupAI.js';
import { sound } from '../audio/SoundFX.js';

export const GAME_STATES = {
  IDLE: 'IDLE',
  ACTION_SELECTION: 'ACTION_SELECTION',
  ACTION_CHALLENGE_WINDOW: 'ACTION_CHALLENGE_WINDOW',
  BLOCK_WINDOW: 'BLOCK_WINDOW',
  BLOCK_CHALLENGE_WINDOW: 'BLOCK_CHALLENGE_WINDOW',
  EXCHANGE_RESOLUTION: 'EXCHANGE_RESOLUTION',
  SACRIFICE_RESOLUTION: 'SACRIFICE_RESOLUTION',
  GAME_OVER: 'GAME_OVER'
};

export class GameEngine {
  constructor() {
    this.deck = new Deck();
    this.players = [];
    this.ais = new Map(); // playerId -> CoupAI
    this.currentTurnIndex = 0;
    this.state = GAME_STATES.IDLE;
    this.treasury = 50;
    this.roundCount = 1;
    this.actionHistory = [];
    this.currentAction = null;
    this.currentBlock = null;
    this.animationSpeed = 1000; // ms for AI actions
    this.autoPassDelay = 3500; // ms for challenge countdown

    // UI Callback hooks
    this.onStateChange = null;
    this.onLogMessage = null;
    this.onPlayerActionRequired = null;
    this.onChallengeWindow = null;
    this.onBlockWindow = null;
    this.onExchangeWindow = null;
    this.onSacrificeWindow = null;
    this.onGameOver = null;
  }

  log(text, type = 'info', metadata = {}) {
    const entry = {
      id: `log_${Date.now()}_${Math.random()}`,
      time: new Date().toLocaleTimeString(),
      text,
      type, // 'action' | 'challenge' | 'block' | 'death' | 'info' | 'bluff'
      metadata
    };
    this.actionHistory.push(entry);
    if (this.onLogMessage) {
      this.onLogMessage(entry);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Initial Setup ---

  startNewGame(options = {}) {
    const {
      playerCount = 4,
      humanName = 'You',
      difficulty = 'standard',
      speed = 900
    } = options;

    this.animationSpeed = speed;
    this.deck.reset();
    this.players = [];
    this.ais.clear();
    this.actionHistory = [];
    this.roundCount = 1;

    // 1. Create Human Player
    const human = new Player('player_0', humanName, true);
    this.players.push(human);

    // 2. Create AI Players with archetypes
    const aiArchetypes = [
      PERSONALITIES.BALANCED,  // Duke Victor
      PERSONALITIES.AGGRESSIVE,// Lady Evelyn
      PERSONALITIES.LOGICIAN,  // Lord Carlisle
      PERSONALITIES.CHAOTIC    // Rogue Silas
    ];

    for (let i = 1; i < playerCount; i++) {
      const arch = aiArchetypes[(i - 1) % aiArchetypes.length];
      const aiPlayer = new Player(`player_${i}`, arch.name, false, arch);
      this.players.push(aiPlayer);
      this.ais.set(aiPlayer.id, new CoupAI(aiPlayer, this));
    }

    // 3. Deal 2 cards to each player
    this.players.forEach(p => {
      p.cards = this.deck.draw(2);
      p.coins = 2; // Standard Coup start
    });

    this.treasury = 50 - this.players.length * 2;
    this.currentTurnIndex = 0;
    this.state = GAME_STATES.ACTION_SELECTION;

    this.log(`Game initiated with ${this.players.length} players. Treasury holds ${this.treasury} coins.`, 'info');
    sound.playCardSlide();

    if (this.onStateChange) this.onStateChange(this.getPublicState());

    // Start game loop
    this.processTurn();
  }

  get currentPlayer() {
    return this.players[this.currentTurnIndex];
  }

  get livingPlayers() {
    return this.players.filter(p => p.isAlive);
  }

  getPublicState() {
    return {
      state: this.state,
      round: this.roundCount,
      treasury: this.treasury,
      deckCount: this.deck.remaining,
      currentPlayerIndex: this.currentTurnIndex,
      currentPlayerId: this.currentPlayer ? this.currentPlayer.id : null,
      currentAction: this.currentAction,
      currentBlock: this.currentBlock,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
        isAlive: p.isAlive,
        coins: p.coins,
        influenceCount: p.influenceCount,
        revealedCards: p.revealedCards.map(c => ({ id: c.id, role: c.role })),
        cards: p.isHuman
          ? p.cards.map(c => ({ id: c.id, role: c.role, revealed: c.revealed }))
          : p.cards.map(c => ({ id: c.id, role: c.revealed ? c.role : 'hidden', revealed: c.revealed })),
        personality: p.personality
      }))
    };
  }

  // --- Main Turn Flow ---

  async processTurn() {
    // Check if only 1 player remains
    if (this.checkGameOver()) return;

    // Ensure current player is alive
    while (!this.currentPlayer.isAlive) {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    }

    const actor = this.currentPlayer;
    this.state = GAME_STATES.ACTION_SELECTION;
    this.currentAction = null;
    this.currentBlock = null;

    if (this.onStateChange) this.onStateChange(this.getPublicState());

    this.log(`--- Round ${this.roundCount}: ${actor.name}'s Turn ---`, 'info');

    let actionChoice = null;

    if (actor.isHuman) {
      // Prompt human for action
      if (this.onPlayerActionRequired) {
        actionChoice = await this.onPlayerActionRequired(actor);
      }
    } else {
      // AI Turn
      await this.sleep(this.animationSpeed * 0.8);
      const ai = this.ais.get(actor.id);
      actionChoice = ai.chooseTurnAction();
    }

    if (!actionChoice) {
      // Default fallback
      actionChoice = { actionId: 'income', targetId: null, roleClaim: null };
    }

    await this.handleActionDeclaration(actor, actionChoice);
  }

  // --- Action Declaration & Cost Deductions ---

  async handleActionDeclaration(actor, actionChoice) {
    const { actionId, targetId, roleClaim } = actionChoice;
    const target = targetId ? this.players.find(p => p.id === targetId) : null;

    this.currentAction = {
      actor,
      actionId,
      target,
      roleClaim, // e.g. ROLES.DUKE, ROLES.ASSASSIN, etc.
      isChallenged: false,
      isBlocked: false
    };

    // Upfront cost deduction (Coup costs 7, Assassinate costs 3)
    if (actionId === 'coup') {
      actor.removeCoins(7);
      this.treasury += 7;
      sound.playCoinSpend();
      this.log(`${actor.name} launches a COUP against ${target.name}! (-7 coins)`, 'action');
    } else if (actionId === 'assassinate') {
      actor.removeCoins(3);
      this.treasury += 3;
      sound.playCoinSpend();
      this.log(`${actor.name} declares ASSASSINATION targeting ${target.name}! (claims Assassin, paid 3 coins)`, 'action');
    } else if (actionId === 'tax') {
      this.log(`${actor.name} claims DUKE to take Tax (+3 coins).`, 'action');
    } else if (actionId === 'steal') {
      this.log(`${actor.name} claims CAPTAIN to Steal from ${target.name}.`, 'action');
    } else if (actionId === 'exchange') {
      this.log(`${actor.name} claims AMBASSADOR to Exchange cards with the Court Deck.`, 'action');
    } else if (actionId === 'foreign_aid') {
      this.log(`${actor.name} claims Foreign Aid (+2 coins from Treasury).`, 'action');
    } else if (actionId === 'income') {
      this.log(`${actor.name} takes safe 1 coin Income.`, 'action');
    }

    if (this.onStateChange) this.onStateChange(this.getPublicState());

    // Check if action is challengeable
    const isChallengeable = ['tax', 'assassinate', 'steal', 'exchange'].includes(actionId);

    if (isChallengeable) {
      const challengeOccurred = await this.conductChallengeWindow({
        claimant: actor,
        role: roleClaim,
        actionId,
        targetId: target ? target.id : null,
        isBlock: false
      });

      if (challengeOccurred) {
        // Challenge was resolved
        if (this.currentAction.isCancelled) {
          this.log(`${actor.name}'s ${actionId} was foiled by a successful challenge!`, 'challenge');
          await this.finishTurn();
          return;
        }
      }
    }

    // Check if target died in challenge (e.g. if challenger was target and got eliminated)
    if (target && !target.isAlive) {
      this.log(`${target.name} has already fallen! Action ends.`, 'info');
      await this.finishTurn();
      return;
    }

    // Check if action can be blocked
    const isBlockable = ['foreign_aid', 'steal', 'assassinate'].includes(actionId);

    if (isBlockable && !this.currentAction.isCancelled) {
      const blockDeclared = await this.conductBlockWindow(actor, actionId, target);

      if (blockDeclared) {
        // A block was declared! Now others can challenge the block!
        const blockChallengeOccurred = await this.conductChallengeWindow({
          claimant: this.currentBlock.blocker,
          role: this.currentBlock.roleClaim,
          actionId,
          targetId: target ? target.id : null,
          isBlock: true
        });

        if (blockChallengeOccurred) {
          if (this.currentBlock.isCancelled) {
            // Block challenge succeeded (blocker bluffed and was caught!)
            this.log(`${this.currentBlock.blocker.name}'s block was thwarted!`, 'challenge');
            // If action was Assassinate, blocker lost influence from challenge AND now faces assassination!
            this.currentAction.isBlocked = false;
          } else {
            // Blocker proved their role! Block stands!
            this.currentAction.isBlocked = true;
          }
        } else {
          // Block was uncontested
          this.currentAction.isBlocked = true;
        }

        if (this.currentAction.isBlocked) {
          this.log(`The action was successfully blocked. No further effect.`, 'block');
          sound.playBlock();
          await this.finishTurn();
          return;
        }
      }
    }

    // Execute the action if not blocked and not cancelled
    await this.executeAction(actor, this.currentAction);
    await this.finishTurn();
  }

  // --- Challenge Window ---

  async conductChallengeWindow(claimContext) {
    const { claimant, role, isBlock } = claimContext;
    this.state = isBlock ? GAME_STATES.BLOCK_CHALLENGE_WINDOW : GAME_STATES.ACTION_CHALLENGE_WINDOW;
    if (this.onStateChange) this.onStateChange(this.getPublicState());

    // Find all potential challengers (all living players except the claimant)
    const opponents = this.livingPlayers.filter(p => p.id !== claimant.id);
    let challenger = null;

    // Give Human a chance first if human is in opponents
    const humanOpponent = opponents.find(p => p.isHuman);

    if (humanOpponent) {
      if (this.onChallengeWindow) {
        const humanDecision = await this.onChallengeWindow(claimContext, humanOpponent);
        if (humanDecision === true) {
          challenger = humanOpponent;
        }
      }
    }

    // If human did not challenge, let AIs evaluate
    if (!challenger) {
      for (const opp of opponents) {
        if (!opp.isHuman) {
          const ai = this.ais.get(opp.id);
          if (ai && ai.shouldChallenge(claimContext)) {
            challenger = opp;
            break; // First AI to call challenge
          }
        }
      }
    }

    if (!challenger) {
      // No challenge!
      return false;
    }

    // Sound effect
    sound.playChallengeAlert();
    this.log(`🚨 CHALLENGE! ${challenger.name} challenges ${claimant.name}'s claim of ${role.toUpperCase()}!`, 'challenge');

    await this.sleep(this.animationSpeed);

    // Resolve Challenge: Does claimant have the role?
    const hasRole = claimant.hasRole(role);

    if (hasRole) {
      // Claimant was TRUTHFUL!
      sound.playChallengeSuccess();
      const genuineCard = claimant.getCardByRole(role);
      this.log(`✅ ${claimant.name} reveals genuine ${role.toUpperCase()}!`, 'challenge');

      // 1. Challenger loses 1 influence
      this.log(`❌ ${challenger.name} made a false challenge and loses 1 influence!`, 'challenge');
      await this.resolveSacrifice(challenger, `Losing influence for false challenge against ${claimant.name}`);

      // 2. Claimant returns revealed card to court deck, shuffles, draws new card
      claimant.cards = claimant.cards.filter(c => c.id !== genuineCard.id);
      this.deck.returnCards(genuineCard, true);
      const replacementCard = this.deck.draw(1)[0];
      claimant.cards.push(replacementCard);
      this.log(`${claimant.name} shuffles their ${role} into Court Deck and draws a replacement card.`, 'info');

      if (isBlock) {
        // Block stands
        this.currentBlock.isCancelled = false;
      }
      return true;
    } else {
      // Claimant was BLUFFING!
      sound.playChallengeFail();
      this.log(`⚠️ ${claimant.name} was caught bluffing! They do NOT have ${role.toUpperCase()}!`, 'bluff');

      // Claimant loses 1 influence
      await this.resolveSacrifice(claimant, `Caught bluffing ${role.toUpperCase()}`);

      if (isBlock) {
        this.currentBlock.isCancelled = true;
      } else {
        this.currentAction.isCancelled = true;
      }
      return true;
    }
  }

  // --- Block Window (Counteractions) ---

  async conductBlockWindow(actor, actionId, target) {
    this.state = GAME_STATES.BLOCK_WINDOW;
    if (this.onStateChange) this.onStateChange(this.getPublicState());

    // Eligible blockers:
    // - foreign_aid: ANY living player except actor
    // - steal: ONLY the target
    // - assassinate: ONLY the target
    let eligibleBlockers = [];
    if (actionId === 'foreign_aid') {
      eligibleBlockers = this.livingPlayers.filter(p => p.id !== actor.id);
    } else if (target && target.isAlive) {
      eligibleBlockers = [target];
    }

    if (eligibleBlockers.length === 0) return false;

    let blocker = null;
    let blockRole = null;

    // Check Human first if eligible
    const humanBlocker = eligibleBlockers.find(p => p.isHuman);
    if (humanBlocker) {
      if (this.onBlockWindow) {
        const response = await this.onBlockWindow(actor, actionId, humanBlocker);
        if (response && response.role) {
          blocker = humanBlocker;
          blockRole = response.role;
        }
      }
    }

    // If human didn't block, check eligible AIs
    if (!blocker) {
      for (const p of eligibleBlockers) {
        if (!p.isHuman) {
          const ai = this.ais.get(p.id);
          if (ai) {
            const role = ai.shouldBlock({ actor, actionId, targetId: target ? target.id : null });
            if (role) {
              blocker = p;
              blockRole = role;
              break;
            }
          }
        }
      }
    }

    if (!blocker || !blockRole) {
      return false;
    }

    this.currentBlock = {
      blocker,
      roleClaim: blockRole,
      actionId,
      isCancelled: false
    };

    sound.playBlock();
    this.log(`🛡️ ${blocker.name} claims ${blockRole.toUpperCase()} to block ${actor.name}'s ${actionId}!`, 'block');
    return true;
  }

  // --- Action Execution ---

  async executeAction(actor, action) {
    const { actionId, target } = action;

    switch (actionId) {
      case 'income': {
        if (this.treasury > 0) {
          this.treasury -= 1;
          actor.addCoins(1);
          sound.playCoinGain();
          this.log(`${actor.name} gains 1 coin (Total: ${actor.coins}).`, 'action');
        }
        break;
      }

      case 'foreign_aid': {
        const gain = Math.min(2, this.treasury);
        this.treasury -= gain;
        actor.addCoins(gain);
        sound.playCoinGain();
        this.log(`${actor.name} collects ${gain} Foreign Aid coins (Total: ${actor.coins}).`, 'action');
        break;
      }

      case 'tax': {
        const gain = Math.min(3, this.treasury);
        this.treasury -= gain;
        actor.addCoins(gain);
        sound.playCoinGain();
        this.log(`${actor.name} collects ${gain} coins in Tax (Total: ${actor.coins}).`, 'action');
        break;
      }

      case 'steal': {
        if (target && target.isAlive) {
          const stolen = Math.min(2, target.coins);
          target.removeCoins(stolen);
          actor.addCoins(stolen);
          sound.playCoinGain();
          this.log(`${actor.name} steals ${stolen} coins from ${target.name}!`, 'action');
        }
        break;
      }

      case 'assassinate': {
        if (target && target.isAlive) {
          sound.playAssassinate();
          this.log(`🗡️ ${target.name} has been assassinated by ${actor.name}!`, 'death');
          await this.resolveSacrifice(target, `Assassinated by ${actor.name}`);
        }
        break;
      }

      case 'coup': {
        if (target && target.isAlive) {
          sound.playAssassinate();
          this.log(`💥 Coup struck against ${target.name}!`, 'death');
          await this.resolveSacrifice(target, `Target of Coup by ${actor.name}`);
        }
        break;
      }

      case 'exchange': {
        await this.resolveExchange(actor);
        break;
      }
    }

    if (this.onStateChange) this.onStateChange(this.getPublicState());
  }

  // --- Exchange Resolution (Ambassador) ---

  async resolveExchange(actor) {
    this.state = GAME_STATES.EXCHANGE_RESOLUTION;
    sound.playCardSlide();

    // Draw 2 cards from court deck
    const drawnCards = this.deck.draw(2);
    const aliveHand = actor.aliveCards;
    const allAvailable = [...aliveHand, ...drawnCards];
    const keepCount = aliveHand.length;

    this.log(`${actor.name} draws 2 cards to exchange. Must choose ${keepCount} to keep.`, 'info');

    let keptCards = [];
    let returnedCards = [];

    if (actor.isHuman) {
      if (this.onExchangeWindow) {
        keptCards = await this.onExchangeWindow(allAvailable, keepCount);
      }
    } else {
      const ai = this.ais.get(actor.id);
      const decision = ai.chooseCardsToKeep(allAvailable, keepCount);
      keptCards = decision.keep;
      returnedCards = decision.return;
    }

    // Compute returned cards if not explicitly provided
    if (keptCards.length > 0 && returnedCards.length === 0) {
      const keptIds = new Set(keptCards.map(c => c.id));
      returnedCards = allAvailable.filter(c => !keptIds.has(c.id));
    }

    // Update actor hand: preserve already revealed cards, replace active cards with kept
    const revealedCards = actor.revealedCards;
    actor.cards = [...revealedCards, ...keptCards];

    // Return other cards to deck and shuffle
    this.deck.returnCards(returnedCards, true);
    sound.playCardFlip();
    this.log(`${actor.name} returned 2 cards to the Court Deck and shuffled.`, 'action');
  }

  // --- Sacrifice / Influence Loss Resolution ---

  async resolveSacrifice(player, reason = '') {
    if (!player.isAlive) return;

    this.state = GAME_STATES.SACRIFICE_RESOLUTION;
    if (this.onStateChange) this.onStateChange(this.getPublicState());

    let cardToLose = null;

    if (player.aliveCards.length === 1) {
      cardToLose = player.aliveCards[0];
    } else if (player.isHuman) {
      if (this.onSacrificeWindow) {
        cardToLose = await this.onSacrificeWindow(player, reason);
      } else {
        cardToLose = player.aliveCards[0];
      }
    } else {
      const ai = this.ais.get(player.id);
      cardToLose = ai ? ai.chooseCardToLose() : player.aliveCards[0];
    }

    if (cardToLose) {
      player.loseInfluence(cardToLose.id);
      sound.playDefeat();
      this.log(`☠️ ${player.name} loses influence: [${cardToLose.role.toUpperCase()}] is revealed! (${reason})`, 'death');
    }

    if (!player.isAlive) {
      this.log(`💀 ${player.name} has lost all influence and is ELIMINATED!`, 'death');
      // Return eliminated player's coins to treasury? Coup rules: dead player keeps coins or treasury? Coup official rule: coins remain on their card/eliminated or go to treasury. We return to treasury.
      this.treasury += player.coins;
      player.coins = 0;
    }

    if (this.onStateChange) this.onStateChange(this.getPublicState());
    await this.sleep(this.animationSpeed * 0.5);
  }

  // --- End Turn & Victory Checking ---

  async finishTurn() {
    if (this.checkGameOver()) return;

    // Advance to next living player
    let loops = 0;
    do {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
      loops++;
      if (this.currentTurnIndex === 0) {
        this.roundCount++;
      }
    } while (!this.currentPlayer.isAlive && loops < 20);

    await this.sleep(this.animationSpeed * 0.6);
    this.processTurn();
  }

  checkGameOver() {
    const living = this.livingPlayers;
    if (living.length <= 1) {
      this.state = GAME_STATES.GAME_OVER;
      const winner = living[0] || null;

      if (winner) {
        this.log(`🏆 VICTORY! ${winner.name} is the sole survivor and rules the Court!`, 'action');
        if (winner.isHuman) {
          sound.playVictory();
        } else {
          sound.playDefeat();
        }
      }

      if (this.onStateChange) this.onStateChange(this.getPublicState());
      if (this.onGameOver) this.onGameOver(winner);
      return true;
    }
    return false;
  }
}
