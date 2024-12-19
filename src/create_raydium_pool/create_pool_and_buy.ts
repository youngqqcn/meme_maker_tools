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
            "3pTyHxqf4a3HZyK4QSaorRhHJsd1HqByDmVX592Bq66TTMPUDMtZSNpwM4aGMRx1ZPbCxywbnR33aLPtvnpQEP3D"
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

    let tx1 = await buildCreatePoolTransaction(conn, keypair, {
        marketId: new PublicKey("HVtvzpyYjZkccKn31tszPGv1XH36Uq2dLs84pjdYnU6q"),
        baseMintAmount: 10_0000_0000, // TODO
        quoteMintAmount: 0.01, // TODO
    });

    let tx2 = await buildSwapTransaction(conn, keypair, {
        poolId: new PublicKey("7ADYSXcAagy5LnkiNnb4o4uu1t7vtBtyPsAvvWSQ4Huq"),
        buyToken: "base", // 买入 Token
        sellToken: "quote",
        amountSide: "send",
        amount: 0.1,
        slippage: getSlippage(15),
    });

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
