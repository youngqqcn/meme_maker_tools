/**
 * SOL 多对多转账
 *
 * 参考 https://slerf.tools/zh-cn/multi-to-multi-transfer/solana
 *
 * 随机从from地址列表中选取一个
 */
import fs from "fs";
import Papa from "papaparse";

import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
} from "@solana/web3.js";
import { parseCsvFile, sol_transfer } from "../utils";

interface CsvRecord {
    fromkey: string;
    address: string;
    amount: number;
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

    let m2mDatas: CsvRecord[] = await parseCsvFile<CsvRecord>("./m2m.csv");
    console.log("datas长度", m2mDatas.length);

    for (let data of m2mDatas) {
        console.log("===============");
        let from = Keypair.fromSecretKey(
            Uint8Array.from(bs58.decode(data.fromkey.trim()))
        );
        console.log(
            `当前处理: ${from.publicKey.toBase58()} => ${data.address} , ${
                data.amount
            } SOL`
        );

        // 如果amount是负数, 则全部归集
        if (data.amount <= -1) {
            let balance = await connection.getBalance(from.publicKey);
            if (balance < 5000) {
                console.log(from.publicKey.toBase58(), "余额太小, 跳过 ");
                continue;
            }

            let dest = new PublicKey(data.address);
            let amount = balance - 5000; // 全部归集完
            await sol_transfer(connection, from, dest, amount);
        } else {
            // 普通转账
            await sol_transfer(
                connection,
                from,
                new PublicKey(data.address.trim()),
                data.amount * LAMPORTS_PER_SOL
            );
        }
    }
})();
