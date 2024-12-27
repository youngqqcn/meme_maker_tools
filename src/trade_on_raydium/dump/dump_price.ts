/*
下跌币价
*/

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getRandomInRange, getTokenBalance, parseCsvFile } from "../../utils";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { swap } from "../swap";
import { getSlippage, sleep } from "../../base/utils";
interface CsvRecord {
    key: string;
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

    // let datas: CsvRecord[] = (await parseCsvFile<CsvRecord>("./pump_price.csv").catch((x)=>console.log(x)));
    let datas: CsvRecord[];
    try {
        datas = await parseCsvFile<CsvRecord>("./dump_price.csv");
    } catch (e) {
        console.log("解析excel错误: ", e);
        return;
    }
    console.log("datas长度", datas.length);

    let poolId = new PublicKey("2yLEsHFPYZFzs2dmRXfFm4ujcLorDdnJSP34K1tQdDJ4");
    let sleep_ms = 10_000; // 间隔时间(毫秒)

    while (true) {
        for (let data of datas) {
            console.log("===============");
            console.log(data.key);

            let from = Keypair.fromSecretKey(
                Uint8Array.from(bs58.decode(data.key.trim()))
            );
            console.log(`当前处理: ${from.publicKey.toBase58()} `);

            let mint = new PublicKey(
                "F7S59s66o1Q1Meps2hAMRoRzQGMX9tPMzRYtGPaT1MQ6"
            );
            let balance = await getTokenBalance(
                connection,
                from.publicKey,
                mint
            );
            if (balance == BigInt(0)) {
                console.log("token余额为0");
                continue;
            }
            let amount = Math.round(getRandomInRange(10000, 20000));
            if (amount > balance) {
                amount = Number(balance);
            }

            console.log("卖出数量: ", amount);

            // 卖出token
            try {
                let ret = await swap(connection, from, {
                    poolId: poolId,
                    buyToken: "quote",
                    sellToken: "base",
                    amountSide: "send",
                    amount: amount,
                    slippage: getSlippage(10),
                });
                if (ret.Err) {
                    console.error(ret.Err);
                } else {
                    console.log("sig:", ret.Ok?.txSignature);
                }
            } catch (e) {
                console.log("swap error:", e);
            }

            await sleep(sleep_ms);
        }
    }
})();
