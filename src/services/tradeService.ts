import { getHeroById } from '../data/heroes';
import { goldItemPrice, heroTradePrice } from '../data/trade';
import type { TradeCurrency } from '../data/trade';
import type { PlayerRepository } from '../repositories/playerRepository';
import type { PlayerProfile } from '../storage/records';
import type { GoldService } from './goldService';

export type TradeFailure =
  | 'INVALID_HERO'
  | 'ALREADY_OWNED'
  | 'NOT_OWNED'
  | 'MINING_LOCKED'
  | 'LAST_HERO'
  | 'INVALID_AMOUNT'
  | 'INSUFFICIENT_FUNDS'
  | 'SAVE_FAILED';

export type TradeOutcome =
  | { ok: true; profile: PlayerProfile }
  | { ok: false; reason: TradeFailure; profile: PlayerProfile };

const insufficient = (profile: PlayerProfile, reason: TradeFailure): TradeOutcome => ({
  ok: false,
  reason,
  profile,
});

const closeEnough = (left: number, right: number): boolean => Math.abs(left - right) < 1e-9;

/**
 * Local hero and Gold marketplace.
 *
 * Gold movement always goes through GoldService; BWAR is local and is updated
 * on the same profile before a combined save. The mining hero is deliberately
 * locked until MiningService.unstack settles and removes its session.
 */
export class TradeService {
  private readonly players: PlayerRepository;
  private readonly goldService: GoldService;

  constructor(players: PlayerRepository, goldService: GoldService) {
    this.players = players;
    this.goldService = goldService;
  }

  buyHero(profile: PlayerProfile, heroId: string, currency: TradeCurrency, now: number): TradeOutcome {
    const hero = getHeroById(heroId);
    if (hero === undefined) return insufficient(profile, 'INVALID_HERO');
    if (profile.ownedHeroes.includes(heroId)) return insufficient(profile, 'ALREADY_OWNED');

    const price = heroTradePrice(hero, 0, currency, 'buy');
    const withHero: PlayerProfile = { ...profile, ownedHeroes: [...profile.ownedHeroes, heroId] };

    if (currency === 'gold') {
      const paid = this.goldService.debit(withHero, price, { kind: 'SPEND' }, now);
      if (!paid.ok) return insufficient(profile, paid.reason === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_FUNDS' : 'INVALID_AMOUNT');
      return { ok: true, profile: paid.profile };
    }

    if (price > profile.bwarBalance + 1e-9) return insufficient(profile, 'INSUFFICIENT_FUNDS');
    const next = { ...withHero, bwarBalance: profile.bwarBalance - price };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  sellHero(profile: PlayerProfile, heroId: string, currency: TradeCurrency, now: number): TradeOutcome {
    const hero = getHeroById(heroId);
    if (hero === undefined) return insufficient(profile, 'INVALID_HERO');
    if (!profile.ownedHeroes.includes(heroId)) return insufficient(profile, 'NOT_OWNED');
    if (profile.mining?.heroId === heroId) return insufficient(profile, 'MINING_LOCKED');

    const remainingHeroes = profile.ownedHeroes.filter((ownedHeroId) => ownedHeroId !== heroId);
    if (remainingHeroes.length === 0) return insufficient(profile, 'LAST_HERO');
    const withoutHero: PlayerProfile = {
      ...profile,
      ownedHeroes: remainingHeroes,
      heroLevels: Object.fromEntries(
        Object.entries(profile.heroLevels).filter(([ownedHeroId]) => ownedHeroId !== heroId),
      ),
      equippedHeroId:
        profile.equippedHeroId === heroId
          ? remainingHeroes[0]
          : profile.equippedHeroId,
    };

    const level = profile.heroLevels[heroId] ?? 0;
    const price = heroTradePrice(hero, level, currency, 'sell');

    if (currency === 'gold') {
      const credited = this.goldService.credit(withoutHero, price, { kind: 'GRANT' }, now);
      if (!credited.ok) return insufficient(profile, 'INVALID_AMOUNT');
      return { ok: true, profile: credited.profile };
    }

    const next = { ...withoutHero, bwarBalance: profile.bwarBalance + price };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  buyGold(profile: PlayerProfile, goldAmount: number, now: number): TradeOutcome {
    if (!Number.isInteger(goldAmount) || goldAmount <= 0) return insufficient(profile, 'INVALID_AMOUNT');
    const price = goldItemPrice(goldAmount);
    if (price > profile.bwarBalance + 1e-9) return insufficient(profile, 'INSUFFICIENT_FUNDS');

    const payingBwar: PlayerProfile = { ...profile, bwarBalance: profile.bwarBalance - price };
    const credited = this.goldService.credit(payingBwar, goldAmount, { kind: 'GRANT' }, now);
    if (!credited.ok) return insufficient(profile, 'INVALID_AMOUNT');
    return { ok: true, profile: credited.profile };
  }

  sellGold(profile: PlayerProfile, goldAmount: number, now: number): TradeOutcome {
    if (!Number.isInteger(goldAmount) || goldAmount <= 0 || goldAmount > profile.goldBalance) {
      return insufficient(profile, goldAmount > profile.goldBalance ? 'INSUFFICIENT_FUNDS' : 'INVALID_AMOUNT');
    }

    const price = goldItemPrice(goldAmount);
    const receivingBwar: PlayerProfile = { ...profile, bwarBalance: profile.bwarBalance + price };
    const debited = this.goldService.debit(receivingBwar, goldAmount, { kind: 'SPEND' }, now);
    if (!debited.ok) return insufficient(profile, 'INSUFFICIENT_FUNDS');
    return { ok: true, profile: debited.profile };
  }
}

export const tradePricesMatch = closeEnough;
