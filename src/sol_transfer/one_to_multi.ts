/**
 * SOL 一对多转账， 一笔交易只包含一个指令， 不搞多个
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

    let from = Keypair.fromSecretKey(
        Uint8Array.from(
            bs58.decode(
                "DD7evt2hCGZ9kV9do2zhubQkSqTizB2bBuL5YLR3oZJ8nQsUqEJyASjUqnjj2x5RXexP6k3PR8E2UBRovsDVESt"
            )
        )
    );

    for (let recv of receiveDatas) {
        await sol_transfer(
            connection,
            from,
            new PublicKey(recv.address),
            recv.amount * LAMPORTS_PER_SOL
        );
    }
})();
