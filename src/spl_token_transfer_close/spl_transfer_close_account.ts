// 创建 raydium池子
import { getTokenBalance, parseCsvFile, sleep } from "../utils";
import * as web3 from "@solana/web3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    createBurnInstruction,
    createCloseAccountInstruction,
    createTransferInstruction,
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

    // const ixBurn = createBurnInstruction(ata, mint, owner.publicKey, amount, [
    //     payer,
    //     owner,
    // ]);
    let destATA = getAssociatedTokenAddressSync(mint, payer.publicKey);

    // 将token转给payer
    let ixTransfer = createTransferInstruction(
        ata,
        destATA,
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
        microLamports: 100_000, // 1 lamports
    });
    const updateCULimit = web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 7959,
    });
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    let tx = new web3.Transaction().add(updateCULimit, updateCuIx, ixTransfer, ixClose);

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
        "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";

    const connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let datas: CsvRecord[] = await parseCsvFile<CsvRecord>("./data.csv");
    console.log("datas长度", datas.length);


    datas = datas.slice(3062);
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
