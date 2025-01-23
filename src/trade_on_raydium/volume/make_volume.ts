/*
刷量
*/

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
import { getRandomInRange, getTokenBalance, parseCsvFile } from "../../utils";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { swap } from "../swap";
import { calcDecimalValue, getSlippage, sleep } from "../../base/utils";
import { getExplorerLink } from "@solana-developers/helpers";
import { getOpenBookMarketKeypair } from "../../base/getOpenBookMarketKeypair";
import { Liquidity, MAINNET_PROGRAM_ID } from "@raydium-io/raydium-sdk";
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

    let datas: CsvRecord[];
    try {
        datas = await parseCsvFile<CsvRecord>("./make_volume.csv");
    } catch (e) {
        console.log("解析excel错误: ", e);
        return;
    }
    console.log("datas长度", datas.length);

    let mint = "DWYNRC2FFBRFAuifHYmyDG6427sBqjKS1NBsdnfpLUL9";
    let marketId = await getOpenBookMarketKeypair(mint);
    console.log("marketId: ", marketId.publicKey.toBase58());
    let poolId = Liquidity.getAssociatedId({
        marketId: marketId.publicKey,
        programId: new PublicKey(
            MAINNET_PROGRAM_ID.AmmV4 // "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
        ), // mainnet
    });
    console.log("poolId: ", poolId.toBase58());

    let sleep_ms = 10_000; // 间隔时间(毫秒)
    while (true) {
        for (let data of datas) {
            await sleep(10);

            console.log("===============");
            console.log(data.key);

            let from = Keypair.fromSecretKey(
                Uint8Array.from(bs58.decode(data.key.trim()))
            );
            console.log(`当前处理: ${from.publicKey.toBase58()} `);

            // 买入
            let isBuy = getRandomInRange(0, 100) <= 70; // 50%的概率
            try {
                if (isBuy) {
                    let amount = Math.round(getRandomInRange(10000, 20000));
                    console.log("===买入数量: ", amount);
                    let ret = await swap(connection, from, {
                        poolId: poolId,
                        buyToken: "base", // 买入 Token
                        sellToken: "quote",
                        amountSide: "receive",
                        amount: amount,
                        slippage: getSlippage(10),
                    });
                    if (ret.Err) {
                        console.error(ret.Err);
                    } else {
                        console.log("sig:", ret.Ok?.txSignature);
                    }
                } else {
                    // 卖出，全部卖出
                    let rawBalance = await getTokenBalance(
                        connection,
                        from.publicKey,
                        new PublicKey(mint)
                    );

                    let balance = calcDecimalValue(Number(rawBalance), 6);
                    console.log("balance: ", Number(balance));
                    if (balance < BigInt(101)) {
                        console.log("token余额不足100");
                        continue;
                    }

                    let amount = balance - 100; // 留一点点，放置ATA账户被关闭
                    console.log("====卖出数量:", amount);

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
                }
            } catch (e) {
                console.error("交易失败:", e);
            }

            await sleep(sleep_ms);
        }
    }
})();
