/*
创建OpenBook Market
*/

import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BaseRay } from "../base/baseRay";
import { web3 } from "@project-serum/anchor";
import { COMPUTE_UNIT_PRICE } from "../base/baseMpl";
import { sleep } from "../utils";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import { DEFAULT_TOKEN } from "../base/config";
import { getOpenBookMarketKeypair } from "../base/getOpenBookMarketKeypair";

// 可以参考官方代码： https://github.com/sayantank/serum-explorer/blob/444659b4920fba4ce16d3bdd2649e593f04ffe5f/pages/market/create/advanced.tsx#L19

export type CreateMarketInput = {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    orderSize: number;
    priceTick: number;
};

export type Result<T, E = any> = {
    Ok?: T;
    Err?: E;
};

export async function createMarket(
    connection: Connection,
    payer: Keypair,
    input: CreateMarketInput
): Promise<Result<{ marketId: string; txSignature: string }, string>> {
    const { baseMint, orderSize, priceTick, quoteMint } = input;

    console.log("payer: " + payer.publicKey.toBase58());
    console.log("===================");

    console.log({
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58(),
    });

    // 生成确定 market keypair , 这样， raydium poolId 也是确定的
    const marketKeypair = await getOpenBookMarketKeypair(baseMint.toBase58());
    // let marketKeypair = Keypair.generate();

    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint });
    const preTxInfo = await baseRay
        .createMarket(
            {
                baseMint,
                quoteMint,
                tickers: { lotSize: orderSize, tickSize: priceTick },
                marketKeyPair: marketKeypair,
            },
            payer.publicKey
        )
        .catch((createMarketError) => {
            console.log(createMarketError);
            return null;
        });
    if (!preTxInfo) {
        return { Err: "Failed to prepare market creation transaction" };
    }
    if (preTxInfo.Err) {
        return { Err: preTxInfo.Err };
    }
    if (!preTxInfo.Ok) return { Err: "failed to prepare tx" };
    const { marketId } = preTxInfo.Ok;

    // 这里不能合成一笔交易，会报错 Error: Transaction too large: 1541 > 1232
    // pump.fun和Raydium官方的做法也是分成了2笔交易来处理
    try {
        // const payer = keypair.publicKey;
        const info = preTxInfo.Ok;
        // speedup
        const updateCuIx1 = web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: COMPUTE_UNIT_PRICE,
        });
        const recentBlockhash1 = (await connection.getLatestBlockhash())
            .blockhash;
        const tx1 = new web3.Transaction().add(
            updateCuIx1,
            ...info.vaultInstructions
        );
        tx1.feePayer = payer.publicKey;
        tx1.recentBlockhash = recentBlockhash1;
        tx1.sign(payer);
        // const tx1 = new web3.Transaction().add(...info.vaultInstructions)
        console.log("sending vault instructions tx");
        const txSignature1 = await sendAndConfirmTransaction(
            connection,
            tx1,
            [payer, ...info.vaultSigners],
            { maxRetries: 20 }
        );
        console.log(
            "confirmed vault instructions tx, ",
            txSignature1.toString()
        );

        const updateCuIx2 = web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: COMPUTE_UNIT_PRICE,
        });
        const recentBlockhash2 = (await connection.getLatestBlockhash())
            .blockhash;
        const tx2 = new web3.Transaction().add(
            updateCuIx2,
            ...info.marketInstructions
        );
        tx2.feePayer = payer.publicKey;
        tx2.recentBlockhash = recentBlockhash2;
        tx2.sign(payer);
        // const tx2 = new web3.Transaction().add(...info.marketInstructions)
        console.log("sending create market tx");

        const txSignature = await sendAndConfirmTransaction(
            connection,
            tx2,
            [payer, ...info.marketSigners],
            { maxRetries: 20, skipPreflight: false }
        );

        console.log("confirmed create market tx");

        const accountInfo = await connection.getAccountInfo(info.marketId);
        if (!accountInfo) {
            await sleep(25_000);
            const accountInfo = await connection.getAccountInfo(info.marketId);
            if (!accountInfo) {
                return {
                    Err: `Failed to verify market creation. marketId: ${marketId.toBase58()}`,
                };
            }
        }
        return {
            Ok: {
                marketId: marketId.toBase58(),
                txSignature: txSignature,
            },
        };
    } catch (error) {
        console.log({ error });
        return { Err: "failed to send the transaction" };
    }
}

(async () => {
    let rpc_url = "";
    let network = "mainnet";
    // let network = "devnet";
    if (network == "devnet") {
        rpc_url =
            "https://devnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
    } else {
        rpc_url =
            "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
        network = "mainnet";
    }

    const connection = new Connection(rpc_url, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let mint = new PublicKey("");
    let createMarketKey = process.env.CREATE_MARKET_KEY ?? "";
    console.log("createMarketKey: ", createMarketKey);
    let payer = Keypair.fromSecretKey(bs58.decode(createMarketKey));

    let ret = await createMarket(connection, payer, {
        baseMint: new PublicKey(mint),
        quoteMint: DEFAULT_TOKEN.WSOL.mint,
        orderSize: 10000,
        priceTick: 0.0000000001,
    });
    console.log("ret", ret);
})();
