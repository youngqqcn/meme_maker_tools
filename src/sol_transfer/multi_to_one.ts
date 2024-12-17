/**
 * SOL 多对一转账,  主要用于归集
 */

import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { sol_transfer } from "../utils";

(async () => {
    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";
    let connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let keys = ["TODO"];

    for (let k of keys) {
        let dest = new PublicKey(
            "8fq7Voz95UnftS9tZVy1a21owiED7bR7i72UDPhpHfMQ"
        );

        let from = Keypair.fromSecretKey(Uint8Array.from(bs58.decode(k)));
        let balance = await connection.getBalance(from.publicKey);
        if (balance < 5000) {
            console.log(from.publicKey.toBase58(), "余额太小, 跳过 ");
            continue;
        }

        let amount = balance - 5000; // 全部归集完
        await sol_transfer(connection, from, dest, amount);
    }
})();
