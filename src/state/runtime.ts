import { resolveStorage } from '../storage/StorageAdapter';
import { PlayerRepository } from '../repositories/playerRepository';
import { GoldRepository } from '../repositories/goldRepository';
import { BattleRepository } from '../repositories/battleRepository';
import { GoldService } from '../services/goldService';
import { BattleService } from '../services/battleService';
import { RewardService } from '../services/rewardService';
import { FusionService } from '../services/fusionService';
import { MiningService } from '../services/miningService';
import { TradeService } from '../services/tradeService';
import type { StorageAdapter } from '../storage/StorageAdapter';

/**
 * APP RUNTIME WIRING
 * ==================
 * The single place the real game builds its data layer.
 *
 * Every dependency is injected downwards: the UI reaches a store, a store
 * reaches a service, a service reaches a repository, and a repository reaches
 * a StorageAdapter. Swapping the storage - or running the whole data layer
 * against an in-memory double - means changing this file and nothing else.
 */
export type AppRuntime = {
  storage: StorageAdapter;
  players: PlayerRepository;
  gold: GoldRepository;
  battles: BattleRepository;
  goldService: GoldService;
  battleService: BattleService;
  rewardService: RewardService;
  miningService: MiningService;
  fusionService: FusionService;
  tradeService: TradeService;
};

export const createRuntime = (storage: StorageAdapter): AppRuntime => {
  const players = new PlayerRepository(storage);
  const gold = new GoldRepository(storage);
  const battles = new BattleRepository(storage);
  const goldService = new GoldService(players, gold);
  const battleService = new BattleService(battles);
  const fusionService = new FusionService(players);
  const miningService = new MiningService(players);
  const tradeService = new TradeService(players, goldService);

  return {
    storage,
    players,
    gold,
    battles,
    goldService,
    battleService,
    rewardService: new RewardService(players, goldService, battleService),
    miningService,
    fusionService,
    tradeService,
  };
};

/** What the running game uses: the browser's storage, degrading to memory. */
export const runtime = createRuntime(resolveStorage());
