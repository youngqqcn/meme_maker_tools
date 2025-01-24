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
import { parseCsvFile, sleep, sol_transfer } from "../utils";

interface CsvRecord {
    fromkey: string;
    address: string;
    amount: Number;
}

(async () => {
    const args = process.argv.slice(2); // 去掉前两个默认元素
    console.log("命令行参数:", args);
    if (args.length == 0) {
        console.log("请输入 csv文件路径");
        return;
    }
    let dataFilePath = args[0];

    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
        // https://mainnet.helius-rpc.com/?api-key=29acd0dc-e336-4909-873a-0ed1010a9de2 ; // yqq 163.com
        // "https://mainnet.helius-rpc.com/?api-key=adbb2586-7020-4d8b-b814-e4f39bcd36c6"; // 李咏，付费RPC

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";

    let connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let m2mDatas: CsvRecord[] = await parseCsvFile<CsvRecord>(dataFilePath);
    console.log("datas长度", m2mDatas.length);

    m2mDatas = m2mDatas.slice(0); // 截取

    let failedList: CsvRecord[] = m2mDatas;

    while (failedList.length > 0) {
        let datas = failedList;
        failedList = []; // 清空
        for (let data of datas) {
            try {
                console.log("===============");
                let from = Keypair.fromSecretKey(
                    Uint8Array.from(bs58.decode(data.fromkey.trim()))
                );
                console.log(
                    `当前处理: ${from.publicKey.toBase58()} => ${
                        data.address
                    } , ${data.amount} SOL`
                );

                // 如果amount是负数, 则全部归集
                if (Number(data.amount) <= -1) {
                    let balance = await connection.getBalance(from.publicKey);
                    if (balance < 5000) {
                        console.log(
                            from.publicKey.toBase58(),
                            "余额太小, 跳过 "
                        );
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
                        Number(data.amount) * LAMPORTS_PER_SOL
                    );
                }

                //休眠分钟

                // let sleep_ms = (13 + ((Math.random() * 10) % 5)) * 60 * 1000;
                // let sleep_ms = 11.33 * 60 * 1000;
                let sleep_ms = 3 * 60 * 1000;

                // console.log("开始休眠", sleep_ms, " ms");
                // await sleep(sleep_ms); //

                await sleep(2000); //链式转账，必须休眠一下, 防止余额没更新过来
            } catch (e) {
                console.log("error: ", e);


                // 如果是链式转账，出现失败，直接停止
                // return


                failedList.push(data);
            }
        }
    }
})();
