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
    COMPUTE_UNIT_PRICE,
    getRaydiumAmmProgramId,
    RPC_ENDPOINT_DEV,
    RPC_ENDPOINT_MAIN,
} from "../base/config";
import { BaseRay } from "../base/baseRay";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Percent, TOKEN_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import {
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
const log = console.log;

type SwapInput = {
    poolId: web3.PublicKey;
    buyToken: "base" | "quote";
    sellToken?: "base" | "quote";
    amountSide: "send" | "receive";
    amount: number;
    slippage: Percent;
    // url: "mainnet" | "devnet";
};

export async function swap(
    connection: Connection,
    payer: Keypair,
    input: SwapInput
): Promise<Result<{ txSignature: string }, string>> {
    if (input.sellToken) {
        if (input.sellToken == "base") {
            input.buyToken = "quote";
        } else {
            input.buyToken = "base";
        }
    }

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
    const txMsg = new web3.TransactionMessage({
        instructions: txInfo.ixs,
        payerKey: payer.publicKey,
        recentBlockhash,
    }).compileToV0Message();
    const tx = new web3.VersionedTransaction(txMsg);
    tx.sign([payer, ...txInfo.signers]);
    const txSignature = await sendAndConfirmTransactionEx(tx, connection).catch(
        (sendAndConfirmTransactionError: any) => {
            log({ sendAndConfirmTransactionError });
            return null;
        }
    );
    if (!txSignature) {
        return { Err: "Failed to send transaction" };
    }
    return {
        Ok: {
            txSignature,
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
    let ret = await swap(connection, payer, {
        poolId: new PublicKey("ETMzB2FbNCQpSSPXf9dVgZDCqNfAzCRkpA78ueSsxVjV"),
        buyToken: "base", // 买入 Token
        sellToken: "quote",
        amountSide: "receive",
        amount: 10000,
        slippage: getSlippage(15),
    });

    console.log("ret", ret);
})();
