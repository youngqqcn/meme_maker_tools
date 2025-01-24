import {
    Connection,
    Keypair,
    PublicKey,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";

import * as web3 from "@solana/web3.js";
import bs58 from "bs58";
import {
    SearcherClient,
    SearcherClientError,
} from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import { Err, isError, Result } from "jito-ts/dist/sdk/block-engine/utils";
import { buildSwapTransaction } from "./build_swap_tx";
import { getSlippage } from "../base/utils";
import { getRandomElementX } from "../utils";

const MEMO_PROGRAM_ID = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";

export const sendBundles = async (
    c: SearcherClient,
    bundleTransactionLimit: number,
    keypair: Keypair,
    conn: Connection,
    txs: VersionedTransaction[]
): Promise<Result<string[], SearcherClientError>> => {
    console.log("########进入SendBundles########");
    if (bundleTransactionLimit > 4) {
        console.log("bundleTransactionLimit 必须小于4");
        return {
            ok: false,
            error: new SearcherClientError(
                4,
                "bundleTransactionLimit 必须小于等于4",
                "bundleTransactionLimit 必须小于等于4"
            ),
        };
    }

    try {
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

        // const tipAccountResult = await c.getTipAccounts();
        // if (!tipAccountResult.ok) {
        //     return tipAccountResult;
        // }
        // const _tipAccount = tipAccountResult.value[0];
        // console.log("tip account:", _tipAccount);
        // const tipAccount = new PublicKey(_tipAccount);

        // const balance = await conn.getBalance(keypair.publicKey);
        // console.log("current account has balance: ", balance);

        // let isLeaderSlot = false;
        // while (!isLeaderSlot) {
        //     const next_leader = await c.getNextScheduledLeader();
        //     if (!next_leader.ok) {
        //         return next_leader;
        //     }
        //     const num_slots =
        //         next_leader.value.nextLeaderSlot -
        //         next_leader.value.currentSlot;
        //     isLeaderSlot = num_slots <= 2;
        //     console.log(`next jito leader slot in ${num_slots} slots`);
        //     await new Promise((r) => setTimeout(r, 2000));
        // }

        const blockHash = await conn.getLatestBlockhash(); // 这里使用 processed
        console.log(blockHash.blockhash);
        const b = new Bundle([], bundleTransactionLimit);
        console.log("========$$$$$$$$===========$$$$$$$$$===========");

        // 注意：这里的 bundles = [b] 中的  b是一个引用传递， 而不是值传递， 因此，后续b的更新会影响 bundles的内容
        const bundles = [b];

        let maybeBundle = b.addTransactions(...txs);
        if (isError(maybeBundle)) {
            return {
                ok: false,
                error: new SearcherClientError(
                    3, // INVALID_ARGUMENT
                    "Failed to add transactions to bundle",
                    maybeBundle.message
                ),
            };
        }

        // let maybeBundle = b.addTransactions(
        //     buildMemoTransaction(keypair, "jito test 1", blockHash.blockhash),
        //     buildMemoTransaction(keypair, "jito test 2", blockHash.blockhash)
        // );
        // if (isError(maybeBundle)) {
        //     return {
        //         ok: false,
        //         error: new SearcherClientError(
        //             3, // INVALID_ARGUMENT
        //             "Failed to add transactions to bundle",
        //             maybeBundle.message
        //         ),
        //     };
        // }

        // 小费交易 必须在第一个， 否则失败
        maybeBundle = b.addTipTx(
            keypair,
            0.01 * 10 ** 9,
            // 0.00001 * 10 ** 9,
            tipAccount,
            blockHash.blockhash
        );
        if (isError(maybeBundle)) {
            return {
                ok: false,
                error: new SearcherClientError(
                    3, // INVALID_ARGUMENT
                    "Failed to add jito tip tx to bundle",
                    maybeBundle.message
                ),
            };
        }

        console.log("所有交易数量：", txs.length + 1);
        console.log("bundles length = ", bundles.length);

        // type BundleResponse = Result<string, SearcherClientError>;
        // const results: BundleResponse[] = await Promise.all(
        //     bundles.map(async (x) => {
        //         try {
        //             const resp = await c.sendBundle(x);
        //             if (!resp.ok) {
        //                 return resp;
        //             }
        //             console.log("resp:", resp.value);
        //             return resp;
        //         } catch (e) {
        //             console.error("error sending bundle:", e);
        //             return {
        //                 ok: false,
        //                 error: e as SearcherClientError,
        //             };
        //         }
        //     })
        // );

        try {
            let r = await c.sendBundle(maybeBundle);
            // logger.info("Bundling done")
            // return {ok: true, }
            console.log("r: ", r);
        } catch (e) {
            console.log("发送bundle交易错误:", e);
            return {
                ok: false,
                error: new SearcherClientError(
                    3, // INVALID_ARGUMENT
                    "Failed to add jito tip tx to bundle",
                    ""
                ),
            };
        }

        return { ok: true, value: [""] };
    } catch (e) {
        return {
            ok: false,
            error: e as SearcherClientError,
        };
    }
};

export const onBundleResult = (c: SearcherClient) => {
    return c.onBundleResult(
        (result: any) => {
            console.log("received bundle result:", result);
        },
        (e: Error) => {
            console.error("Bundle result error:", e);
            throw e;
        }
    );
};

export const onBundleResultEX = (c: SearcherClient): Promise<number> => {
    let first = 0;
    let isResolved = false;

    return new Promise((resolve) => {
        // Set a timeout to reject the promise if no bundle is accepted within 5 seconds
        setTimeout(() => {
            resolve(first);
            isResolved = true;
        }, 30000);

        c.onBundleResult(
            (result: any) => {
                if (isResolved) return first;
                // clearTimeout(timeout) // Clear the timeout if a bundle is accepted
                const bundleId = result.bundleId;
                const isAccepted = result.accepted;
                const isRejected = result.rejected;
                if (isResolved == false) {
                    if (isAccepted) {
                        console.log(
                            "bundle accepted, ID:",
                            result.bundleId,
                            " Slot: ",
                            result.accepted!.slot
                        );
                        first += 1;
                        isResolved = true;
                        // Resolve with 'first' when a bundle is accepted
                        resolve(first);
                    }
                    if (isRejected) {
                        console.warn("bundle is Rejected\n", result);
                        // Do not resolve or reject the promise here
                    }
                }
            },
            (e: any) => {
                console.log(e);
                // Do not reject the promise here
            }
        );
    });
};

export const buildMemoTransaction = (
    keypair: Keypair,
    message: string,
    recentBlockhash: string
): VersionedTransaction => {
    const ix = new TransactionInstruction({
        keys: [
            {
                pubkey: keypair.publicKey,
                isSigner: true,
                isWritable: true,
            },
        ],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(message),
    });

    const instructions = [ix];

    const messageV0 = new TransactionMessage({
        payerKey: keypair.publicKey,
        recentBlockhash: recentBlockhash,
        instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);

    tx.sign([keypair]);

    console.log("txn signature is: ", bs58.encode(tx.signatures[0]));
    return tx;
};
