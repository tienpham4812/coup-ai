// UI Controller managing the Coup DOM, interactive prompts, animations and modals
import { ROLES, ROLE_INFO, GENERAL_ACTIONS, getRoleIconSvg } from '../models/Card.js';
import { sound } from '../audio/SoundFX.js';

export class UIController {
  constructor(gameEngine) {
    this.game = gameEngine;
    this.activeModalResolve = null;
    this.timerInterval = null;

    // Cache DOM Elements
    this.opponentsRow = document.getElementById('opponents-row');
    this.treasuryCountEl = document.getElementById('treasury-count');
    this.deckCountEl = document.getElementById('deck-count');
    this.actionStatusPill = document.getElementById('action-status-pill');
    this.actionHeadlineEl = document.getElementById('action-headline');
    this.actionSubtextEl = document.getElementById('action-subtext');
    this.timerBarContainer = document.getElementById('timer-bar-container');
    this.timerBarFill = document.getElementById('timer-bar-fill');

    this.humanArea = document.getElementById('human-player-area');
    this.humanHandContainer = document.getElementById('human-hand-container');
    this.humanCoinsEl = document.getElementById('human-coins-count');
    this.actionControlsGrid = document.getElementById('action-controls-grid');

    this.sidebarLogs = document.getElementById('sidebar-logs');
    this.sidebarThoughts = document.getElementById('sidebar-thoughts');
    this.sidebarProbs = document.getElementById('sidebar-probs');

    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalContent = document.getElementById('modal-content');

    this.initEventListeners();
  }

