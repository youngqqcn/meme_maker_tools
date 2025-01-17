/*
参考: https://bot.slerf.tools/zh-cn/market-making/solana
拉升币价

- 目标价格?
- 运行时长?
- 累计最大交易额?
- 单笔交易量(SOL)区间, 最小和最大
- 买入设定内区间随机数量

*/

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getRandomInRange, parseCsvFile } from "../../utils";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { swap } from "../swap";
import { getSlippage, sleep } from "../../base/utils";
import { Liquidity } from "@raydium-io/raydium-sdk";
import { getOpenBookMarketKeypair } from "../../base/getOpenBookMarketKeypair";
interface CsvRecord {
    key: string;
}

(async () => {
    const RPC_ENDPOINT_MAIN =
        // "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
        "https://mainnet.helius-rpc.com/?api-key=adbb2586-7020-4d8b-b814-e4f39bcd36c6"; // 李咏，付费RPC

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";

    let connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    // let datas: CsvRecord[] = (await parseCsvFile<CsvRecord>("./pump_price.csv").catch((x)=>console.log(x)));
    let datas: CsvRecord[];
    try {
        datas = await parseCsvFile<CsvRecord>("./pump_price.csv");
    } catch (e) {
        console.log("解析excel错误: ", e);
        return;
    }
    console.log("datas长度", datas.length);

    let sleep_ms = 60_000; // 间隔时间(毫秒)

    let mint = "DWYNRC2FFBRFAuifHYmyDG6427sBqjKS1NBsdnfpLUL9";
    let marketId = await getOpenBookMarketKeypair(mint);
    console.log("marketId: ", marketId.publicKey.toBase58());
    let poolId = Liquidity.getAssociatedId({
        marketId: marketId.publicKey,
        programId: new PublicKey(
            "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
        ), // mainnet
    });
    console.log("poolId: ", poolId.toBase58());

    while (true) {
        for (let data of datas) {
            console.log("===============");
            console.log(data.key);

            let from = Keypair.fromSecretKey(
                Uint8Array.from(bs58.decode(data.key.trim()))
            );
            console.log(`当前处理: ${from.publicKey.toBase58()} `);

            // let amount = Math.round(getRandomInRange(1000, 5000));
            let amount = 0.1 + ((Math.random() * 100) % 20) / 1000; // 按照SOL数量购买

            console.log("买入数量: ", amount);

            // 买入
            try {
                // 特别注意： 要注意却分base 和 quote , 使用自己工具建的池子，base是token, quote是SOL
                let ret = await swap(
                    connection,
                    from,
                    {
                        poolId: poolId,
                        buyToken: "base", // 买入 Token
                        sellToken: "quote",
                        amountSide: "send",
                        amount: amount,
                        slippage: getSlippage(10),
                    },
                    5_000_000,
                    0.0001
                );

                // 特别注意： 从pump.fun发出来的token, 其quote是token, 其base是SOL
                // 按照 SOL 数量购买
                // let ret = await swap(
                //     connection,
                //     from,
                //     {
                //         poolId: poolId,
                //         buyToken: "quote", //"base",
                //         sellToken: "base", //"quote",
                //         amountSide: "send",
                //         amount: amount,
                //         slippage: getSlippage(15),
                //     },
                //     5_000_000,
                //     0.0001
                // );

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
