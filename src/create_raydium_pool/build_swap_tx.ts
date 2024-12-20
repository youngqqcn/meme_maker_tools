// import { web3 } from "@project-serum/anchor";
import { BaseRay } from "../base/baseRay";
import {
    // Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    TransactionMessage,
} from "@solana/web3.js";
import { Percent } from "@raydium-io/raydium-sdk";
import { VersionedTransaction } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import { BN } from "@project-serum/anchor";
const log = console.log;

type SwapInput = {
    // marketId: PublicKey; //
    poolId: PublicKey; // 创建池子+购买捆绑， 此时poolId还是没有的
    buyToken: "base" | "quote";
    sellToken?: "base" | "quote";
    amountSide: "send" | "receive";
    amount: number;
    slippage: Percent;
};

export async function buildSwapTransaction(
    baseRay: BaseRay,
    connection: Connection,
    payer: Keypair,
    input: SwapInput,

    lpSupply: BN,
    baseReserve: BN,
    quoteReserve: BN
): Promise<VersionedTransaction> {
    if (input.sellToken) {
        if (input.sellToken == "base") {
            input.buyToken = "quote";
        } else {
            input.buyToken = "base";
        }
    }

    // const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint });
    const slippage = input.slippage;
    const poolKeys = await baseRay
        .getPoolKeys(input.poolId)
        .catch((getPoolKeysError) => {
            log({ getPoolKeysError });
            return null;
        });
    if (!poolKeys) {
        throw Error("Pool info not found");
    }
    log({
        baseToken: poolKeys.baseMint.toBase58(),
        quoteToken: poolKeys.quoteMint.toBase58(),
    });
    const { amount, amountSide, buyToken } = input;

    const swapAmountInfo = await baseRay
        .computeBuyAmountBeforePoolCreate(
            {
                amount,
                buyToken,
                inputAmountType: amountSide,
                poolKeys,
                user: payer.publicKey,
                slippage,
            },
            lpSupply,
            baseReserve,
            quoteReserve
        )
        .catch((computeBuyAmountError) => log({ computeBuyAmountError }));
    if (!swapAmountInfo) throw Error("failed to calculate the amount");
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
    if (!txInfo) throw Error("failed to prepare swap transaction");
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const txMsg = new TransactionMessage({
        instructions: txInfo.ixs,
        payerKey: payer.publicKey,
        recentBlockhash,
    }).compileToV0Message();
    const tx = new VersionedTransaction(txMsg);
    tx.sign([payer, ...txInfo.signers]);
    // const txSignature = await sendAndConfirmTransaction(tx, connection).catch(
    //     (sendAndConfirmTransactionError: any) => {
    //         log({ sendAndConfirmTransactionError });
    //         return null;
    //     }
    // );
    // if (!txSignature) {
    //     return { Err: "Failed to send transaction" };
    // }
    // console.log("sig: ", txSignature);
    return tx;
}