  initEventListeners() {
    // Hook engine events
    this.game.onStateChange = (state) => this.renderGameState(state);
    this.game.onLogMessage = (entry) => this.renderLogEntry(entry);
    this.game.onPlayerActionRequired = (actor) => this.promptPlayerAction(actor);
    this.game.onChallengeWindow = (claim, human) => this.promptChallengeWindow(claim, human);
    this.game.onBlockWindow = (actor, actionId, human) => this.promptBlockWindow(actor, actionId, human);
    this.game.onExchangeWindow = (cards, count) => this.promptExchangeWindow(cards, count);
    this.game.onSacrificeWindow = (player, reason) => this.promptSacrificeWindow(player, reason);
    this.game.onGameOver = (winner) => this.renderGameOver(winner);

    // Sidebar Tab Switching
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const targetTab = e.target.getAttribute('data-tab');

        if (targetTab === 'logs') {
          this.sidebarLogs.style.display = 'flex';
          this.sidebarThoughts.style.display = 'none';
          this.sidebarProbs.style.display = 'none';
        } else if (targetTab === 'thoughts') {
          this.sidebarLogs.style.display = 'none';
          this.sidebarThoughts.style.display = 'flex';
          this.sidebarProbs.style.display = 'none';
          this.updateThoughtInspector();
        } else if (targetTab === 'probs') {
          this.sidebarLogs.style.display = 'none';
          this.sidebarThoughts.style.display = 'none';
          this.sidebarProbs.style.display = 'block';
          this.updateProbabilitiesView();
        }
      });
    });

    // Sound toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const enabled = sound.toggle();
        soundBtn.innerHTML = enabled ? '🔊' : '🔇';
        soundBtn.title = enabled ? 'Mute Audio' : 'Unmute Audio';
      });
    }

    // Rules modal toggle
    const rulesBtn = document.getElementById('btn-rules-toggle');
    if (rulesBtn) {
      rulesBtn.addEventListener('click', () => this.showRulesModal());
    }

    // Reset game button
    const restartBtn = document.getElementById('btn-restart-game');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        if (confirm('Start a new game of Coup?')) {
          this.game.startNewGame();
        }
      });
    }

    // Speed selector
    const speedSelect = document.getElementById('select-game-speed');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        this.game.animationSpeed = parseInt(e.target.value, 10);
      });
    }
  }

  // --- Rendering State ---

  renderGameState(state) {
    // 1. Treasury & Deck
    if (this.treasuryCountEl) this.treasuryCountEl.textContent = state.treasury;
    if (this.deckCountEl) this.deckCountEl.textContent = state.deckCount;

    // 2. Render Opponents
    if (this.opponentsRow) {
      this.opponentsRow.innerHTML = '';
      const opponents = state.players.filter(p => !p.isHuman);

      opponents.forEach(p => {
        const isCurrent = state.currentPlayerId === p.id;
        const seat = document.createElement('div');
        seat.className = `player-seat ${isCurrent ? 'active-turn' : ''} ${!p.isAlive ? 'eliminated' : ''}`;
        seat.id = `seat-${p.id}`;

        // Mini cards row
        const cardsHtml = p.cards.map(c => {
          if (c.revealed) {
            return `
              <div class="mini-card revealed" title="${c.role.toUpperCase()} (Eliminated)">
                <span class="dead-tag">DEAD</span>
                <div style="width:26px; height:26px;">${getRoleIconSvg(c.role)}</div>
                <div class="role-name-mini">${c.role}</div>
              </div>
            `;
          } else {
            return `<div class="mini-card hidden" title="Hidden Influence Card"></div>`;
          }
        }).join('');

        seat.innerHTML = `
          <div class="player-header">
            <div class="player-avatar" style="background:${p.personality ? p.personality.avatarBg : '#475569'}">
              ${p.personality ? p.personality.avatar : '👤'}
            </div>
            <div class="player-info">
              <span class="player-name">${p.name}</span>
              <span class="player-archetype">${p.personality ? p.personality.archetype : 'Opponent'}</span>
            </div>
            <div class="coin-badge" title="Coins">
              <span class="coin-icon"></span>
              <span>${p.coins}</span>
            </div>
          </div>
          <div class="influence-cards-row">
            ${cardsHtml}
          </div>
        `;

        this.opponentsRow.appendChild(seat);
      });
    }

    // 3. Render Human Player
    const human = state.players.find(p => p.isHuman);
    if (human) {
      if (this.humanCoinsEl) this.humanCoinsEl.textContent = human.coins;
      const isHumanTurn = state.currentPlayerId === human.id;
      if (this.humanArea) {
        if (isHumanTurn) this.humanArea.classList.add('active-turn');
        else this.humanArea.classList.remove('active-turn');
      }

      // Render Human Hand Cards
      if (this.humanHandContainer) {
        this.humanHandContainer.innerHTML = '';
        human.cards.forEach(card => {
          const cardEl = document.createElement('div');
          cardEl.className = `influence-card card-${card.role} ${card.revealed ? 'revealed' : ''}`;
          const roleData = ROLE_INFO[card.role];

          cardEl.innerHTML = `
            <div class="card-top">
              <span class="card-role-title" style="color:${roleData.goldAccent}">${roleData.name}</span>
            </div>
            <div class="card-icon-art">
              ${getRoleIconSvg(card.role)}
            </div>
            <div class="card-rules-snippet">
              ${roleData.summary}
            </div>
          `;

          this.humanHandContainer.appendChild(cardEl);
        });
      }

      // Render Action Button State for Human
      this.updateActionButtonsAvailability(human, isHumanTurn);
    }

    // Update Action Status Banner
    this.updateStatusBanner(state);
    this.updateThoughtInspector();
    this.updateProbabilitiesView();
  }

  updateStatusBanner(state) {
    if (!this.actionHeadlineEl) return;

    if (state.state === 'GAME_OVER') {
      this.actionStatusPill.textContent = 'GAME OVER';
      return;
    }

    const currentP = state.players.find(p => p.id === state.currentPlayerId);
    const pName = currentP ? currentP.name : 'A Player';

    if (state.currentAction) {
      const act = state.currentAction;
      this.actionStatusPill.textContent = act.actionId.toUpperCase();
      let headline = `${act.actor.name} declares ${act.actionId.toUpperCase()}`;
      if (act.target) headline += ` targeting ${act.target.name}`;
      this.actionHeadlineEl.textContent = headline;

      if (state.state === 'ACTION_CHALLENGE_WINDOW') {
        this.actionSubtextEl.textContent = `Awaiting challenges to ${act.actor.name}'s claim of ${act.roleClaim ? act.roleClaim.toUpperCase() : 'action'}...`;
      } else if (state.state === 'BLOCK_WINDOW') {
        this.actionSubtextEl.textContent = `Opportunity to block with counter-role...`;
      } else if (state.state === 'BLOCK_CHALLENGE_WINDOW') {
        this.actionSubtextEl.textContent = `Awaiting challenge on the counteraction block!`;
      } else {
        this.actionSubtextEl.textContent = `Resolving turn actions...`;
      }
    } else {
      this.actionStatusPill.textContent = `ROUND ${state.round}`;
      this.actionHeadlineEl.textContent = `${pName}'s Turn`;
      this.actionSubtextEl.textContent = currentP && currentP.isHuman ? 'Choose an action to proceed.' : 'Considering tactical options...';
    }
  }

  updateActionButtonsAvailability(human, isHumanTurn) {
    if (!this.actionControlsGrid) return;
    const btns = this.actionControlsGrid.querySelectorAll('.action-btn');
    const mustCoup = human.coins >= 10;

    btns.forEach(btn => {
      const actId = btn.getAttribute('data-action');
      if (!isHumanTurn || !human.isAlive) {
        btn.disabled = true;
        btn.classList.remove('mandatory-highlight');
        return;
      }

      // Mandatory Coup Rule: at 10+ coins, player MUST Coup!
      if (mustCoup) {
        if (actId === 'coup') {
          btn.disabled = false;
          btn.classList.add('mandatory-highlight');
        } else {
          btn.disabled = true;
          btn.classList.remove('mandatory-highlight');
        }
        return;
      }

      btn.classList.remove('mandatory-highlight');

      // Check costs
      if (actId === 'coup') {
        btn.disabled = human.coins < 7;
      } else if (actId === 'assassinate') {
        btn.disabled = human.coins < 3;
      } else {
        btn.disabled = false;
      }
    });
  }

  // --- Logs & Thought Feed ---

  renderLogEntry(entry) {
    if (!this.sidebarLogs) return;
    const logItem = document.createElement('div');
    logItem.className = `log-entry log-${entry.type}`;
    logItem.innerHTML = `<span class="log-time">${entry.time}</span> ${entry.text}`;
    this.sidebarLogs.appendChild(logItem);
    this.sidebarLogs.scrollTop = this.sidebarLogs.scrollHeight;
  }

  updateThoughtInspector() {
    if (!this.sidebarThoughts) return;
    this.sidebarThoughts.innerHTML = '';

    this.game.ais.forEach((ai, playerId) => {
      const thoughts = ai.getRecentThoughts(3);
      if (thoughts.length > 0) {
        const card = document.createElement('div');
        card.className = 'thought-card';
        card.innerHTML = `
          <div class="thought-header">
            <span>${ai.player.name} (${ai.personality.archetype})</span>
            <span>🪙 ${ai.player.coins}</span>
          </div>
          <div class="thought-body">
            ${thoughts.map(t => `<p style="margin-bottom:4px;">“${t.text}”</p>`).join('')}
          </div>
        `;
        this.sidebarThoughts.appendChild(card);
      }
    });
  }

  updateProbabilitiesView() {
    if (!this.sidebarProbs) return;
    const roles = [ROLES.DUKE, ROLES.ASSASSIN, ROLES.CAPTAIN, ROLES.AMBASSADOR, ROLES.CONTESSA];
    const human = this.game.players.find(p => p.isHuman);
    if (!human) return;

    let rowsHtml = '';
    roles.forEach(role => {
      // In human hand
      const inHumanHand = human.aliveCards.filter(c => c.role === role).length;
      // Dead on table
      let dead = 0;
      this.game.players.forEach(p => {
        dead += p.revealedCards.filter(c => c.role === role).length;
      });
      const remainingUnseen = Math.max(0, 3 - inHumanHand - dead);

      rowsHtml += `
        <tr>
          <td style="font-weight:700; color:${ROLE_INFO[role].goldAccent};">${ROLE_INFO[role].name}</td>
          <td>${inHumanHand}</td>
          <td style="color:#ef4444;">${dead}</td>
          <td style="font-weight:800; color:${remainingUnseen === 0 ? '#ef4444' : '#10b981'};">
            ${remainingUnseen} / 3 ${remainingUnseen === 0 ? '⚠️ EXTINCT' : ''}
          </td>
        </tr>
      `;
    });

    this.sidebarProbs.innerHTML = `
      <div style="font-size:0.8rem; margin-bottom:10px; color:var(--text-secondary);">
        Card Counting Tracker (Live odds of roles remaining in unseen hands & Court Deck):
      </div>
      <table class="prob-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Your Hand</th>
            <th>Revealed Dead</th>
            <th>Unseen Pool</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  // --- Interactive Prompts (Promises) ---

  async promptPlayerAction(actor) {
    return new Promise(resolve => {
      sound.playClick();
      // Highlight action buttons
      const handleActionClick = (e) => {
        const btn = e.target.closest('.action-btn');
        if (!btn || btn.disabled) return;

        const actionId = btn.getAttribute('data-action');

        // Check if action requires target (Coup, Assassinate, Steal)
        const requiresTarget = ['coup', 'assassinate', 'steal'].includes(actionId);

        if (requiresTarget) {
          this.promptTargetSelection(actor, actionId).then(target => {
            if (target) {
              cleanup();
              let roleClaim = null;
              if (actionId === 'assassinate') roleClaim = ROLES.ASSASSIN;
              if (actionId === 'steal') roleClaim = ROLES.CAPTAIN;
              resolve({ actionId, targetId: target.id, roleClaim });
            }
          });
        } else {
          cleanup();
          let roleClaim = null;
          if (actionId === 'tax') roleClaim = ROLES.DUKE;
          if (actionId === 'exchange') roleClaim = ROLES.AMBASSADOR;
          resolve({ actionId, targetId: null, roleClaim });
        }
      };

      const cleanup = () => {
        this.actionControlsGrid.removeEventListener('click', handleActionClick);
      };

      this.actionControlsGrid.addEventListener('click', handleActionClick);
    });
  }

  async promptTargetSelection(actor, actionId) {
    const validTargets = this.game.players.filter(p => p.id !== actor.id && p.isAlive);
    // If stealing, filter out players with 0 coins
    const eligibleTargets = actionId === 'steal'
      ? validTargets.filter(p => p.coins > 0)
      : validTargets;

    if (eligibleTargets.length === 0) {
      alert('No valid targets available for this action!');
      return null;
    }

    if (eligibleTargets.length === 1) {
      return eligibleTargets[0];
    }

    return new Promise(resolve => {
      this.modalContent.innerHTML = `
        <h3 class="modal-title">Select Target for ${actionId.toUpperCase()}</h3>
        <p class="modal-desc">Choose a rival noble to direct your ${actionId} against:</p>
        <div class="target-selector-grid">
          ${eligibleTargets.map(p => `
            <button class="target-player-btn" data-target-id="${p.id}">
              <div class="player-avatar" style="background:${p.personality ? p.personality.avatarBg : '#475569'}">
                ${p.personality ? p.personality.avatar : '👤'}
              </div>
              <span style="font-weight:700;">${p.name}</span>
              <span class="coin-badge"><span class="coin-icon"></span> ${p.coins} coins</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${p.influenceCount} influence</span>
            </button>
          `).join('')}
        </div>
        <div class="modal-button-group">
          <button class="btn-secondary" id="modal-cancel-target">Cancel</button>
        </div>
      `;

      this.modalOverlay.style.display = 'flex';

      const buttons = this.modalContent.querySelectorAll('.target-player-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const tId = btn.getAttribute('data-target-id');
          const target = eligibleTargets.find(p => p.id === tId);
          this.closeModal();
          resolve(target);
        });
      });

      document.getElementById('modal-cancel-target').addEventListener('click', () => {
        this.closeModal();
        resolve(null);
      });
    });
  }

  async promptChallengeWindow(claimContext, human) {
    const { claimant, role, isBlock, actionId } = claimContext;

    // Calculate bluff probability estimation for human assistance
    const inHumanHand = human.aliveCards.filter(c => c.role === role).length;
    let deadOnTable = 0;
    this.game.players.forEach(p => {
      deadOnTable += p.revealedCards.filter(c => c.role === role).length;
    });
    const remainingRole = Math.max(0, 3 - inHumanHand - deadOnTable);

    let probText = '';
    if (remainingRole === 0) {
      probText = `<strong style="color:#ef4444;">100% GUARANTEED BLUFF!</strong> You and table have all 3 ${role} cards!`;
    } else {
      probText = `Unseen copies of ${role}: <strong>${remainingRole} / 3</strong>.`;
    }

    return new Promise(resolve => {
      this.modalContent.innerHTML = `
        <h3 class="modal-title">🚨 Challenge Opportunity</h3>
        <p class="modal-desc">
          <strong>${claimant.name}</strong> claims to have the 
          <span style="color:${ROLE_INFO[role].goldAccent}; font-weight:800;">${role.toUpperCase()}</span>
          ${isBlock ? `to block ${actionId}` : `for ${actionId}`}.
        </p>
        <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:12px; text-align:center; font-size:0.9rem;">
          📊 Tactical Intel: ${probText}<br>
          <span style="font-size:0.75rem; color:var(--text-secondary);">
            If you challenge and they HAVE the card: You lose 1 influence.<br>
            If they BLUFFED: They lose 1 influence and action fails.
          </span>
        </div>
        <div class="timer-bar-container">
          <div class="timer-bar-fill" id="challenge-timer-fill"></div>
        </div>
        <div class="modal-button-group">
          <button class="btn-danger" id="btn-do-challenge">⚔️ CHALLENGE BLUFF</button>
          <button class="btn-secondary" id="btn-pass-challenge">Pass (Allow Claim)</button>
        </div>
      `;

      this.modalOverlay.style.display = 'flex';
      sound.playChallengeAlert();

      let secondsLeft = 6;
      const fillEl = document.getElementById('challenge-timer-fill');

      this.timerInterval = setInterval(() => {
        secondsLeft -= 0.1;
        if (fillEl) fillEl.style.width = `${Math.max(0, (secondsLeft / 6) * 100)}%`;
        if (secondsLeft <= 0) {
          clearInterval(this.timerInterval);
          this.closeModal();
          resolve(false);
        }
      }, 100);

      document.getElementById('btn-do-challenge').addEventListener('click', () => {
        clearInterval(this.timerInterval);
        this.closeModal();
        resolve(true);
      });

      document.getElementById('btn-pass-challenge').addEventListener('click', () => {
        clearInterval(this.timerInterval);
        this.closeModal();
        resolve(false);
      });
    });
  }

  async promptBlockWindow(actor, actionId, human) {
    // Determine available block roles
    let blockRoles = [];
    if (actionId === 'foreign_aid') blockRoles = [ROLES.DUKE];
    else if (actionId === 'assassinate') blockRoles = [ROLES.CONTESSA];
    else if (actionId === 'steal') blockRoles = [ROLES.CAPTAIN, ROLES.AMBASSADOR];

    return new Promise(resolve => {
      this.modalContent.innerHTML = `
        <h3 class="modal-title">🛡️ Defense Counteraction</h3>
        <p class="modal-desc">
          <strong>${actor.name}</strong> is attempting <strong>${actionId.toUpperCase()}</strong>!
          You may declare a character block (even if bluffing):
        </p>
        <div class="modal-button-group" style="flex-direction:column; gap:10px;">
          ${blockRoles.map(r => {
            const hasCard = typeof human.hasRole === 'function' ? human.hasRole(r) : (human.cards && human.cards.some(c => !c.revealed && c.role === r));
            return `
            <button class="btn-primary btn-block-option" data-role="${r}" style="padding:14px; font-size:1.05rem;">
              Block with ${r.toUpperCase()} ${hasCard ? '✅ (In Hand)' : '⚠️ (Bluff)'}
            </button>
          `;}).join('')}
          <button class="btn-secondary" id="btn-pass-block">Do Not Block (Accept Effect)</button>
        </div>
      `;

      this.modalOverlay.style.display = 'flex';

      const options = this.modalContent.querySelectorAll('.btn-block-option');
      options.forEach(btn => {
        btn.addEventListener('click', () => {
          const role = btn.getAttribute('data-role');
          this.closeModal();
          resolve({ role });
        });
      });

      document.getElementById('btn-pass-block').addEventListener('click', () => {
        this.closeModal();
        resolve(null);
      });
    });
  }

  async promptExchangeWindow(availableCards, keepCount) {
    return new Promise(resolve => {
      const selectedIds = new Set();

      const renderCards = () => {
        const grid = document.getElementById('exchange-cards-grid');
        if (!grid) return;
        grid.innerHTML = availableCards.map(c => `
          <div class="selectable-card ${selectedIds.has(c.id) ? 'selected' : ''}" data-id="${c.id}">
            <div style="width:36px; height:36px;">${getRoleIconSvg(c.role)}</div>
            <span style="font-weight:700; margin-top:8px;">${c.role.toUpperCase()}</span>
          </div>
        `).join('');

        grid.querySelectorAll('.selectable-card').forEach(cardEl => {
          cardEl.addEventListener('click', () => {
            const id = cardEl.getAttribute('data-id');
            if (selectedIds.has(id)) {
              selectedIds.delete(id);
            } else {
              if (selectedIds.size < keepCount) {
                selectedIds.add(id);
              }
            }
            renderCards();
            updateConfirmBtn();
          });
        });
      };

      const updateConfirmBtn = () => {
        const btn = document.getElementById('btn-confirm-exchange');
        if (btn) {
          btn.disabled = selectedIds.size !== keepCount;
          btn.textContent = `Keep ${selectedIds.size} / ${keepCount} Cards`;
        }
      };

      this.modalContent.innerHTML = `
        <h3 class="modal-title">Diplomatic Exchange (Ambassador)</h3>
        <p class="modal-desc">
          Select exactly <strong>${keepCount}</strong> card(s) to keep.
          The remaining cards will be returned to the Court Deck and shuffled.
        </p>
        <div class="selectable-cards-grid" id="exchange-cards-grid"></div>
        <div class="modal-button-group">
          <button class="btn-primary" id="btn-confirm-exchange" disabled>Keep 0 / ${keepCount} Cards</button>
        </div>
      `;

      this.modalOverlay.style.display = 'flex';
      renderCards();

      document.getElementById('btn-confirm-exchange').addEventListener('click', () => {
        const kept = availableCards.filter(c => selectedIds.has(c.id));
        this.closeModal();
        resolve(kept);
      });
    });
  }

  async promptSacrificeWindow(player, reason) {
    return new Promise(resolve => {
      this.modalContent.innerHTML = `
        <h3 class="modal-title" style="color:#ef4444;">☠️ Lose Influence</h3>
        <p class="modal-desc">
          <strong>${player.name}</strong>, you must reveal and sacrifice one of your influence cards!
          <br><span style="font-size:0.8rem; color:var(--text-muted);">${reason}</span>
        </p>
        <div class="selectable-cards-grid">
          ${player.aliveCards.map(c => `
            <div class="selectable-card sacrifice-card-opt" data-id="${c.id}" style="border-color:#ef4444;">
              <div style="width:36px; height:36px;">${getRoleIconSvg(c.role)}</div>
              <span style="font-weight:700; margin-top:8px;">${c.role.toUpperCase()}</span>
            </div>
          `).join('')}
        </div>
      `;

      this.modalOverlay.style.display = 'flex';

      const cards = this.modalContent.querySelectorAll('.sacrifice-card-opt');
      cards.forEach(cardEl => {
        cardEl.addEventListener('click', () => {
          const id = cardEl.getAttribute('data-id');
          const chosen = player.aliveCards.find(c => c.id === id);
          this.closeModal();
          resolve(chosen);
        });
      });
    });
  }

  renderGameOver(winner) {
    const isHumanWinner = winner && winner.isHuman;
    this.modalContent.innerHTML = `
      <h3 class="modal-title" style="font-size:2rem; color:${isHumanWinner ? '#fbbf24' : '#ef4444'};">
        ${isHumanWinner ? '🏆 VICTORY IS YOURS!' : '💀 YOU HAVE BEEN OVERTHROWN'}
      </h3>
      <p class="modal-desc" style="font-size:1.1rem;">
        ${winner ? `<strong>${winner.name}</strong> emerges supreme as the sole ruler of the Court!` : 'All rivals have fallen in the chaos.'}
      </p>
      <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px; text-align:center;">
        <p style="font-size:0.9rem; color:var(--text-secondary);">Total Rounds: <strong>${this.game.roundCount}</strong></p>
      </div>
      <div class="modal-button-group">
        <button class="btn-primary" id="btn-play-again" style="padding:14px 28px; font-size:1.1rem;">
          ⚔️ Play Again
        </button>
      </div>
    `;

    this.modalOverlay.style.display = 'flex';

    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.closeModal();
      this.game.startNewGame();
    });
  }

  showRulesModal() {
    this.modalContent.innerHTML = `
      <h3 class="modal-title">Coup - Rules & Characters Cheat Sheet</h3>
      <div class="rules-container">
        <div class="role-rule-row duke">
          <div style="width:40px; height:40px; flex-shrink:0;">${getRoleIconSvg(ROLES.DUKE)}</div>
          <div class="role-rule-info">
            <h4 style="color:var(--color-duke);">Duke</h4>
            <p><strong>Action:</strong> Tax (+3 coins from Treasury). Cannot be blocked.</p>
            <p><strong>Counteraction:</strong> Blocks any player from taking Foreign Aid (+2 coins).</p>
          </div>
        </div>

        <div class="role-rule-row assassin">
          <div style="width:40px; height:40px; flex-shrink:0;">${getRoleIconSvg(ROLES.ASSASSIN)}</div>
          <div class="role-rule-info">
            <h4 style="color:var(--color-assassin);">Assassin</h4>
            <p><strong>Action:</strong> Assassinate (Pay 3 coins). Target player loses 1 influence.</p>
            <p><strong>Counteraction:</strong> Blocked only by the Contessa.</p>
          </div>
        </div>

        <div class="role-rule-row captain">
          <div style="width:40px; height:40px; flex-shrink:0;">${getRoleIconSvg(ROLES.CAPTAIN)}</div>
          <div class="role-rule-info">
            <h4 style="color:var(--color-captain);">Captain</h4>
            <p><strong>Action:</strong> Steal 2 coins from another player.</p>
            <p><strong>Counteraction:</strong> Blocks other Captains from stealing from you.</p>
          </div>
        </div>

        <div class="role-rule-row ambassador">
          <div style="width:40px; height:40px; flex-shrink:0;">${getRoleIconSvg(ROLES.AMBASSADOR)}</div>
          <div class="role-rule-info">
            <h4 style="color:var(--color-ambassador);">Ambassador</h4>
            <p><strong>Action:</strong> Exchange (Draw 2 cards from deck, choose cards to keep, return 2).</p>
            <p><strong>Counteraction:</strong> Blocks other Captains from stealing from you.</p>
          </div>
        </div>

        <div class="role-rule-row contessa">
          <div style="width:40px; height:40px; flex-shrink:0;">${getRoleIconSvg(ROLES.CONTESSA)}</div>
          <div class="role-rule-info">
            <h4 style="color:var(--color-contessa);">Contessa</h4>
            <p><strong>Action:</strong> None.</p>
            <p><strong>Counteraction:</strong> Blocks Assassination. Protects you from death.</p>
          </div>
        </div>

        <div class="role-rule-row" style="border-left-color:#fbbf24;">
          <div class="role-rule-info">
            <h4 style="color:#fbbf24;">General Actions</h4>
            <p><strong>Income:</strong> Take 1 coin. Cannot be challenged or blocked.</p>
            <p><strong>Foreign Aid:</strong> Take 2 coins. Can be blocked by Duke.</p>
            <p><strong>Coup:</strong> Pay 7 coins. Target loses 1 influence immediately. Unblockable!</p>
            <p><strong>Mandatory Coup:</strong> If you start your turn with 10 or more coins, you MUST Coup!</p>
          </div>
        </div>

        <div class="role-rule-row" style="border-left-color:#f43f5e;">
          <div class="role-rule-info">
            <h4 style="color:#f43f5e;">The Art of Bluffing & Challenges</h4>
            <p>You can claim ANY character action or block, even if you do not hold that card!</p>
            <p>Any player may challenge your claim. If you were telling the truth, you reveal the card, reshuffle it for a new one, and the challenger loses an influence. If you were bluffing, you lose an influence and your action fails!</p>
          </div>
        </div>
      </div>
      <div class="modal-button-group">
        <button class="btn-primary" id="btn-close-rules">Understood</button>
      </div>
    `;

    this.modalOverlay.style.display = 'flex';
    document.getElementById('btn-close-rules').addEventListener('click', () => this.closeModal());
  }

  closeModal() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.modalOverlay.style.display = 'none';
  }
}
