import {
  heroCopiesOf,
  heroInstanceLevelOf,
  heroInstanceStarsOf,
  heroSerialOf,
  heroStarsOf,
} from '../data/fusion';
import { getHeroById } from '../data/heroes';
import {
  goldItemPrice,
  heroTradePrice,
  isValidTradePrice,
  MAX_TRADE_OFFERS,
  MAX_TRADE_REQUESTS,
} from '../data/trade';
import type { TradeCurrency, TradeOffer, TradeRequest } from '../data/trade';
import type { PlayerRepository } from '../repositories/playerRepository';
import type { PlayerProfile } from '../storage/records';
import { withCopyGranted } from './fusionService';
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
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_NOT_ACTIVE'
  | 'SELF_REQUEST'
  | 'NO_MATCHING_REQUEST'
  | 'SELF_DELIVER'
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

const heroOfferSourceSerial = (offer: TradeOffer): number | null =>
  offer.kind === 'hero'
    ? offer.heroCopySerial ?? offer.heroSerial ?? null
    : null;

const heroOfferInstanceKey = (offer: TradeOffer): string =>
  offer.kind === 'hero'
    ? heroOfferSourceSerial(offer) === null
      ? `hero:main:${offer.heroId}`
      : `hero:instance:${offer.heroId}:${heroOfferSourceSerial(offer)}`
    : 'gold';

const positiveSerials = (serials: Array<number | null | undefined>): number[] => [
  ...new Set(serials.filter((serial): serial is number =>
    typeof serial === 'number' && Number.isInteger(serial) && serial > 0,
  )),
];

const removeHeroInstance = (
  profile: PlayerProfile,
  heroId: string,
  instanceSerial: number,
): PlayerProfile => {
  const mainSerial = heroSerialOf(profile.heroSerials, heroId);
  const copies = heroCopiesOf(profile.heroCopies, heroId);
  const withoutInstanceMaps = (serials: number[]): Pick<PlayerProfile,
    'heroInstanceLevels' | 'heroInstanceStars'> => ({
      heroInstanceLevels: Object.fromEntries(
        Object.entries(profile.heroInstanceLevels ?? {}).filter(([serial]) => !serials.includes(Number(serial))),
      ),
      heroInstanceStars: Object.fromEntries(
        Object.entries(profile.heroInstanceStars ?? {}).filter(([serial]) => !serials.includes(Number(serial))),
      ),
    });

  if (instanceSerial === mainSerial) {
    if (copies.length === 0) {
      const ownedHeroes = profile.ownedHeroes.filter((ownedHeroId) => ownedHeroId !== heroId);
      return {
        ...profile,
        ownedHeroes,
        heroLevels: Object.fromEntries(
          Object.entries(profile.heroLevels).filter(([levelHeroId]) => levelHeroId !== heroId),
        ),
        heroStars: Object.fromEntries(
          Object.entries(profile.heroStars ?? {}).filter(([starHeroId]) => starHeroId !== heroId),
        ),
        heroCopies: Object.fromEntries(
          Object.entries(profile.heroCopies ?? {}).filter(([copyHeroId]) => copyHeroId !== heroId),
        ),
        heroSerials: Object.fromEntries(
          Object.entries(profile.heroSerials ?? {}).filter(([serialHeroId]) => serialHeroId !== heroId),
        ),
        ...withoutInstanceMaps([instanceSerial]),
        equippedHeroId: profile.equippedHeroId === heroId ? ownedHeroes[0] : profile.equippedHeroId,
      };
    }

    const promotedSerial = copies[copies.length - 1];
    const promotedLevel = heroInstanceLevelOf(profile.heroInstanceLevels, 0, promotedSerial);
    const promotedStars = heroInstanceStarsOf(profile.heroInstanceStars, 1, promotedSerial);
    return {
      ...profile,
      heroSerials: { ...(profile.heroSerials ?? {}), [heroId]: promotedSerial },
      heroLevels: { ...profile.heroLevels, [heroId]: promotedLevel },
      heroStars: { ...(profile.heroStars ?? {}), [heroId]: promotedStars },
      heroCopies: {
        ...(profile.heroCopies ?? {}),
        [heroId]: copies.filter((serial) => serial !== promotedSerial),
      },
      ...withoutInstanceMaps([instanceSerial]),
    };
  }

  if (!copies.includes(instanceSerial)) return profile;
  return {
    ...profile,
    heroCopies: {
      ...(profile.heroCopies ?? {}),
      [heroId]: copies.filter((serial) => serial !== instanceSerial),
    },
    ...withoutInstanceMaps([instanceSerial]),
  };
};

