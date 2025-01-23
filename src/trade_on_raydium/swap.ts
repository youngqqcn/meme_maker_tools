import { web3 } from "@project-serum/anchor";
import { Result } from "../base/types";
// import { SwapInput } from "../types";

import {
    getKeypairFromEnv,
    getSlippage,
    getTokenBalance,
    sendAndConfirmTransactionEx,
    sleep,
} from "../base/utils";
import {
    getRaydiumAmmProgramId,
    RPC_ENDPOINT_DEV,
    RPC_ENDPOINT_MAIN,
} from "../base/config";
import { BaseRay } from "../base/baseRay";
import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
} from "@solana/web3.js";
import { Percent, TOKEN_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import {
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { getRandomElement, getRandomElementX } from "../utils";
import { sendTxUsingJito } from "./sendTxWithJito";
import { onBundleResult, sendBundles } from "../create_raydium_pool/utils";
import { searcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
const log = console.log;

export type SwapInput = {
    poolId: web3.PublicKey;
    buyToken: "base" | "quote";
    sellToken?: "base" | "quote";
    amountSide: "send" | "receive";
    amount: number; // 浮点数， 内部会转为token最小单位
    slippage: Percent;
    // url: "mainnet" | "devnet";
};

export async function swap(
    connection: Connection,
    payer: Keypair,
    input: SwapInput,
    unitPrice: number = 100_000, // 10 lamport per unit
    jitoTip: number = 0.00001
): Promise<Result<{ txSignature: string }, string>> {
    if (input.sellToken) {
        if (input.sellToken == "base") {
            input.buyToken = "quote";
        } else {
            input.buyToken = "base";
        }
    }

    // TODO: 是否有更好的方式？
    let unitLimit = 90000;
    if (input.buyToken == "base") {
        // 买入
        unitLimit = 90000;
    } else {
        unitLimit = 70000;
    }
    // console.log("swap: ", input);

    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint });
    const slippage = input.slippage;
    const poolKeys = await baseRay
        .getPoolKeys(input.poolId)
        .catch((getPoolKeysError) => {
            log({ getPoolKeysError });
            return null;
        });
    if (!poolKeys) {
        return { Err: "Pool info not found" };
    }
    log({
        baseToken: poolKeys.baseMint.toBase58(),
        quoteToken: poolKeys.quoteMint.toBase58(),
    });
    const { amount, amountSide, buyToken } = input;
    const swapAmountInfo = await baseRay
        .computeBuyAmount({
            amount,
            buyToken,
            inputAmountType: amountSide,
            poolKeys,
            user: payer.publicKey,
            slippage,
        })
        .catch((computeBuyAmountError) => log({ computeBuyAmountError }));
    if (!swapAmountInfo) return { Err: "failed to calculate the amount" };
    const { amountIn, amountOut, fixedSide, tokenAccountIn, tokenAccountOut } =
        swapAmountInfo;
    const txInfo = await baseRay
        .buyFromPool({
            amountIn,
            amountOut,
            fixedSide,
            poolKeys,
            tokenAccountIn,
            tokenAccountOut,
            user: payer.publicKey,
        })
        .catch((buyFromPoolError) => {
            log({ buyFromPoolError });
            return null;
        });
    if (!txInfo) return { Err: "failed to prepare swap transaction" };
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // 更新计算单元价格
    const updateCULimit = web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: unitLimit,
    });
    const updateCUPriceIx = web3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: unitPrice,
    });

    // 增加 jito 小费
    let tipAccount = getRandomElementX([
        new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
        new PublicKey("HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe"),
        new PublicKey("Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY"),
        new PublicKey("ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49"),
        new PublicKey("DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh"),
        new PublicKey("ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt"),
        new PublicKey("DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL"),
        new PublicKey("3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"),
    ]);
    const jitoTipIx = web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: tipAccount,
        lamports: jitoTip * LAMPORTS_PER_SOL,
    });

    console.log("txInfo.ixs长度: ", txInfo.ixs.length);
    // console.log("ixs: ", txInfo.ixs);

    const txMsg = new web3.TransactionMessage({
        instructions: [
            updateCULimit,
            updateCUPriceIx,
            jitoTipIx,
            ...txInfo.ixs,
        ],
        // instructions: [updateCuIx, ...txInfo.ixs],
        payerKey: payer.publicKey,
        recentBlockhash,
    }).compileToV0Message();
    const tx = new web3.VersionedTransaction(txMsg);
    tx.sign([payer, ...txInfo.signers]);

    let rsp = await sendTxUsingJito(tx);
    // let rsp = {"result":""};
    // console.log("rsp: ", rsp);

    return {
        Ok: {
            txSignature: rsp["result"],
        },
    };

    // 使用Bundle发送
    // const blockEngineUrl = "mainnet.block-engine.jito.wtf";
    // const blockEngineUrl = "tokyo.mainnet.block-engine.jito.wtf";
    // console.log("BLOCK_ENGINE_URL:", blockEngineUrl);
    // // const bundleTransactionLimit = BUNDLE_TRANSACTION_LIMIT;
    // const c = searcherClient(blockEngineUrl);
    // let x = await sendBundles(c, 5, payer, connection, [tx]);
    // onBundleResult(c);
    // return {
    //     Ok: {
    //         txSignature: "",
    //     },
    // };

    // 使用公共节点发送交易
    // const txSignature = await sendAndConfirmTransactionEx(tx, connection).catch(
    //     (sendAndConfirmTransactionError: any) => {
    //         log({ sendAndConfirmTransactionError });
    //         return null;
    //     }
    // );
    // if (!txSignature) {
    //     return { Err: "Failed to send transaction" };
    // }
    // return {
    //     Ok: {
    //         txSignature,
    //     },
    // };
}

async function xxx() {
    let rpc_url = "";
    let network = "devnet";
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

    // let mint = new PublicKey("9FQbXGvfFa5HRZuKhceJD7dGzVJyhqoqqQmJ42RyUcgK");
    let payer = Keypair.fromSecretKey(
        bs58.decode(
            "DD7evt2hCGZ9kV9do2zhubQkSqTizB2bBuL5YLR3oZJ8nQsUqEJyASjUqnjj2x5RXexP6k3PR8E2UBRovsDVESt"
        )
    );
    let ret = await swap(connection, payer, {
        poolId: new PublicKey("2yLEsHFPYZFzs2dmRXfFm4ujcLorDdnJSP34K1tQdDJ4"),
        buyToken: "base", // 买入 Token
        sellToken: "quote",
        amountSide: "receive",
        amount: 10000,
        slippage: getSlippage(15),
    });

    // 全部卖完
    // let balance = await getTokenBalance(
    //     connection,
    //     payer.publicKey,
    //     new PublicKey("9FQbXGvfFa5HRZuKhceJD7dGzVJyhqoqqQmJ42RyUcgK")
    // );
    // console.log("token blaance: ", Number( balance))

    // let ret = await swap(connection, payer, {
    //     poolId: new PublicKey("ETMzB2FbNCQpSSPXf9dVgZDCqNfAzCRkpA78ueSsxVjV"),
    //     buyToken: "quote", // 买入 Token
    //     sellToken: "base",
    //     amountSide: "send",
    //     amount: Number(balance) / 10**6,
    //     slippage: getSlippage(15),
    // });

    console.log("ret", ret);
}

// xxx()
//     .catch((e) => console.log(e))
//     .then();
