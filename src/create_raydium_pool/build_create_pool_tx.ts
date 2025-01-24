/*
创建 Radyium 池子
*/

// 创建 raydium池子
import { web3 } from "@project-serum/anchor";
import { COMPUTE_UNIT_PRICE } from "../base/config";
import { BaseRay } from "../base/baseRay";

import { config } from "dotenv";
import { Connection, Keypair } from "@solana/web3.js";
config();

export type CreatePoolInput = {
    marketId: web3.PublicKey;
    baseMintAmount: number;
    quoteMintAmount: number;
};

export async function buildCreatePoolTransaction(
    baseRay: BaseRay,
    connection: Connection,
    payer: Keypair,
    input: CreatePoolInput
) {
    console.log("=====进入buildCreatePoolTransaction =====");
    let { baseMintAmount, quoteMintAmount, marketId } = input;
    // let wallet = new CustomWallet();
    console.log("payer: " + payer.publicKey.toBase58());

    // const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint });
    const marketState = await baseRay
        .getMarketInfo(marketId)
        .catch((getMarketInfoError) => {
            console.log({ getMarketInfoError });
            return null;
        });
    // log({marketState})
    if (!marketState) {
        throw Error("market not found");
    }
    const { baseMint, quoteMint } = marketState;
    console.log({
        baseToken: baseMint.toBase58(),
        quoteToken: quoteMint.toBase58(),
    });
    const txInfo = await baseRay
        .createPool(
            { baseMint, quoteMint, marketId, baseMintAmount, quoteMintAmount },
            payer.publicKey
        )
        .catch((innerCreatePoolError) => {
            console.log({ innerCreatePoolError });
            return null;
        });
    if (!txInfo) throw Error("Failed to prepare create pool transaction");

    // speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: COMPUTE_UNIT_PRICE,
    });
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const txMsg = new web3.TransactionMessage({
        instructions: [updateCuIx, ...txInfo.ixs],
        payerKey: payer.publicKey,
        recentBlockhash,
    }).compileToV0Message();
    const tx = new web3.VersionedTransaction(txMsg);
    tx.sign([payer, ...txInfo.signers]);
    return { tx, txInfo };
}