const restoreHeroInstance = (profile: PlayerProfile, offer: TradeOffer): PlayerProfile => {
  if (offer.kind !== 'hero') return profile;
  const sourceSerial = heroOfferSourceSerial(offer);
  const legacyCopies = positiveSerials(offer.heroCopies ?? []);
  const ownsHero = profile.ownedHeroes.includes(offer.heroId);
  const mainSerial = heroSerialOf(profile.heroSerials, offer.heroId);

  if (sourceSerial === null) {
    if (ownsHero) return profile;
    const granted = withCopyGranted(profile, offer.heroId);
    const grantedSerial = heroCopiesOf(granted.heroCopies, offer.heroId).at(-1)
      ?? heroSerialOf(granted.heroSerials, offer.heroId);
    return {
      ...granted,
      heroLevels: { ...granted.heroLevels, [offer.heroId]: offer.heroLevel },
      heroStars: { ...(granted.heroStars ?? {}), [offer.heroId]: offer.heroStars },
      heroInstanceLevels: {
        ...(granted.heroInstanceLevels ?? {}),
        [String(grantedSerial ?? 0)]: offer.heroLevel,
      },
      heroInstanceStars: {
        ...(granted.heroInstanceStars ?? {}),
        [String(grantedSerial ?? 0)]: offer.heroStars,
      },
    };
  }

  const sourceIsMain = offer.heroCopySerial == null || sourceSerial === mainSerial;
  const restoredLegacyCopies = legacyCopies.filter((serial) =>
    serial !== sourceSerial && !heroCopiesOf(profile.heroCopies, offer.heroId).includes(serial),
  );
  const instanceState = {
    heroInstanceLevels: {
      ...(profile.heroInstanceLevels ?? {}),
      [String(sourceSerial)]: offer.heroLevel,
    },
    heroInstanceStars: {
      ...(profile.heroInstanceStars ?? {}),
      [String(sourceSerial)]: offer.heroStars,
    },
  };

  if (!ownsHero) {
    if (sourceIsMain) {
      return {
        ...profile,
        ownedHeroes: [...profile.ownedHeroes, offer.heroId],
        heroSerials: { ...(profile.heroSerials ?? {}), [offer.heroId]: sourceSerial },
        heroLevels: { ...profile.heroLevels, [offer.heroId]: offer.heroLevel },
        heroStars: { ...(profile.heroStars ?? {}), [offer.heroId]: offer.heroStars },
        heroCopies: {
          ...(profile.heroCopies ?? {}),
          [offer.heroId]: restoredLegacyCopies,
        },
        ...instanceState,
        equippedHeroId: offer.wasEquipped ? offer.heroId : profile.equippedHeroId,
      };
    }
    const granted = withCopyGranted(profile, offer.heroId);
    const promotedSerial = heroCopiesOf(granted.heroCopies, offer.heroId).at(-1) ?? sourceSerial;
    return {
      ...granted,
      heroCopies: {
        ...(granted.heroCopies ?? {}),
        [offer.heroId]: [
          ...heroCopiesOf(granted.heroCopies, offer.heroId).filter((serial) => serial !== promotedSerial),
          sourceSerial,
          ...restoredLegacyCopies,
        ],
      },
      ...instanceState,
    };
  }

  if (sourceIsMain && sourceSerial !== mainSerial) {
    const promotedSerial = mainSerial;
    const promotedLevel = heroInstanceLevelOf(profile.heroInstanceLevels, 0, promotedSerial);
    const promotedStars = heroInstanceStarsOf(profile.heroInstanceStars, 1, promotedSerial);
    return {
      ...profile,
      heroSerials: { ...(profile.heroSerials ?? {}), [offer.heroId]: sourceSerial },
      heroLevels: { ...profile.heroLevels, [offer.heroId]: offer.heroLevel },
      heroStars: { ...(profile.heroStars ?? {}), [offer.heroId]: offer.heroStars },
      heroCopies: {
        ...(profile.heroCopies ?? {}),
        [offer.heroId]: [
          ...heroCopiesOf(profile.heroCopies, offer.heroId),
          ...(promotedSerial === null ? [] : [promotedSerial]),
          ...restoredLegacyCopies,
        ],
      },
      ...instanceState,
      heroInstanceLevels: {
        ...instanceState.heroInstanceLevels,
        ...(promotedSerial === null ? {} : { [String(promotedSerial)]: promotedLevel }),
      },
      heroInstanceStars: {
        ...instanceState.heroInstanceStars,
        ...(promotedSerial === null ? {} : { [String(promotedSerial)]: promotedStars }),
      },
      equippedHeroId: offer.wasEquipped ? offer.heroId : profile.equippedHeroId,
    };
  }

  const currentCopies = heroCopiesOf(profile.heroCopies, offer.heroId);
  if (sourceIsMain && sourceSerial === mainSerial) {
    return {
      ...profile,
      heroCopies: {
        ...(profile.heroCopies ?? {}),
        [offer.heroId]: [
          ...currentCopies.filter((serial) => !restoredLegacyCopies.includes(serial)),
          ...restoredLegacyCopies,
        ],
      },
      ...instanceState,
    };
  }

  return {
    ...profile,
    heroCopies: {
      ...(profile.heroCopies ?? {}),
      [offer.heroId]: [
        ...currentCopies.filter((serial) => serial !== sourceSerial),
        sourceSerial,
        ...restoredLegacyCopies,
      ],
    },
    ...instanceState,
  };
};

