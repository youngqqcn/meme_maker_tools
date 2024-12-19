/*
创建 Radyium 池子
*/

// 创建 raydium池子
import { BN, web3 } from "@project-serum/anchor";
import { Result } from "../base/types";
// import { CreatePoolInput, CustomWallet } from "./types";

import { sleep } from "../utils";
import {
    COMPUTE_UNIT_PRICE,
    // getMysqlPooolOpts,
    RPC_ENDPOINT_DEV,
    RPC_ENDPOINT_MAIN,
} from "../base/config";
import { BaseRay } from "../base/baseRay";
import { getExplorerLink } from "@solana-developers/helpers";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";

import { config } from "dotenv";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
config();

export type CreatePoolInput = {
    marketId: web3.PublicKey;
    baseMintAmount: number;
    quoteMintAmount: number;
};

export async function createPool(
    connection: Connection,
    payer: Keypair,
    input: CreatePoolInput
): Promise<
    Result<
        {
            poolId: string;
            txSignature: string;
            baseAmount: BN;
            quoteAmount: BN;
            baseDecimals: number;
            quoteDecimals: number;
        },
        string
    >
> {
    let { baseMintAmount, quoteMintAmount, marketId } = input;
    // let wallet = new CustomWallet();
    console.log("payer: " + payer.publicKey.toBase58());

    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint });
    const marketState = await baseRay
        .getMarketInfo(marketId)
        .catch((getMarketInfoError) => {
            console.log({ getMarketInfoError });
            return null;
        });
    // log({marketState})
    if (!marketState) {
        return { Err: "market not found" };
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
    if (!txInfo) return { Err: "Failed to prepare create pool transaction" };

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
    const rawTx = tx.serialize();
    console.log("PoolId: ", txInfo.poolId.toBase58());
    console.log("SENDING CREATE POOL TX");
    const simRes = (await connection.simulateTransaction(tx)).value;
    // fs.writeFileSync("./poolCreateTxSim.json", JSON.stringify(simRes));
    console.log(simRes);
    const txSignature = await web3
        .sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), {
            commitment: "confirmed",
        })
        .catch(async () => {
            await sleep(5000);
            return await web3
                .sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), {
                    commitment: "confirmed",
                })
                .catch((createPoolAndBuyTxFail) => {
                    console.log({ createPoolAndBuyTxFail });
                    return null;
                });
        });
    console.log("CONFIRMED CREATE POOL TX");
    if (!txSignature) console.log("Tx failed");
    // const txSignature = await connection.sendTransaction(tx).catch((error) => { log({ createPoolTxError: error }); return null });
    if (!txSignature) {
        return { Err: "Failed to send transaction" };
    }
    return {
        Ok: {
            poolId: txInfo.poolId.toBase58(),
            txSignature,
            baseAmount: txInfo.baseAmount,
            quoteAmount: txInfo.quoteAmount,
            baseDecimals: txInfo.baseDecimals,
            quoteDecimals: txInfo.quoteDecimals,
        },
    };
}

(async () => {
    let rpc_url = "";
    let network = "devnet";
    if (network == "devnet") {
        rpc_url =
            "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";
    } else {
        rpc_url =
            "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";
        network = "mainnet";
    }

    const connection = new Connection(rpc_url, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    // let mint = new PublicKey("9FQbXGvfFa5HRZuKhceJD7dGzVJyhqoqqQmJ42RyUcgK");
    let payer = Keypair.fromSecretKey(
        bs58.decode(
            "DD7evt2hCGZ9kV9do2zhubQkSqTizB2bBuL5YLR3oZJ8nQsUqEJyASjUqnjj2x5RXexP6k3PR8E2UBRovsDVESt"
        )
    );

    let ret = await createPool(connection, payer, {
        marketId: new PublicKey("EYrp4kCnm7BMEza4ydbUKSpFuooBKv8Rmz4p9uCo2e4t"),
        baseMintAmount: 1_0000_0000, // TODO
        quoteMintAmount: 10, // TODO
    });

    console.log("ret", ret);
})();
