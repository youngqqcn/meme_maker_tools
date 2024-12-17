/**
 * SOL 多对一转账
 */

import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";

async function multi_to_one_transfer(
    connection: Connection,
    // payer: Keypair,
    from: Keypair,
    dest: PublicKey
) {
    if (from.publicKey.equals(dest)) {
        console.log("发送地址和接收地址一样，不处理");
        return;
    }

    // 获取最新区块
    const blockhash = await connection.getLatestBlockhash();
    // console.log("blockhash: ", blockhash);

    // 创建交易
    let balance = await connection.getBalance(from.publicKey);

    let transaction = new Transaction();

    let transferFee = 5000; // 最少

    if (balance < transferFee) {
        console.log(from.publicKey.toBase58(), " 余额太小， 不处理");
        return;
    }
    transaction.add(
        SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: dest,
            lamports: balance - transferFee,
        })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [
        from,
    ]);

    console.log("signature: ", signature.toString());
}

(async () => {
    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";
    let connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let keys = [
        "TODO",
    ];

    for (let k of keys) {
        let dest = new PublicKey(
            "8fq7Voz95UnftS9tZVy1a21owiED7bR7i72UDPhpHfMQ"
        );

        let from = Keypair.fromSecretKey(Uint8Array.from(bs58.decode(k)));
        await multi_to_one_transfer(connection, from, dest);
    }
})();
