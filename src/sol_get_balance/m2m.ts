/**
 * SOL 批量查询SOL余额
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
import { parseCsvFile, sleep } from "../utils";

interface CsvRecord {
    address: string;
}

(async () => {
    const args = process.argv.slice(2); // 去掉前两个默认元素
    console.log("命令行参数:", args);
    if (args.length == 0) {
        console.log("请输入 csv文件路径");
        return;
    }
    let dataFilePath = args[0];
    console.log("dataFilePath", dataFilePath);

    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=b96c955e-7a00-4375-bc91-0b3d8baafbf7";

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
    console.log("hello")

    while (failedList.length > 0) {
        let datas = failedList;
        failedList = []; // 清空
        for (let data of datas) {
            try {
                let fromAddress = new PublicKey(data.address);

                let balance = await connection.getBalance(fromAddress);
                console.log(
                    `${fromAddress.toBase58()},${
                        balance / LAMPORTS_PER_SOL
                    } SOL`
                );

                //休眠0.5s
                await sleep(500);
            } catch (e) {
                console.log("error: ", e);

                // 如果是链式转账，出现失败，直接停止
                // return

                failedList.push(data);
            }
        }
    }
})();
