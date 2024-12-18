// 创建 raydium池子
import { getTokenBalance, parseCsvFile, sleep } from "../utils";
import * as web3 from "@solana/web3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    createBurnInstruction,
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
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
    payer: Keypair
) {
    console.log("=========closeTokenAccount=============");
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

    const ixBurn = createBurnInstruction(ata, mint, owner.publicKey, amount, [
        payer,
        owner,
    ]);

    const ixClose = createCloseAccountInstruction(
        ata,
        payer.publicKey,
        owner.publicKey
    );
    // speedup
    // const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({
    //     microLamports: 3_000_000,
    // });
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    // const tx = new web3.Transaction().add(updateCuIx, ixBurn, ixClose);
    const tx = new web3.Transaction().add(ixBurn, ixClose);
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = recentBlockhash;
    tx.sign(payer, owner);
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
                    log({ createPoolAndBuyTxFail });
                    return null;
                });
        });
    if (!txSignature) log("Tx failed");
    log("Transaction successfull\nTx Signature: ", txSignature);
}

(async () => {
    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    const connection = new Connection(RPC_ENDPOINT_DEV, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let datas: CsvRecord[] = await parseCsvFile<CsvRecord>("./data.csv");
    console.log("datas长度", datas.length);

    for (let data of datas) {
        let owner = web3.Keypair.fromSecretKey(
            Uint8Array.from(bs58.decode(data.fromkey.trim()))
        );
        let mint = new PublicKey(data.mint.trim());
        let payer = Keypair.fromSecretKey(
            Uint8Array.from(bs58.decode(data.payer.trim()))
        );
        await closeTokenAccount(connection, mint, owner, payer);
    }
})();
