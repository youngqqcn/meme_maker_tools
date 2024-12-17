/**
 * SOL 一对多转账， 一笔交易只包含一个指令， 不搞多个
 */

import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import { CsvRecord, parseCsvFile } from "../utils";

async function one_to_multi_transfer(
    connection: Connection,
    from: Keypair,
    dest: PublicKey,
    lamports: number
) {
    if (lamports <= 5000) {
        console.log(
            `${from.publicKey.toBase58()}, 转 ${lamports} , 金额太小，跳过`
        );
        return;
    }
    if (from.publicKey.equals(dest)) {
        console.log("发送地址和接收地址一样，不处理");
        return;
    }

    // 创建交易
    let balance = await connection.getBalance(from.publicKey);
    if (balance < lamports) {
        console.log("from地址余额不足");
        return;
    }

    let transaction = new Transaction();

    transaction.add(
        SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: dest,
            lamports: lamports,
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

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    let connection = new Connection(RPC_ENDPOINT_DEV, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let data: CsvRecord[] = await parseCsvFile("./data.csv");
    console.log("data", data);

    let from = Keypair.fromSecretKey(
        Uint8Array.from(
            bs58.decode(
                "DD7evt2hCGZ9kV9do2zhubQkSqTizB2bBuL5YLR3oZJ8nQsUqEJyASjUqnjj2x5RXexP6k3PR8E2UBRovsDVESt"
            )
        )
    );

    for (let k of data) {
        await one_to_multi_transfer(
            connection,
            from,
            new PublicKey(k.address),
            k.amount * LAMPORTS_PER_SOL
        );
    }
})();
