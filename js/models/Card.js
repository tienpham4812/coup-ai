// Card roles and representations for Coup

export const ROLES = {
  DUKE: 'duke',
  ASSASSIN: 'assassin',
  CAPTAIN: 'captain',
  AMBASSADOR: 'ambassador',
  CONTESSA: 'contessa'
};

export const ROLE_INFO = {
  [ROLES.DUKE]: {
    id: ROLES.DUKE,
    name: 'Duke',
    title: 'The Sovereign Taxer',
    color: '#8b5cf6',
    secondaryColor: '#c084fc',
    goldAccent: '#fbbf24',
    bgGradient: 'linear-gradient(145deg, #2e1065, #4c1d95, #1e1b4b)',
    action: {
      id: 'tax',
      name: 'Tax',
      description: 'Take 3 coins from the Treasury.',
      gain: 3,
      cost: 0,
      requiresTarget: false,
      blockable: false,
      challengeable: true
    },
    blocks: [
      {
        actionId: 'foreign_aid',
        name: 'Block Foreign Aid',
        description: 'Prevent any player from taking Foreign Aid (+2 coins).'
      }
    ],
    summary: 'Tax +3 coins. Blocks Foreign Aid.',
    lore: 'Commands the royal treasury with an iron fist, seizing wealth for the crown.'
  },
  [ROLES.ASSASSIN]: {
    id: ROLES.ASSASSIN,
    name: 'Assassin',
    title: 'The Shadow Stalker',
    color: '#ef4444',
    secondaryColor: '#f87171',
    goldAccent: '#f59e0b',
    bgGradient: 'linear-gradient(145deg, #450a0a, #7f1d1d, #1c1917)',
    action: {
      id: 'assassinate',
      name: 'Assassinate',
      description: 'Pay 3 coins to eliminate one influence of target player.',
      gain: 0,
      cost: 3,
      requiresTarget: true,
      blockable: true,
      blockedBy: [ROLES.CONTESSA],
      challengeable: true
    },
    blocks: [],
    summary: 'Pay 3 coins to assassinate a rival. Blocked by Contessa.',
    lore: 'Strikes from the dark alleyways, ending noble bloodlines for a modest bounty.'
  },
  [ROLES.CAPTAIN]: {
    id: ROLES.CAPTAIN,
    name: 'Captain',
    title: 'The Sea Plunderer',
    color: '#06b6d4',
    secondaryColor: '#38bdf8',
    goldAccent: '#f59e0b',
    bgGradient: 'linear-gradient(145deg, #083344, #0e7490, #0f172a)',
    action: {
      id: 'steal',
      name: 'Steal',
      description: 'Steal 2 coins from another player (or 1 if they only have 1).',
      gain: 2,
      cost: 0,
      requiresTarget: true,
      blockable: true,
      blockedBy: [ROLES.CAPTAIN, ROLES.AMBASSADOR],
      challengeable: true
    },
    blocks: [
      {
        actionId: 'steal',
        name: 'Block Stealing',
        description: 'Block another Captain from stealing coins from you.'
      }
    ],
    summary: 'Steal 2 coins from a player. Blocks Stealing.',
    lore: 'Commands privateers in the harbor, exacting heavy tolls from all who trade.'
  },
  [ROLES.AMBASSADOR]: {
    id: ROLES.AMBASSADOR,
    name: 'Ambassador',
    title: 'The Grand Diplomat',
    color: '#10b981',
    secondaryColor: '#34d399',
    goldAccent: '#fbbf24',
    bgGradient: 'linear-gradient(145deg, #064e3b, #047857, #022c22)',
    action: {
      id: 'exchange',
      name: 'Exchange',
      description: 'Draw 2 cards from Court Deck, choose cards to keep, return 2.',
      gain: 0,
      cost: 0,
      requiresTarget: false,
      blockable: false,
      challengeable: true
    },
    blocks: [
      {
        actionId: 'steal',
        name: 'Block Stealing',
        description: 'Block another Captain from stealing coins from you.'
      }
    ],
    summary: 'Exchange cards with Court Deck. Blocks Stealing.',
    lore: 'Weaves intricate webs of alliance and deceit among the courts of Europe.'
  },
  [ROLES.CONTESSA]: {
    id: ROLES.CONTESSA,
    name: 'Contessa',
    title: 'The Noble Protector',
    color: '#ec4899',
    secondaryColor: '#f472b6',
    goldAccent: '#fbbf24',
    bgGradient: 'linear-gradient(145deg, #500724, #9d174d, #1f1422)',
    action: null,
    blocks: [
      {
        actionId: 'assassinate',
        name: 'Block Assassination',
        description: 'Block an Assassin from eliminating your influence.'
      }
    ],
    summary: 'Blocks Assassination. Has no special action.',
    lore: 'Surrounded by sworn paladins and court intrigue, untouchable to common assassins.'
  }
};