const withHeroOfferGranted = (profile: PlayerProfile, offer: TradeOffer): PlayerProfile => {
  if (offer.kind !== 'hero') return profile;
  const sourceSerial = heroOfferSourceSerial(offer);
  const legacyCopies = positiveSerials(offer.heroCopies ?? []);

  if (sourceSerial === null) {
    return withCopyGranted(profile, offer.heroId);
  }

  const ownsHero = profile.ownedHeroes.includes(offer.heroId);
  const mainSerial = heroSerialOf(profile.heroSerials, offer.heroId);
  const currentCopies = heroCopiesOf(profile.heroCopies, offer.heroId);
  const receivedCopies = [...new Set([
    ...(ownsHero && sourceSerial !== mainSerial ? [sourceSerial] : []),
    ...legacyCopies.filter((serial) => serial !== mainSerial && serial !== sourceSerial),
  ])].filter((serial) => !currentCopies.includes(serial));
  const instanceLevels = {
    ...(profile.heroInstanceLevels ?? {}),
    ...(ownsHero ? { [String(sourceSerial)]: offer.heroLevel } : {}),
    ...Object.fromEntries(
      legacyCopies.map((serial) => [String(serial), 0]),
    ),
  };
  const instanceStars = {
    ...(profile.heroInstanceStars ?? {}),
    ...(ownsHero ? { [String(sourceSerial)]: offer.heroStars } : {}),
    ...Object.fromEntries(
      legacyCopies.map((serial) => [String(serial), 1]),
    ),
  };

  if (!ownsHero) {
    return {
      ...profile,
      ownedHeroes: [...profile.ownedHeroes, offer.heroId],
      heroSerials: { ...(profile.heroSerials ?? {}), [offer.heroId]: sourceSerial },
      heroLevels: { ...profile.heroLevels, [offer.heroId]: offer.heroLevel },
      heroStars: { ...(profile.heroStars ?? {}), [offer.heroId]: offer.heroStars },
      heroCopies: {
        ...(profile.heroCopies ?? {}),
        [offer.heroId]: legacyCopies.filter((serial) => serial !== sourceSerial),
      },
      heroInstanceLevels: {
        ...instanceLevels,
        [String(sourceSerial)]: offer.heroLevel,
      },
      heroInstanceStars: {
        ...instanceStars,
        [String(sourceSerial)]: offer.heroStars,
      },
    };
  }

  return {
    ...profile,
    heroCopies: {
      ...(profile.heroCopies ?? {}),
      [offer.heroId]: [...currentCopies, ...receivedCopies],
    },
    heroInstanceLevels: instanceLevels,
    heroInstanceStars: instanceStars,
  };
};

const createOfferId = (now: number): string => {
  offerSequence += 1;
  const token = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `offer_${now}_${offerSequence}_${token}`;
};

const createRequestId = (now: number): string => {
  offerSequence += 1;
  const token = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `request_${now}_${offerSequence}_${token}`;
};

