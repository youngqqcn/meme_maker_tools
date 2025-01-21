/*
下跌币价
*/

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getRandomInRange, getTokenBalance, parseCsvFile } from "../../utils";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { swap } from "../swap";
import { getSlippage, sleep } from "../../base/utils";
import { getOpenBookMarketKeypair } from "../../base/getOpenBookMarketKeypair";
import { Liquidity } from "@raydium-io/raydium-sdk";
interface CsvRecord {
    key: string;
}

(async () => {
    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
        // "https://mainnet.helius-rpc.com/?api-key=adbb2586-7020-4d8b-b814-e4f39bcd36c6"; // 李咏，付费RPC

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";

    let connection = new Connection(RPC_ENDPOINT_MAIN, {
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

    let sleep_ms = 20*60_000; // 间隔时间(毫秒)

    while (true) {
        try {
            for (let data of datas) {
                console.log("===============");
                console.log("Key: ", data.key);

                let from = Keypair.fromSecretKey(
                    Uint8Array.from(bs58.decode(data.key.trim()))
                );
                console.log(`当前处理: ${from.publicKey.toBase58()} `);

                let balance = await getTokenBalance(
                    connection,
                    from.publicKey,
                    new PublicKey(mint)
                );
                if (balance == BigInt(0)) {
                    console.log("token余额为0");
                    continue;
                }

                let amount = getRandomInRange(100000, 150000);
                if (amount > balance) {
                    amount = Number(balance);
                }

                console.log("卖出数量: ", amount);

                // 卖出token
                try {
                    let ret = await swap(
                        connection,
                        from,
                        {
                            poolId: poolId,
                            buyToken: "quote",
                            sellToken: "base",
                            amountSide: "send",
                            amount: amount,
                            slippage: getSlippage(10),
                        },
                        1_000_000,
                        0.0001
                    );

                    // 特别注意： 从pump.fun发出来的token, 其quote是token, 其base是SOL
                    // let ret = await swap(connection, from, {
                    //     poolId: poolId,
                    //     buyToken: "base",
                    //     sellToken: "quote",
                    //     amountSide: "send",
                    //     amount: amount,
                    //     slippage: getSlippage(15),
                    // });
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
        } catch (e) {
            console.log(e);
        }
    }
})();
