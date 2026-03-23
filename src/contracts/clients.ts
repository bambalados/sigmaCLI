import { getContract, type PublicClient, type WalletClient, type Transport, type Chain, type Account } from 'viem';
import { ADDRESSES } from './addresses.js';
import { erc20Abi } from './abis/ERC20.js';
import { wbnbAbi } from './abis/WBNB.js';
import { poolManagerAbi } from './abis/PoolManager.js';
import { bnbusdBasePoolAbi } from './abis/BNBUSDBasePool.js';
import { pegKeeperAbi } from './abis/PegKeeper.js';
import { priceOracleAbi } from './abis/PriceOracle.js';
import { xSigmaAbi } from './abis/xSigma.js';
import { gaugeEmissionAbi } from './abis/GaugeEmission.js';
import { curvePoolAbi, curveTwocryptoAbi } from './abis/CurvePool.js';
import { curveGaugeAbi } from './abis/CurveGauge.js';
import { syAbi } from './abis/SY.js';
import { iPoolAbi } from './abis/IPool.js';
import { sigmaControllerAbi } from './abis/SigmaController.js';
import { pancakeSwapRouterAbi, pancakeQuoterAbi } from './abis/PancakeSwapV3.js';
import { voteModuleAbi } from './abis/VoteModule.js';
import { voterAbi } from './abis/Voter.js';
import { feeDistributorAbi } from './abis/FeeDistributor.js';
import { VOTE_MODULE, VOTER } from './addresses.js';

export type ReadClients = { public: PublicClient };
export type BscWalletClient = WalletClient<Transport, Chain, Account>;
export type WriteClients = { public: PublicClient; wallet: BscWalletClient };

function readContract<T extends readonly unknown[]>(
  address: `0x${string}`,
  abi: T,
  clients: ReadClients,
) {
  return getContract({
    address,
    abi,
    client: { public: clients.public },
  });
}

function writeContract<T extends readonly unknown[]>(
  address: `0x${string}`,
  abi: T,
  clients: WriteClients,
) {
  return getContract({
    address,
    abi,
    client: { public: clients.public, wallet: clients.wallet },
  });
}

// Read-only factories (no wallet needed)
export const readBnbUsd = (c: ReadClients) => readContract(ADDRESSES.BNBUSD, erc20Abi, c);
export const readSigma = (c: ReadClients) => readContract(ADDRESSES.SIGMA, erc20Abi, c);
export const readXSigma = (c: ReadClients) => readContract(ADDRESSES.XSIGMA, xSigmaAbi, c);
export const readWbnb = (c: ReadClients) => readContract(ADDRESSES.WBNB, wbnbAbi, c);
export const readUsdt = (c: ReadClients) => readContract(ADDRESSES.USDT, erc20Abi, c);
export const readPoolManager = (c: ReadClients) => readContract(ADDRESSES.POOL_MANAGER, poolManagerAbi, c);
export const readPegKeeper = (c: ReadClients) => readContract(ADDRESSES.PEG_KEEPER, pegKeeperAbi, c);
export const readPriceOracle = (c: ReadClients) => readContract(ADDRESSES.BNB_PRICE_ORACLE, priceOracleAbi, c);
export const readBnbUsdBasePool = (c: ReadClients) => readContract(ADDRESSES.BNBUSD_BASE_POOL, bnbusdBasePoolAbi, c);
export const readStabilityPool = (addr: `0x${string}`, c: ReadClients) => readContract(addr, bnbusdBasePoolAbi, c);
export const readGaugeEmission = (c: ReadClients) => readContract(ADDRESSES.GAUGE_EMISSION, gaugeEmissionAbi, c);
export const readCurveGauge = (addr: `0x${string}`, c: ReadClients) => readContract(addr, curveGaugeAbi, c);
export const readCurvePool = (addr: `0x${string}`, c: ReadClients) => readContract(addr, curvePoolAbi, c);
export const readCurveTwocrypto = (addr: `0x${string}`, c: ReadClients) => readContract(addr, curveTwocryptoAbi, c);
export const readSy = (c: ReadClients) => readContract(ADDRESSES.SY, syAbi, c);
export const readErc20 = (addr: `0x${string}`, c: ReadClients) => readContract(addr, erc20Abi, c);