export const GENERAL_ACTIONS = {
  INCOME: {
    id: 'income',
    name: 'Income',
    description: 'Take 1 coin from the Treasury. (Cannot be blocked or challenged)',
    cost: 0,
    gain: 1,
    requiresTarget: false,
    blockable: false,
    challengeable: false
  },
  FOREIGN_AID: {
    id: 'foreign_aid',
    name: 'Foreign Aid',
    description: 'Take 2 coins from the Treasury. (Can be blocked by Duke)',
    cost: 0,
    gain: 2,
    requiresTarget: false,
    blockable: true,
    blockedBy: [ROLES.DUKE],
    challengeable: false
  },
  COUP: {
    id: 'coup',
    name: 'Coup',
    description: 'Pay 7 coins. Target player loses 1 influence immediately. (Unblockable & Unchallengeable)',
    cost: 7,
    gain: 0,
    requiresTarget: true,
    blockable: false,
    challengeable: false
  }
};

// SVG Icon Helpers
export function getRoleIconSvg(role) {
  switch (role) {
    case ROLES.DUKE:
      // Crown & Money Scepter
      return `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="role-icon">
          <path d="M8 44L14 18L26 32L32 14L38 32L50 18L56 44H8Z" fill="url(#duke-gold)" stroke="#d97706" stroke-width="2" stroke-linejoin="round"/>
          <rect x="12" y="46" width="40" height="8" rx="2" fill="url(#duke-gold)" stroke="#b45309" stroke-width="2"/>
          <circle cx="14" cy="18" r="3.5" fill="#fef08a" stroke="#d97706" stroke-width="1.5"/>
          <circle cx="32" cy="14" r="4.5" fill="#fef08a" stroke="#d97706" stroke-width="1.5"/>
          <circle cx="50" cy="18" r="3.5" fill="#fef08a" stroke="#d97706" stroke-width="1.5"/>
          <circle cx="32" cy="36" r="3.5" fill="#a855f7" stroke="#7e22ce" stroke-width="1"/>
          <circle cx="24" cy="50" r="2" fill="#ef4444"/>
          <circle cx="32" cy="50" r="2" fill="#3b82f6"/>
          <circle cx="40" cy="50" r="2" fill="#10b981"/>
          <defs>
            <linearGradient id="duke-gold" x1="8" y1="14" x2="56" y2="54" gradientUnits="userSpaceOnUse">
              <stop stop-color="#fef08a"/>
              <stop offset="0.5" stop-color="#f59e0b"/>
              <stop offset="1" stop-color="#b45309"/>
            </linearGradient>
          </defs>
        </svg>
      `;

    case ROLES.ASSASSIN:
      // Crossed daggers & hooded skull / poison drops
      return `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="role-icon">
          <path d="M12 52L30 34M52 52L34 34" stroke="#71717a" stroke-width="4" stroke-linecap="round"/>
          <path d="M14 54L8 60M50 54L56 60" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
          <path d="M22 26L48 4L42 18L32 20L22 26Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
          <path d="M42 26L16 4L22 18L32 20L42 26Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
          <circle cx="32" cy="24" r="14" fill="#1c1917" stroke="#ef4444" stroke-width="2"/>
          <path d="M24 22C24 17 40 17 40 22C40 28 32 32 32 32C32 32 24 28 24 22Z" fill="#450a0a"/>
          <circle cx="28" cy="22" r="2" fill="#ef4444"/>
          <circle cx="36" cy="22" r="2" fill="#ef4444"/>
          <path d="M30 28L32 30L34 28" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      `;

    case ROLES.CAPTAIN:
      // Anchor and naval wheel / crossed sabers
      return `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="role-icon">
          <circle cx="32" cy="14" r="6" stroke="#38bdf8" stroke-width="3" fill="none"/>
          <line x1="32" y1="20" x2="32" y2="52" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
          <line x1="20" y1="28" x2="44" y2="28" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
          <path d="M14 38C14 49 50 49 50 38" stroke="#0284c7" stroke-width="4" stroke-linecap="round" fill="none"/>
          <path d="M12 34L14 39L18 36" fill="#38bdf8"/>
          <path d="M52 34L50 39L46 36" fill="#38bdf8"/>
          <circle cx="32" cy="38" r="3" fill="#f59e0b"/>
          <circle cx="20" cy="28" r="2" fill="#f59e0b"/>
          <circle cx="44" cy="28" r="2" fill="#f59e0b"/>
        </svg>
      `;

    case ROLES.AMBASSADOR:
      // Scales of diplomacy & wax seal / parchment
      return `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="role-icon">
          <line x1="32" y1="10" x2="32" y2="54" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <line x1="12" y1="20" x2="52" y2="20" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
          <path d="M12 20L8 36H24L20 20" stroke="#34d399" stroke-width="2" fill="#064e3b" fill-opacity="0.6"/>
          <path d="M52 20L48 36H32L36 20" stroke="#34d399" stroke-width="2" fill="#064e3b" fill-opacity="0.6"/>
          <circle cx="32" cy="10" r="4" fill="#fbbf24"/>
          <circle cx="16" cy="36" r="2" fill="#fbbf24"/>
          <circle cx="40" cy="36" r="2" fill="#fbbf24"/>
          <rect x="24" y="50" width="16" height="5" rx="2" fill="#fbbf24"/>
          <circle cx="32" cy="32" r="5" fill="#10b981" stroke="#34d399" stroke-width="1.5"/>
        </svg>
      `;

    case ROLES.CONTESSA:
      // Royal shield with rose and diamond crown
      return `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="role-icon">
          <path d="M32 8L48 16V34C48 45 32 54 32 54C32 54 16 45 16 34V16L32 8Z" fill="url(#contessa-grad)" stroke="#f472b6" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M32 16L40 22V32C40 39 32 45 32 45C32 45 24 39 24 32V22L32 16Z" fill="#831843" stroke="#fbcfe8" stroke-width="1.5"/>
          <circle cx="32" cy="30" r="4.5" fill="#f43f5e"/>
          <circle cx="32" cy="30" r="2" fill="#fde047"/>
          <defs>
            <linearGradient id="contessa-grad" x1="16" y1="8" x2="48" y2="54" gradientUnits="userSpaceOnUse">
              <stop stop-color="#be185d"/>
              <stop offset="1" stop-color="#4c0519"/>
            </linearGradient>
          </defs>
        </svg>
      `;

    default:
      return '';
  }
}

export class Card {
  constructor(role, id = null) {
    this.id = id || `card_${role}_${Math.random().toString(36).substring(2, 9)}`;
    this.role = role;
    this.revealed = false; // true if this influence has been lost and revealed
  }

  get info() {
    return ROLE_INFO[this.role];
  }

  reveal() {
    this.revealed = true;
  }
}
