/**
 * SOL 多对多转账
 *
 * 参考 https://slerf.tools/zh-cn/multi-to-multi-transfer/solana
 *
 * 随机从from地址列表中选取一个
 */

import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
} from "@solana/web3.js";
import { CsvRecord, parseCsvFile, sol_transfer } from "../utils";

(async () => {
    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    let connection = new Connection(RPC_ENDPOINT_DEV, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let receiveDatas: CsvRecord[] = await parseCsvFile("./data.csv");
    console.log("data", receiveDatas);

    // 发送方的私钥
    let fromKeys = [""];

    if (fromKeys.length != receiveDatas.length) {
        console.log("fromKeys的数组长度必须和接收方地址数组相同");
        return;
    }

    for (let i = 0; i < receiveDatas.length; i++) {
        let fromKey = fromKeys[i];
        let recv = receiveDatas[i];

        let from = Keypair.fromSecretKey(Uint8Array.from(bs58.decode(fromKey)));
        await sol_transfer(
            connection,
            from,
            new PublicKey(recv.address),
            recv.amount * LAMPORTS_PER_SOL
        );
    }
})();
