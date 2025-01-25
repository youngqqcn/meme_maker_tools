/*
换手
*/
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getRandomInRange, getTokenBalance, parseCsvFile, shuffle } from "../../utils";
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
        // "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
        "https://mainnet.helius-rpc.com/?api-key=adbb2586-7020-4d8b-b814-e4f39bcd36c6"; // 李咏，付费RPC

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    let connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let datas: CsvRecord[];
    try {
        datas = await parseCsvFile<CsvRecord>("./turnover.csv");
    } catch (e) {
        console.log("解析excel错误: ", e);
        return;
    }
    console.log("datas长度", datas.length);

    let mint = "84FhSgZexvSf2pjGGRSiAWtvJJHZcS6VVrXhJmqYmidx";
    let marketId = await getOpenBookMarketKeypair(mint);
    console.log("marketId: ", marketId.publicKey.toBase58());
    let poolId = Liquidity.getAssociatedId({
        marketId: marketId.publicKey,
        programId: new PublicKey(
            MAINNET_PROGRAM_ID.AmmV4 // "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
        ), // mainnet
    });
    console.log("poolId: ", poolId.toBase58());

    let sleep_ms = 60_000; // 间隔时间(毫秒)
    while (true) {
        // 打乱顺序
        datas = shuffle(datas);

        for (let data of datas) {
            console.log("===============");
            console.log(data.key);

            let from = Keypair.fromSecretKey(
                Uint8Array.from(bs58.decode(data.key.trim()))
            );
            console.log(`当前处理: ${from.publicKey.toBase58()} `);

            let turnOverAmount = getRandomInRange(1000, 3000);
            try {
                let rawBalance = await getTokenBalance(
                    connection,
                    from.publicKey,
                    new PublicKey(mint)
                );

                // 先卖出，再买入
                let balance = calcDecimalValue(Number(rawBalance), 6);
                if (balance > turnOverAmount) {
                    console.log("balance: ", Number(balance));
                    // if (balance < BigInt(101)) {
                    //     console.log("token余额不足100");
                    //     continue;
                    // }
                    // 卖出
                    console.log("====卖出数量:", turnOverAmount);
                    let ret = await swap(connection, from, {
                        poolId: poolId,
                        buyToken: "quote",
                        sellToken: "base",
                        amountSide: "send",
                        amount: turnOverAmount,
                        slippage: getSlippage(15),
                    }, 100_000, 0.00001);
                    if (ret.Err) {
                        console.error(ret.Err);
                    } else {
                        console.log("sig:", ret.Ok?.txSignature);
                    }
                }
            } catch (e) {
                console.log("error: ", e);
            }

            // 买入
            try {
                if (turnOverAmount > 0) {
                    console.log("===买入数量: ", turnOverAmount);
                    let ret = await swap(connection, from, {
                        poolId: poolId,
                        buyToken: "base", // 买入 Token
                        sellToken: "quote",
                        amountSide: "receive",
                        amount: Number(turnOverAmount),
                        slippage: getSlippage(15),
                    }, 100_000, 0.00001);
                    if (ret.Err) {
                        console.error(ret.Err);
                    } else {
                        console.log("sig:", ret.Ok?.txSignature);
                    }
                }
                await sleep(sleep_ms);
            } catch (e) {
                console.error("交易失败:", e);
            }

        }
    }
})();