// Write factories (wallet required)
export const writeBnbUsd = (c: WriteClients) => writeContract(ADDRESSES.BNBUSD, erc20Abi, c);
export const writeSigma = (c: WriteClients) => writeContract(ADDRESSES.SIGMA, erc20Abi, c);
export const writeXSigma = (c: WriteClients) => writeContract(ADDRESSES.XSIGMA, xSigmaAbi, c);
export const writeWbnb = (c: WriteClients) => writeContract(ADDRESSES.WBNB, wbnbAbi, c);
export const writePoolManager = (c: WriteClients) => writeContract(ADDRESSES.POOL_MANAGER, poolManagerAbi, c);
export const writeBnbUsdBasePool = (c: WriteClients) => writeContract(ADDRESSES.BNBUSD_BASE_POOL, bnbusdBasePoolAbi, c);
export const writeGaugeEmission = (c: WriteClients) => writeContract(ADDRESSES.GAUGE_EMISSION, gaugeEmissionAbi, c);
export const writeCurveGauge = (addr: `0x${string}`, c: WriteClients) => writeContract(addr, curveGaugeAbi, c);
export const writeCurvePool = (addr: `0x${string}`, c: WriteClients) => writeContract(addr, curvePoolAbi, c);
export const writeCurveTwocrypto = (addr: `0x${string}`, c: WriteClients) => writeContract(addr, curveTwocryptoAbi, c);
export const writeSy = (c: WriteClients) => writeContract(ADDRESSES.SY, syAbi, c);
export const writeErc20 = (addr: `0x${string}`, c: WriteClients) => writeContract(addr, erc20Abi, c);
export const writeStabilityPool = (addr: `0x${string}`, c: WriteClients) => writeContract(addr, bnbusdBasePoolAbi, c);

// IPool (leveraged position pools)
export const readIPool = (addr: `0x${string}`, c: ReadClients) => readContract(addr, iPoolAbi, c);
export const writeIPool = (addr: `0x${string}`, c: WriteClients) => writeContract(addr, iPoolAbi, c);

// SigmaController (bnbUSD minting/redeeming)
export const readSigmaController = (c: ReadClients) => readContract(ADDRESSES.SIGMA_CONTROLLER, sigmaControllerAbi, c);
export const writeSigmaController = (c: WriteClients) => writeContract(ADDRESSES.SIGMA_CONTROLLER, sigmaControllerAbi, c);

// ShortPoolManager (same operate signature as PoolManager)
export const writeShortPoolManager = (c: WriteClients) => writeContract(ADDRESSES.SHORT_POOL_MANAGER, poolManagerAbi, c);

// PancakeSwap V3
export const readPancakeQuoter = (c: ReadClients) => readContract(ADDRESSES.PANCAKE_V3_QUOTER, pancakeQuoterAbi, c);
export const writePancakeRouter = (c: WriteClients) => writeContract(ADDRESSES.PANCAKE_V3_ROUTER, pancakeSwapRouterAbi, c);

// Governance (VoteModule, Voter, FeeDistributor)
export const readVoteModule = (c: ReadClients) => readContract(VOTE_MODULE, voteModuleAbi, c);
export const writeVoteModule = (c: WriteClients) => writeContract(VOTE_MODULE, voteModuleAbi, c);
export const readVoter = (c: ReadClients) => readContract(VOTER, voterAbi, c);
export const writeVoter = (c: WriteClients) => writeContract(VOTER, voterAbi, c);
export const readFeeDistributor = (addr: `0x${string}`, c: ReadClients) => readContract(addr, feeDistributorAbi, c);
export const writeFeeDistributor = (addr: `0x${string}`, c: WriteClients) => writeContract(addr, feeDistributorAbi, c);
