import type { Hero, HeroRarity } from './heroes/types';

export type TradeCurrency = 'gold' | 'bwar';
export type TradeSide = 'buy' | 'sell';
export type TradeOfferKind = 'hero' | 'gold';
export type TradeOfferStatus = 'active' | 'delivered' | 'delisted';

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
  wasEquipped: boolean;
};

export type GoldTradeOffer = TradeOfferBase & {
  kind: 'gold';
  goldAmount: number;
};

export type TradeOffer = HeroTradeOffer | GoldTradeOffer;

/** 100 $GOLD buys or sells for 1 $BWAR. */
export const GOLD_TO_BWAR_RATE = 0.01;
export const MAX_TRADE_OFFERS = 100;
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
): number => {
  const base = hero.priceInGold ?? HERO_BASE_GOLD[hero.rarity];
  const levelValue = goldPrice(base * (1 + Math.max(0, level) * HERO_LEVEL_PRICE_MULTIPLIER));
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
