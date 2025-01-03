/*
创建Raydium池子 + 捆绑买入
*/

require("dotenv").config();

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

// 只能用主网来测试
const RPC_URL =
    "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";
const BLOCK_ENGINE_URL = "mainnet.block-engine.jito.wtf";
const BUNDLE_TRANSACTION_LIMIT = 5;

const main = async () => {
    // let k = Keypair.generate()
    // console.log(bs58.encode( k.secretKey))
    // console.log(k.publicKey.toBase58())
    // return

    const blockEngineUrl = BLOCK_ENGINE_URL;
    console.log("BLOCK_ENGINE_URL:", blockEngineUrl);

    const keypair = Keypair.fromSecretKey(
        bs58.decode(
            "YOURKEY"
        )
    );

    const bundleTransactionLimit = BUNDLE_TRANSACTION_LIMIT;

    const c = searcherClient(blockEngineUrl);
    let tipAccounts = await c.getTipAccounts();
    console.log("tipAccounts: ", tipAccounts);

    console.log("RPC_URL:", RPC_URL);
    const conn = new Connection(RPC_URL, "confirmed");

    // let txSig = await sendAndConfirmTransactionEx(tx1, conn);
    // console.log("txSig", txSig);

    // 共用一个 BaseRay对象，以便来获得 PoolKeys
    const baseRay = new BaseRay({ rpcEndpointUrl: conn.rpcEndpoint });

    let baseMintAmount = 10_0000_0000;
    let baseDecimals = 6;
    let quoteMintAmount = 0.01;
    let quoteDecimals = 9;

    let { tx: tx1, txInfo: tx1Info } = await buildCreatePoolTransaction(
        baseRay,
        conn,
        keypair,
        {
            marketId: new PublicKey(
                "HVtvzpyYjZkccKn31tszPGv1XH36Uq2dLs84pjdYnU6q"
            ),
            baseMintAmount: baseMintAmount, // TODO
            quoteMintAmount: quoteMintAmount, // TODO
        }
    );
    let poolId = tx1Info.poolId;
    console.log("poolId: ", poolId.toBase58());

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

    let tx2 = await buildSwapTransaction(
        baseRay,
        conn,
        keypair,
        {
            poolId: poolId,
            buyToken: "base", // 买入 Token
            sellToken: "quote",
            amountSide: "send",
            amount: 0.1,
            slippage: getSlippage(15),
        },
        new BN(lpSupply),
        new BN(baseReserve),
        new BN(quoteReserve)
    );

    const result = await sendBundles(c, bundleTransactionLimit, keypair, conn, [
        tx1,
        tx2,
    ]);
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
