import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import {
    TxVersion,
    Token,
    Currency,
    TOKEN_PROGRAM_ID,
    SOL,
    CacheLTA,
    LOOKUP_TABLE_CACHE,
} from "@raydium-io/raydium-sdk";
import mysql from "mysql2/promise";
import { config } from "dotenv";

export const RPC_ENDPOINT_MAIN =
    "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";
export const RPC_ENDPOINT_DEV =
    "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

export const addLookupTableInfo = LOOKUP_TABLE_CACHE; // only mainnet. other = undefined
export const makeTxVersion = TxVersion.V0; // LEGACY

// 18 lamports 每个单元
export const COMPUTE_UNIT_PRICE = 1_000_000; // default: 200_000
// export const feeLevel = 18;

config();
export const DEFAULT_TOKEN = {
    SOL: SOL,
    SOL1: new Currency(9, "USDC", "USDC"),
    WSOL: new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey("So11111111111111111111111111111111111111112"),
        9,
        "WSOL",
        "WSOL"
    ),
    USDC: new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        6,
        "USDC",
        "USDC"
    ),
};

export function getRaydiumAmmProgramId(env: string): PublicKey {
    return env == "devnet"
        ? new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8")
        : new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
}
