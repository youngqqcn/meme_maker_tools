// ACCOUNT ID:  f27af8aa-4270-48ad-a373-82503e87a099
// API KEY:  ZjI3YWY4YWEtNDI3MC00OGFkLWEzNzMtODI1MDNlODdhMDk5OjZjYzI2NzY2Yzc5MjY4ODQ5ZmVlMmMyMDRiYzBiNzQ2

import {
    BaseProvider,
    createTraderAPIMemoInstruction,
    HttpProvider,
    loadFromEnv,
    MAINNET_API_NY_HTTP,
    TESTNET_API_HTTP,
} from "@bloxroute/solana-trader-client-ts";
import {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import { AxiosRequestConfig } from "axios";
import bs58 from "bs58";

// const DEVNET_API_HTTP =
    // "http://solana-trader-api-nlb-6b0f765f2fc759e1.elb.us-east-1.amazonaws.com";

const transactionWaitTimeS = 60;
const httpTimeout = 30_000;
const httpLongTimeout = 60_000;

function delay(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const config = loadFromEnv();

async function submitTransferWithMemoAndTip(provider: BaseProvider) {
    const keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));
    const memo = createTraderAPIMemoInstruction("");

    console.log("address: ", keypair.publicKey.toBase58());
    const receiverPublicKey = new PublicKey(
        "3KxsrEWqbCvRqhHHcSkPWXQt39WiiVTaEb3TXUVXv76a"
    );
    const latestBlockhash = await provider.getRecentBlockHash({});

    let transaction = new Transaction({
        recentBlockhash: latestBlockhash.blockHash,
        feePayer: keypair.publicKey,
    })
        .add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: receiverPublicKey,
                lamports: 0.000001 * LAMPORTS_PER_SOL,
            })
        )
        .add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new PublicKey(
                    "HWEoBxYs7ssKuudEjzjmpfJVX7Dvi7wescFsVx2L5yoY"
                ),
                lamports: 0.001 * LAMPORTS_PER_SOL,
            })
        );
    transaction = transaction.add(memo);

    transaction.sign(keypair);
    const serializedTransaztionBytes = transaction.serialize();
    const buff = Buffer.from(serializedTransaztionBytes);
    const encodedTxn = buff.toString("base64");
    const response = await provider.postSubmit({
        transaction: { content: encodedTxn, isCleanup: false },
        skipPreFlight: false,
    });
    console.info(response.signature);
}

(async () => {
    const requestConfig: AxiosRequestConfig = {
        timeout: httpTimeout,
    };
    let provider = new HttpProvider(
        config.authHeader,
        config.privateKey,
        MAINNET_API_NY_HTTP,
        requestConfig
    );

    await submitTransferWithMemoAndTip(provider);
})();

// 测试成功: https://solscan.io/tx/27T6CGsUSyfiegPe3kExhzVhG9aWUSFASmPAcG65u4xAWPBzyxVfwTJeg9ehGAeW9HastKtEZySV5CJjTeXzCMJP