export const tradeRequestsByPrice = (requests: readonly TradeRequest[]): TradeRequest[] =>
  [...requests].sort((left, right) => right.price - left.price || left.createdAt - right.createdAt);

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

  private requests(profile: PlayerProfile): TradeRequest[] {
    return profile.tradeRequests ?? [];
  }

  createHeroOffer(
    profile: PlayerProfile,
    heroId: string,
    price: number,
    currency: TradeCurrency,
    now: number,
    instanceSerial?: number,
  ): TradeOutcome {
    if (!isValidTradePrice(price, currency)) return insufficient(profile, 'INVALID_PRICE');
    const hero = getHeroById(heroId);
    if (hero === undefined) return insufficient(profile, 'INVALID_HERO');
    if (!profile.ownedHeroes.includes(heroId)) return insufficient(profile, 'NOT_OWNED');
    const offers = this.offers(profile);
    if (offers.length >= MAX_TRADE_OFFERS) return insufficient(profile, 'TOO_MANY_OFFERS');

    const copies = heroCopiesOf(profile.heroCopies, heroId);
    const mainSerial = heroSerialOf(profile.heroSerials, heroId);
    const selectedSerial = instanceSerial === undefined
      ? copies[copies.length - 1] ?? mainSerial
      : instanceSerial;
    if (selectedSerial === null || (selectedSerial !== mainSerial && !copies.includes(selectedSerial))) {
      return insufficient(profile, 'NOT_OWNED');
    }
    const sellsMain = selectedSerial === mainSerial;
    const selectedInstanceKey = sellsMain
      ? `hero:main:${heroId}`
      : `hero:instance:${heroId}:${selectedSerial}`;
    if (offers.some((offer) =>
      offer.status === 'active' &&
      offer.kind === 'hero' &&
      heroOfferInstanceKey(offer) === selectedInstanceKey,
    )) {
      return insufficient(profile, 'ALREADY_OFFERED');
    }
    if (sellsMain && profile.mining?.heroId === heroId) {
      return insufficient(profile, 'MINING_LOCKED');
    }

    const remainingHeroes = profile.ownedHeroes.filter((ownedHeroId) => ownedHeroId !== heroId);
    if (sellsMain && copies.length === 0 && remainingHeroes.length === 0) {
      return insufficient(profile, 'LAST_HERO');
    }
    const heroLevel = sellsMain
      ? profile.heroLevels[heroId] ?? 0
      : heroInstanceLevelOf(profile.heroInstanceLevels, 0, selectedSerial);
    const heroStars = sellsMain
      ? heroStarsOf(profile.heroStars, heroId)
      : heroInstanceStarsOf(profile.heroInstanceStars, 1, selectedSerial);
    const offer: TradeOffer = {
      offerId: createOfferId(now),
      sellerId: profile.playerId,
      kind: 'hero',
      heroId,
      heroLevel,
      heroStars,
      heroCopySerial: sellsMain ? null : selectedSerial,
      heroCopies: [],
      heroSerial: selectedSerial,
      wasEquipped: sellsMain && profile.equippedHeroId === heroId,
      currency,
      price,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const next: PlayerProfile = {
      ...removeHeroInstance(profile, heroId, selectedSerial),
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
      sellerId: profile.playerId,
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

  createHeroRequest(profile: PlayerProfile, heroId: string, price: number, now: number): TradeOutcome {
    if (getHeroById(heroId) === undefined) return insufficient(profile, 'INVALID_HERO');
    if (!isValidTradePrice(price, 'bwar')) return insufficient(profile, 'INVALID_PRICE');
    if (price > profile.bwarBalance + 1e-9) return insufficient(profile, 'INSUFFICIENT_FUNDS');
    const requests = this.requests(profile);
    if (requests.length >= MAX_TRADE_REQUESTS) return insufficient(profile, 'TOO_MANY_OFFERS');
    const request: TradeRequest = {
      requestId: createRequestId(now),
      requesterId: profile.playerId,
      kind: 'hero',
      heroId,
      price,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const next: PlayerProfile = {
      ...profile,
      bwarBalance: profile.bwarBalance - price,
      tradeRequests: [request, ...requests],
    };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  createGoldRequest(profile: PlayerProfile, goldAmount: number, price: number, now: number): TradeOutcome {
    if (!Number.isInteger(goldAmount) || goldAmount <= 0) return insufficient(profile, 'INVALID_AMOUNT');
    if (!isValidTradePrice(price, 'bwar')) return insufficient(profile, 'INVALID_PRICE');
    if (price > profile.bwarBalance + 1e-9) return insufficient(profile, 'INSUFFICIENT_FUNDS');
    const requests = this.requests(profile);
    if (requests.length >= MAX_TRADE_REQUESTS) return insufficient(profile, 'TOO_MANY_OFFERS');
    const request: TradeRequest = {
      requestId: createRequestId(now),
      requesterId: profile.playerId,
      kind: 'gold',
      goldAmount,
      price,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const next: PlayerProfile = {
      ...profile,
      bwarBalance: profile.bwarBalance - price,
      tradeRequests: [request, ...requests],
    };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  cancelRequest(profile: PlayerProfile, requestId: string, now: number): TradeOutcome {
    const requests = this.requests(profile);
    const request = requests.find((candidate) => candidate.requestId === requestId);
    if (request === undefined) return insufficient(profile, 'REQUEST_NOT_FOUND');
    if (request.requesterId !== profile.playerId) return insufficient(profile, 'SELF_REQUEST');
    if (request.status !== 'active') return insufficient(profile, 'REQUEST_NOT_ACTIVE');
    const cancelled: TradeRequest = { ...request, status: 'cancelled', updatedAt: now };
    const next: PlayerProfile = {
      ...profile,
      bwarBalance: profile.bwarBalance + request.price,
      tradeRequests: requests.map((candidate) =>
        candidate.requestId === requestId ? cancelled : candidate,
      ),
    };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  instantSellHero(
    profile: PlayerProfile,
    heroId: string,
    instanceSerial: number,
    now: number,
  ): TradeOutcome {
    const hero = getHeroById(heroId);
    if (hero === undefined) return insufficient(profile, 'INVALID_HERO');
    if (!profile.ownedHeroes.includes(heroId)) return insufficient(profile, 'NOT_OWNED');
    const requests = tradeRequestsByPrice(
      this.requests(profile).filter((request) =>
        request.status === 'active' &&
        request.kind === 'hero' &&
        request.heroId === heroId &&
        request.requesterId !== profile.playerId,
      ),
    );
    const request = requests[0];
    if (request === undefined) return insufficient(profile, 'NO_MATCHING_REQUEST');

    const copies = heroCopiesOf(profile.heroCopies, heroId);
    const mainSerial = heroSerialOf(profile.heroSerials, heroId);
    if (instanceSerial !== mainSerial && !copies.includes(instanceSerial)) {
      return insufficient(profile, 'NOT_OWNED');
    }
    const sellsMain = instanceSerial === mainSerial;
    if (sellsMain && profile.mining?.heroId === heroId) {
      return insufficient(profile, 'MINING_LOCKED');
    }
    if (sellsMain && copies.length === 0 && profile.ownedHeroes.length <= 1) {
      return insufficient(profile, 'LAST_HERO');
    }
    const fulfilled: TradeRequest = { ...request, status: 'fulfilled', updatedAt: now };
    const next: PlayerProfile = {
      ...removeHeroInstance(profile, heroId, instanceSerial),
      bwarBalance: profile.bwarBalance + request.price,
      tradeRequests: this.requests(profile).map((candidate) =>
        candidate.requestId === request.requestId ? fulfilled : candidate,
      ),
    };
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  instantSellGold(profile: PlayerProfile, goldAmount: number, now: number): TradeOutcome {
    if (!Number.isInteger(goldAmount) || goldAmount <= 0 || goldAmount > profile.goldBalance) {
      return insufficient(profile, goldAmount > profile.goldBalance ? 'INSUFFICIENT_FUNDS' : 'INVALID_AMOUNT');
    }
    const requests = tradeRequestsByPrice(
      this.requests(profile).filter((request) =>
        request.status === 'active' &&
        request.kind === 'gold' &&
        request.goldAmount === goldAmount &&
        request.requesterId !== profile.playerId,
      ),
    );
    const request = requests[0];
    if (request === undefined) return insufficient(profile, 'NO_MATCHING_REQUEST');
    const fulfilled: TradeRequest = { ...request, status: 'fulfilled', updatedAt: now };
    const paid = this.goldService.debit(
      {
        ...profile,
        bwarBalance: profile.bwarBalance + request.price,
        tradeRequests: this.requests(profile).map((candidate) =>
          candidate.requestId === request.requestId ? fulfilled : candidate,
        ),
      },
      goldAmount,
      { kind: 'SPEND' },
      now,
    );
    if (!paid.ok) return insufficient(profile, 'INSUFFICIENT_FUNDS');
    return { ok: true, profile: paid.profile };
  }

  delistOffer(profile: PlayerProfile, offerId: string, now: number): TradeOutcome {
    const offers = this.offers(profile);
    const offer = offers.find((candidate) => candidate.offerId === offerId);
    if (offer === undefined) return insufficient(profile, 'OFFER_NOT_FOUND');
    if (offer.status === 'delisted') return insufficient(profile, 'OFFER_CLOSED');

    const closedOffer: TradeOffer = { ...offer, status: 'delisted', updatedAt: now };
    const closedOffers = offers.map((candidate) => candidate.offerId === offerId ? closedOffer : candidate);

    if (offer.kind === 'hero') {
      const next: PlayerProfile = {
        ...restoreHeroInstance(profile, offer),
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
    if (offer.sellerId === profile.playerId) return insufficient(profile, 'SELF_DELIVER');
    if (offer.status !== 'active') return insufficient(profile, 'OFFER_NOT_ACTIVE');

    const deliveredOffer: TradeOffer = { ...offer, status: 'delivered', updatedAt: now };
    const deliveredOffers = offers.map((candidate) => candidate.offerId === offerId ? deliveredOffer : candidate);

    const receivingProfile: PlayerProfile = {
      ...withHeroOfferGranted(profile, offer),
      tradeOffers: deliveredOffers,
    };

    if (offer.currency === 'gold') {
      const paid = this.goldService.debit(receivingProfile, offer.price, { kind: 'SPEND' }, now);
      if (!paid.ok) return insufficient(profile, paid.reason === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_FUNDS' : 'INVALID_AMOUNT');
      return { ok: true, profile: paid.profile };
    }

    if (offer.price > profile.bwarBalance + 1e-9) return insufficient(profile, 'INSUFFICIENT_FUNDS');
    const next: PlayerProfile = {
      ...receivingProfile,
      bwarBalance: profile.bwarBalance - offer.price,
    };
    if (offer.kind === 'gold') {
      const received = this.goldService.credit(next, offer.goldAmount, { kind: 'GRANT' }, now);
      if (!received.ok) return insufficient(profile, 'INVALID_AMOUNT');
      return { ok: true, profile: received.profile };
    }
    if (!this.players.save(next)) return insufficient(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  buyHero(profile: PlayerProfile, heroId: string, currency: TradeCurrency, now: number): TradeOutcome {
    const hero = getHeroById(heroId);
    if (hero === undefined) return insufficient(profile, 'INVALID_HERO');
    const duplicateBase = profile.ownedHeroes.includes(heroId)
      ? withCopyGranted(profile, heroId)
      : profile;
    if (this.offers(profile).some(
      (offer) => offer.status === 'active' && offer.kind === 'hero' && offer.heroId === heroId,
    )) {
      return insufficient(profile, 'ALREADY_OFFERED');
    }

    const price = heroTradePrice(hero, 0, currency, 'buy');
    const withHero: PlayerProfile = duplicateBase.ownedHeroes.includes(heroId)
      ? duplicateBase
      : { ...duplicateBase, ownedHeroes: [...duplicateBase.ownedHeroes, heroId] };

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

  sellHero(
    profile: PlayerProfile,
    heroId: string,
    currency: TradeCurrency,
    now: number,
    instanceSerial?: number,
  ): TradeOutcome {
    const hero = getHeroById(heroId);
    if (hero === undefined) return insufficient(profile, 'INVALID_HERO');
    if (!profile.ownedHeroes.includes(heroId)) return insufficient(profile, 'NOT_OWNED');

    const copies = heroCopiesOf(profile.heroCopies, heroId);
    const mainSerial = heroSerialOf(profile.heroSerials, heroId);
    const selectedSerial = instanceSerial ?? copies[copies.length - 1] ?? mainSerial;
    if (selectedSerial === null || (selectedSerial !== mainSerial && !copies.includes(selectedSerial))) {
      return insufficient(profile, 'NOT_OWNED');
    }
    const sellsMain = selectedSerial === mainSerial;
    const remainingHeroes = profile.ownedHeroes.filter((ownedHeroId) => ownedHeroId !== heroId);
    if (sellsMain && profile.mining?.heroId === heroId) return insufficient(profile, 'MINING_LOCKED');
    if (sellsMain && copies.length === 0 && remainingHeroes.length === 0) {
      return insufficient(profile, 'LAST_HERO');
    }
    const level = sellsMain
      ? profile.heroLevels[heroId] ?? 0
      : heroInstanceLevelOf(profile.heroInstanceLevels, 0, selectedSerial);
    const stars = sellsMain
      ? heroStarsOf(profile.heroStars, heroId)
      : heroInstanceStarsOf(profile.heroInstanceStars, 1, selectedSerial);
    const withoutHero = removeHeroInstance(profile, heroId, selectedSerial);
    const price = heroTradePrice(hero, level, currency, 'sell', stars);

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
