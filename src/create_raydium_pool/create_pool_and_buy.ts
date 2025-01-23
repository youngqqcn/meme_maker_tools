/*
创建Raydium池子 + 捆绑买入
*/

import * as Fs from "fs";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";

import { onBundleResult, sendBundles } from "./utils";
import { searcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { buildSwapTransaction } from "./build_swap_tx";
import { getSlippage, sendAndConfirmTransactionEx } from "../base/utils";
import { buildCreatePoolTransaction } from "./build_create_pool_tx";
import { BaseRay } from "../base/baseRay";
import { BN } from "@project-serum/anchor";
import { Liquidity, MAINNET_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { getOpenBookMarketKeypair } from "../base/getOpenBookMarketKeypair";

require("dotenv").config();

// 只能用主网来测试
const RPC_URL =
    "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
const BLOCK_ENGINE_URL = "mainnet.block-engine.jito.wtf";
const BUNDLE_TRANSACTION_LIMIT = 4;

const main = async () => {
    const blockEngineUrl = BLOCK_ENGINE_URL;
    console.log("BLOCK_ENGINE_URL:", blockEngineUrl);

    let createPoolKey = process.env.CREATE_POOL_KEY ?? ""; // 创建池子的私钥
    let firstBuyerKey = process.env.FIRST_BUYER_KEY ?? ""; // 买入地址私钥
    console.log("createPoolKey: ", createPoolKey);
    console.log("firstBuyerKey: ", firstBuyerKey);

    const createPoolKeypair = Keypair.fromSecretKey(bs58.decode(createPoolKey));
    const buyerKeypair1 = Keypair.fromSecretKey(bs58.decode(firstBuyerKey));

    if (createPoolKeypair) {
        return;
    }

    const bundleTransactionLimit = BUNDLE_TRANSACTION_LIMIT;

    const c = searcherClient(blockEngineUrl);
    let tipAccounts = await c.getTipAccounts();
    console.log("tipAccounts: ", tipAccounts);

    console.log("RPC_URL:", RPC_URL);
    const conn = new Connection(RPC_URL, "confirmed");

    // 共用一个 BaseRay对象，以便来获得 PoolKeys
    const baseRay = new BaseRay({ rpcEndpointUrl: conn.rpcEndpoint });

    let baseMintAmount = 10_0000_0000;
    let baseDecimals = 6;
    let quoteMintAmount = 0.01;
    let quoteDecimals = 9;

    let mint = ""; // TODO
    let marketId = await getOpenBookMarketKeypair(mint);
    console.log("marketId: ", marketId.publicKey.toBase58());
    let poolId1 = Liquidity.getAssociatedId({
        marketId: marketId.publicKey,
        programId: new PublicKey(
            MAINNET_PROGRAM_ID.AmmV4 // "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
        ),
    });
    console.log("poolId(预计算): ", poolId1.toBase58());

    let { tx: createPoolTx, txInfo: tx1Info } =
        await buildCreatePoolTransaction(baseRay, conn, createPoolKeypair, {
            marketId: new PublicKey(marketId),
            baseMintAmount: baseMintAmount,
            quoteMintAmount: quoteMintAmount,
        });
    let poolId = tx1Info.poolId;
    console.log("poolId(生成): ", poolId.toBase58());

    if (poolId.toBase58() != poolId1.toBase58()) {
        console.log(
            "计算的 poolId 和生成的 poolId 不匹配， 请检查marketId是否正确"
        );
        return;
    }

    // https://github.com/raydium-io/raydium-amm/blob/master/program/src/processor.rs#L1144-L1153
    let lpSupply =
        Math.round(
            Math.sqrt(
                baseMintAmount *
                    Math.pow(10, baseDecimals) *
                    quoteMintAmount *
                    Math.pow(10, quoteDecimals)
            )
        ) - Math.pow(10, 6);
    let baseReserve = Math.round(baseMintAmount * Math.pow(10, baseDecimals));
    let quoteReserve = Math.round(
        quoteMintAmount * Math.pow(10, quoteDecimals)
    );

    // 就用一个地址买入即可, 不必藏着掖着，光明磊落
    let buyTx1 = await buildSwapTransaction(
        baseRay,
        conn,
        buyerKeypair1,
        {
            poolId: poolId,
            buyToken: "base", // 买入 Token
            sellToken: "quote",
            amountSide: "send",
            amount: 110, // 110 SOL
            slippage: getSlippage(10),
        },
        new BN(lpSupply),
        new BN(baseReserve),
        new BN(quoteReserve)
    );

    const result = await sendBundles(
        c,
        bundleTransactionLimit,
        createPoolKeypair,
        conn,
        [createPoolTx, buyTx1]
    );
    if (!result.ok) {
        console.error("Failed to send bundles:", result.error);
        return;
    }
    console.log("Successfully sent bundles:", result.value);
    onBundleResult(c);
};

main()
    .then(() => {
        console.log("Sending bundle");
    })
    .catch((e) => {
        throw e;
    });
