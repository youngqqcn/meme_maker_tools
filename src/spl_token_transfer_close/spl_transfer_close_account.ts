// 创建 raydium池子
import { getTokenBalance, parseCsvFile, sleep } from "../utils";
import * as web3 from "@solana/web3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    createBurnInstruction,
    createCloseAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
const log = console.log;

interface CsvRecord {
    fromkey: string;
    payer: string; // payer作为SOL接收方
    mint: string;
}

export async function closeTokenAccount(
    connection: Connection,
    mint: PublicKey,
    owner: Keypair,
    payer: Keypair,
    defaultCULimit: number = 7959 + 100
) {
    console.log("=========closeTokenAccount=============");
    console.log("处理地址: ", owner.publicKey.toBase58());
    const ata = getAssociatedTokenAddressSync(mint, owner.publicKey);

    let amount = null;
    try {
        amount = await getTokenBalance(connection, owner.publicKey, mint);
    } finally {
        if (!amount) {
            console.log(
                owner.publicKey.toBase58(),
                ", token余额为空，不用关闭账户"
            );
            return;
        }
    }
    console.log("balance: " + amount);

    // const ixBurn = createBurnInstruction(ata, mint, owner.publicKey, amount, [
    //     payer,
    //     owner,
    // ]);

    // FIX: 如果接收方没有关联账户，则创建一个
    // let destATA = getAssociatedTokenAddressSync(mint, payer.publicKey);
    let destATA = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey
    );

    // 将token转给payer
    let ixTransfer = createTransferInstruction(
        ata,
        destATA.address,
        owner.publicKey,
        amount
    );

    const ixClose = createCloseAccountInstruction(
        ata,
        payer.publicKey,
        owner.publicKey
    );

    // 加速 speedup
    const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000, // 0.1 lamports
    });
    const updateCULimit = web3.ComputeBudgetProgram.setComputeUnitLimit({
        // units: 15959,
        units: defaultCULimit,
    });
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    let tx = new web3.Transaction().add(
        updateCULimit,
        updateCuIx,
        ixTransfer,
        ixClose
    );

    // 如果是 Wrapped SOL ，不要销毁，只需Close, SOL会自动redeem为SOL
    if (
        mint.equals(
            new PublicKey("So11111111111111111111111111111111111111112")
        )
    ) {
        tx = new web3.Transaction().add(updateCuIx, ixClose);
    }

    // 省钱
    // const tx = new web3.Transaction().add(ixBurn, ixClose);

    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = recentBlockhash;
    tx.sign(payer, owner);
    let errorInfo = null;
    const rawTx = tx.serialize();
    const txSignature = await web3
        .sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), {
            commitment: "confirmed",
        })
        .catch(async () => {
            await sleep(500);
            return await web3
                .sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), {
                    commitment: "confirmed",
                })
                .catch((createPoolAndBuyTxFail) => {
                    errorInfo = createPoolAndBuyTxFail;
                    log({ createPoolAndBuyTxFail });
                    return null;
                });
        });
    if (!txSignature) {
        // log("Tx failed", errorInfo);
        throw new Error("Tx failed" + errorInfo);
    }
    log("Transaction successfull\nTx Signature: ", txSignature);
}

(async () => {
    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
    // "https://mainnet.helius-rpc.com/?api-key=c4d86721-7560-45d6-be7e-661ba7485277";

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";

    const connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let datas: CsvRecord[] = await parseCsvFile<CsvRecord>(
        // "./008_140_data.csv"
        // "./001_1000_data.csv"
        // "./002_to_007_data.csv"
        // "./350_50_10_data.csv"
        // "./350_50_10_data_WSOL.csv"
        "./last.csv"
    );
    console.log("datas长度", datas.length);

    // datas = datas.slice(3062);

    // let innerSet = new Set([
    //     "EgPPP2MNnL8Lc7ta7dp4upZYTGzFpnUkFNFFq1VnAh6L",
    //     "1hsVxBCf2pvQefLinG87qruZWqaGx9dDnbtpFmv4dXY",
    // ]);

    let count = 0;
    let failed_address = [];

    for (let data of datas) {
        console.log(
            "========共",
            datas.length,
            "个地址，处理第",
            count + 1,
            "个地址========="
        );
        let owner = web3.Keypair.fromSecretKey(
            Uint8Array.from(bs58.decode(data.fromkey.trim()))
        );

        // if (!innerSet.has(owner.publicKey.toBase58())) {
        //     continue
        // }

        let mint = new PublicKey(data.mint.trim());
        let payer = Keypair.fromSecretKey(
            Uint8Array.from(bs58.decode(data.payer.trim()))
        );

        // 如果发生异常，重试3次
        let defaultCULimit = 7959;
        for (let i = 0; i < 3; i++) {
            try {
                await closeTokenAccount(
                    connection,
                    mint,
                    owner,
                    payer,
                    defaultCULimit
                );
                count++;
                break;
            } catch (error: Error | any) {
                console.log("closeTokenAccount error, 重试第", i, "次", error);
                if (error.toString().indexOf("exceeded CUs meter") >= 0) {
                    defaultCULimit += 100;
                }
                if (i === 2) {
                    console.log("最终失败，跳过");
                    failed_address.push(data);
                }
            } finally {
                await sleep(500); // 每次操作后休息0.5秒
            }
        }
    }

    // 打印所有失败的地址
    console.log("=====所有失败的地址, 共", failed_address.length, "个=======");
    for (let addr of failed_address) {
        console.log(addr.fromkey);
    }
})();
