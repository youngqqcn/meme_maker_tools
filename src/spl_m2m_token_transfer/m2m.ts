/**
 *  SPL Token 多对多转账
 */
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount,
    transfer,
} from "@solana/spl-token";
import {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    Transaction,
} from "@solana/web3.js";
import fs from "fs";
import Papa from "papaparse";

export interface CsvRecord {
    fromkey: string;
    mint: string;
    address: string;
    amount: number;
    decimals: number;
}

// 解析 CSV 字符串
export const parseCsvFile = (filePath: string): Promise<CsvRecord[]> => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, "utf-8", (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            const result = Papa.parse<CsvRecord>(data, {
                header: true, // 使用第一行作为键名
                skipEmptyLines: true, // 跳过空行
            });

            if (result.errors.length > 0) {
                reject(result.errors);
            } else {
                resolve(result.data);
            }
        });
    });
};

(async () => {
    console.log("xx");

    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    let connection = new Connection(RPC_ENDPOINT_DEV, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let m2mDatas: CsvRecord[] = await parseCsvFile("./m2m.csv");
    console.log("datas长度", m2mDatas.length);

    for (let data of m2mDatas) {
        console.log("===============");
        let from = Keypair.fromSecretKey(
            Uint8Array.from(bs58.decode(data.fromkey.trim()))
        );
        console.log(
            `当前处理: ${from.publicKey.toBase58()} => ${data.address} , ${
                data.amount
            } Token`
        );

        let tx = new Transaction();
        let payer = from;
        let mint = new PublicKey(data.mint);
        let dest = new PublicKey(data.address);

        let srcATA = getAssociatedTokenAddressSync(mint, from.publicKey);
        console.log("source ,", from.publicKey.toBase58())
        console.log("source ata,", srcATA.toBase58())
        let destATA = getAssociatedTokenAddressSync(mint, dest);
        tx.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                destATA,
                dest,
                mint
            )
        );

        tx.add(
            createTransferInstruction(
                srcATA,
                destATA,
                from.publicKey,
                data.amount * Math.pow(10, data.decimals)
            )
        );

        // transfer
        let sig = await sendAndConfirmTransaction(connection, tx, [from, ]);
        console.log("signature:", sig.toString());
    }
})();
