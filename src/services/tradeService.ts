import { getHeroById } from '../data/heroes';
import { goldItemPrice, heroTradePrice, isValidTradePrice, MAX_TRADE_OFFERS } from '../data/trade';
import type { TradeCurrency, TradeOffer } from '../data/trade';
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
  | 'INVALID_PRICE'
  | 'INSUFFICIENT_FUNDS'
  | 'ALREADY_OFFERED'
  | 'TOO_MANY_OFFERS'
  | 'OFFER_NOT_FOUND'
  | 'OFFER_CLOSED'
  | 'OFFER_NOT_ACTIVE'
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
let offerSequence = 0;

const createOfferId = (now: number): string => {
  offerSequence += 1;
  const token = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `offer_${now}_${offerSequence}_${token}`;
};

/**
 * Local custom-price hero and Gold marketplace.
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

  private offers(profile: PlayerProfile): TradeOffer[] {
    return profile.tradeOffers ?? [];
  }

  createHeroOffer(
    profile: PlayerProfile,
    heroId: string,
    price: number,
    currency: TradeCurrency,
    now: number,
  ): TradeOutcome {
    if (!isValidTradePrice(price, currency)) return insufficient(profile, 'INVALID_PRICE');
    const hero = getHeroById(heroId);
    if (hero === undefined) return insufficient(profile, 'INVALID_HERO');
    if (!profile.ownedHeroes.includes(heroId)) return insufficient(profile, 'NOT_OWNED');
    if (profile.mining?.heroId === heroId) return insufficient(profile, 'MINING_LOCKED');
    const offers = this.offers(profile);
    if (offers.length >= MAX_TRADE_OFFERS) return insufficient(profile, 'TOO_MANY_OFFERS');
    if (offers.some((offer) => offer.status === 'active' && offer.kind === 'hero' && offer.heroId === heroId)) {
      return insufficient(profile, 'ALREADY_OFFERED');
    }

    const remainingHeroes = profile.ownedHeroes.filter((ownedHeroId) => ownedHeroId !== heroId);
    if (remainingHeroes.length === 0) return insufficient(profile, 'LAST_HERO');
    const heroLevel = profile.heroLevels[heroId] ?? 0;
    const offer: TradeOffer = {
      offerId: createOfferId(now),
      kind: 'hero',
      heroId,
      heroLevel,
      wasEquipped: profile.equippedHeroId === heroId,
      currency,
      price,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const next: PlayerProfile = {
      ...profile,
      ownedHeroes: remainingHeroes,
      heroLevels: Object.fromEntries(
        Object.entries(profile.heroLevels).filter(([ownedHeroId]) => ownedHeroId !== heroId),
      ),
      equippedHeroId: profile.equippedHeroId === heroId ? remainingHeroes[0] : profile.equippedHeroId,
      tradeOffers: [offer, ...offers],
    };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  createGoldOffer(
    profile: PlayerProfile,
    goldAmount: number,
    price: number,
    now: number,
  ): TradeOutcome {
    if (!Number.isInteger(goldAmount) || goldAmount <= 0) return insufficient(profile, 'INVALID_AMOUNT');
    if (!isValidTradePrice(price, 'bwar')) return insufficient(profile, 'INVALID_PRICE');
    const offers = this.offers(profile);
    if (offers.length >= MAX_TRADE_OFFERS) return insufficient(profile, 'TOO_MANY_OFFERS');
    if (offers.some((offer) => offer.status === 'active' && offer.kind === 'gold')) {
      return insufficient(profile, 'ALREADY_OFFERED');
    }
    const offer: TradeOffer = {
      offerId: createOfferId(now),
      kind: 'gold',
      goldAmount,
      currency: 'bwar',
      price,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const withOffer: PlayerProfile = { ...profile, tradeOffers: [offer, ...offers] };
    const escrowed = this.goldService.debit(withOffer, goldAmount, { kind: 'SPEND' }, now);
    if (!escrowed.ok) {
      return insufficient(profile, escrowed.reason === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_FUNDS' : 'INVALID_AMOUNT');
    }
    return { ok: true, profile: escrowed.profile };
  }

  delistOffer(profile: PlayerProfile, offerId: string, now: number): TradeOutcome {
    const offers = this.offers(profile);
    const offer = offers.find((candidate) => candidate.offerId === offerId);
    if (offer === undefined) return insufficient(profile, 'OFFER_NOT_FOUND');
    if (offer.status === 'delisted') return insufficient(profile, 'OFFER_CLOSED');

    const closedOffer: TradeOffer = { ...offer, status: 'delisted', updatedAt: now };
    const closedOffers = offers.map((candidate) => candidate.offerId === offerId ? closedOffer : candidate);

    if (offer.status === 'active' && offer.kind === 'hero') {
      const owned = profile.ownedHeroes.includes(offer.heroId)
        ? profile.ownedHeroes
        : [...profile.ownedHeroes, offer.heroId];
      const next: PlayerProfile = {
        ...profile,
        ownedHeroes: owned,
        heroLevels: { ...profile.heroLevels, [offer.heroId]: offer.heroLevel },
        equippedHeroId: offer.wasEquipped ? offer.heroId : profile.equippedHeroId,
        tradeOffers: closedOffers,
      };
      if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
      return { ok: true, profile: next };
    }

    if (offer.status === 'active' && offer.kind === 'gold') {
      const refunded = this.goldService.credit(
        { ...profile, tradeOffers: closedOffers },
        offer.goldAmount,
        { kind: 'GRANT' },
        now,
      );
      if (!refunded.ok) return insufficient(profile, 'INVALID_AMOUNT');
      return { ok: true, profile: refunded.profile };
    }

    const next: PlayerProfile = { ...profile, tradeOffers: closedOffers };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  deliverOffer(profile: PlayerProfile, offerId: string, now: number): TradeOutcome {
    const offers = this.offers(profile);
    const offer = offers.find((candidate) => candidate.offerId === offerId);
    if (offer === undefined) return insufficient(profile, 'OFFER_NOT_FOUND');
    if (offer.status !== 'active') return insufficient(profile, 'OFFER_NOT_ACTIVE');

    const deliveredOffer: TradeOffer = { ...offer, status: 'delivered', updatedAt: now };
    const deliveredOffers = offers.map((candidate) => candidate.offerId === offerId ? deliveredOffer : candidate);

    if (offer.kind === 'hero' && offer.currency === 'gold') {
      const delivered = this.goldService.credit(
        { ...profile, tradeOffers: deliveredOffers },
        offer.price,
        { kind: 'GRANT' },
        now,
      );
      if (!delivered.ok) return insufficient(profile, 'INVALID_PRICE');
      return { ok: true, profile: delivered.profile };
    }

    const next: PlayerProfile = {
      ...profile,
      bwarBalance: profile.bwarBalance + offer.price,
      tradeOffers: deliveredOffers,
    };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
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
