import type { Hero, HeroRarity } from './heroes/types';

export type TradeCurrency = 'gold' | 'bwar';
export type TradeSide = 'buy' | 'sell';
export type TradeOfferKind = 'hero' | 'gold';
export type TradeOfferStatus = 'active' | 'delivered' | 'delisted';
export type TradeRequestKind = 'hero' | 'gold';
export type TradeRequestStatus = 'active' | 'fulfilled' | 'cancelled';

type TradeOfferBase = {
  offerId: string;
  sellerId: string;
  currency: TradeCurrency;
  price: number;
  status: TradeOfferStatus;
  createdAt: number;
  updatedAt: number;
};

export type HeroTradeOffer = TradeOfferBase & {
  kind: 'hero';
  heroId: string;
  heroLevel: number;
  heroStars: number;
  /**
   * Marks a spare-copy source for older saves. New offers always carry the
   * exact source in `heroSerial`.
   */
  heroCopySerial?: number | null;
  /** Legacy spare copies escrowed with an older main-instance offer. */
  heroCopies?: number[];
  /** Exact serial of the one Hero instance held in escrow. */
  heroSerial?: number | null;
  wasEquipped: boolean;
};

export type GoldTradeOffer = TradeOfferBase & {
  kind: 'gold';
  goldAmount: number;
};

export type TradeOffer = HeroTradeOffer | GoldTradeOffer;

type TradeRequestBase = {
  requestId: string;
  requesterId: string;
  /** Requests are always denominated and escrowed in local $BWAR. */
  price: number;
  status: TradeRequestStatus;
  createdAt: number;
  updatedAt: number;
};

export type HeroTradeRequest = TradeRequestBase & {
  kind: 'hero';
  heroId: string;
};

export type GoldTradeRequest = TradeRequestBase & {
  kind: 'gold';
  goldAmount: number;
};

export type TradeRequest = HeroTradeRequest | GoldTradeRequest;

/** 100 $GOLD buys or sells for 1 $BWAR. */
export const GOLD_TO_BWAR_RATE = 0.01;
export const MAX_TRADE_OFFERS = 100;
export const MAX_TRADE_REQUESTS = 100;
export const MAX_TRADE_PRICE = 1_000_000_000_000;

const HERO_BASE_GOLD: Record<HeroRarity, number> = {
  common: 500,
  uncommon: 1_000,
  rare: 2_500,
  epic: 5_000,
  legendary: 10_000,
};

const HERO_LEVEL_PRICE_MULTIPLIER = 0.05;
const HERO_SELL_RATIO = 0.6;

const goldPrice = (amount: number): number => Math.round(amount);

/** Hero market value after level scaling and the sell-side spread. */
export const heroTradePrice = (
  hero: Hero,
  level: number,
  currency: TradeCurrency,
  side: TradeSide,
  stars = 1,
): number => {
  const base = hero.priceInGold ?? HERO_BASE_GOLD[hero.rarity];
  const starMultiplier = 1 + Math.max(0, stars - 1) * 0.25;
  const levelValue = goldPrice(
    base * (1 + Math.max(0, level) * HERO_LEVEL_PRICE_MULTIPLIER) * starMultiplier,
  );
  const value = side === 'sell' ? goldPrice(levelValue * HERO_SELL_RATIO) : levelValue;
  return currency === 'gold' ? value : value * GOLD_TO_BWAR_RATE;
};

/** Gold is an item: both directions are quoted in $BWAR. */
export const goldItemPrice = (goldAmount: number): number => goldAmount * GOLD_TO_BWAR_RATE;

export const isValidTradePrice = (price: number, currency: TradeCurrency): boolean =>
  Number.isFinite(price) &&
  price > 0 &&
  price <= MAX_TRADE_PRICE &&
  (currency === 'gold' ? Number.isInteger(price) : true);

export const formatTradeAmount = (value: number, currency: TradeCurrency): string => {
  if (currency === 'gold') return `${Math.round(value).toLocaleString('en-US')} $GOLD`;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })} $BWAR`;
};
