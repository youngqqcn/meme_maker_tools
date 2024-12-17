// 创建 raydium池子
// import { TOKEN_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { getTokenBalance, sleep } from "./utils";
import * as web3 from "@solana/web3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    createBurnInstruction,
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
const log = console.log;

let TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const RPC_ENDPOINT_MAIN =
    "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

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
        amount = await getTokenBalance(
            connection,
            owner.publicKey,
            mint,
            TOKEN_PROGRAM_ID
        );
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
    const connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let keys = ["TODO"];

    let payer = Keypair.fromSecretKey(Uint8Array.from(bs58.decode("TODO")));

    let mint = new PublicKey("CGDqKVHToZr9p4YzWmEPZyvYyTzeUEV3yZLuTTWURaEE");

    for (let k of keys) {
        let owner = web3.Keypair.fromSecretKey(Uint8Array.from(bs58.decode(k)));
        await closeTokenAccount(connection, mint, owner, payer);
    }
})();
