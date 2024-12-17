import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
    PublicKey as Web3JsPublicKey,
    Transaction as Web3JsTransaction,
    VersionedTransaction as Web3JsVersionedTransaction,
    Keypair,
} from "@solana/web3.js";

export type Web3JsTransactionOrVersionedTransaction =
    | Web3JsTransaction
    | Web3JsVersionedTransaction;

export type WalletAdapter = {
    publicKey: Web3JsPublicKey | null;
    signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
    signTransaction?: <T extends Web3JsTransactionOrVersionedTransaction>(
        transaction: T
    ) => Promise<T>;
    signAllTransactions?: <T extends Web3JsTransactionOrVersionedTransaction>(
        transactions: T[]
    ) => Promise<T[]>;
};

export class MyWalletAdapter implements WalletAdapter {
    publicKey: Web3JsPublicKey | null;
    private keypair: Keypair;

    constructor(secretKey: string) {
        if (secretKey) {
            // 从密钥创建 Keypair
            this.keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
        } else {
            // 随机生成一个 Keypair
            // this.keypair = Keypair.generate();
            throw Error("必须设置私钥");
        }
        this.publicKey = this.keypair.publicKey;
    }

    // 签名消息
    async signMessage(message: Uint8Array): Promise<Uint8Array> {
        //   const signedMessage = this.keypair(message);
        return message;
    }

    // 签名单个交易
    async signTransaction<T extends Web3JsTransactionOrVersionedTransaction>(
        transaction: T
    ): Promise<T> {
        if (transaction instanceof Web3JsTransaction) {
            transaction.partialSign(this.keypair);
        } else if (transaction instanceof Web3JsVersionedTransaction) {
            transaction.sign([this.keypair]);
        } else {
            throw new Error("Unsupported transaction type");
        }
        return transaction;
    }

    // 签名多个交易
    async signAllTransactions<
        T extends Web3JsTransactionOrVersionedTransaction
    >(transactions: T[]): Promise<T[]> {
        return Promise.all(transactions.map((tx) => this.signTransaction(tx)));
    }
}
