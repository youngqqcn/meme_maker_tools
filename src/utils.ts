import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import Papa from "papaparse";
import fs from "fs";
import {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";

export async function getTokenBalance(
    connection: Connection,
    owner: PublicKey,
    mint: PublicKey
): Promise<bigint> {
    const tokenAccounts = await connection.getTokenAccountsByOwner(owner, {
        programId: TOKEN_PROGRAM_ID,
        mint: mint,
    });
    if (!tokenAccounts) {
        console.log("未找到相关mint");
        return BigInt(0);
    }
    const accountData = AccountLayout.decode(
        tokenAccounts.value[0].account.data
    );

    let amount = accountData?.amount ?? BigInt(0);
    return amount;
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseCsvFile<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, "utf-8", (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            const result = Papa.parse<T>(data, {
                header: true, // 使用第一行作为键名
                skipEmptyLines: true, // 跳过空行
            });

            if (result.errors.length > 0) {
                reject(result.errors);
            } else {
                resolve(result.data);
            }
        });
    });
}

export const getRandomElement = <T>(list: T[]): T | undefined => {
    if (list.length === 0) return undefined; // 如果数组为空，返回 undefined
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
};

export const getRandomElementX = <T>(list: T[]): T => {
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
};

export async function sol_transfer(
    connection: Connection,
    from: Keypair,
    dest: PublicKey,
    lamports: number
) {
    if (lamports <= 5000) {
        console.log(
            `${from.publicKey.toBase58()}, 转 ${lamports} , 金额太小，跳过`
        );
        return;
    }
    if (from.publicKey.equals(dest)) {
        console.log("发送地址和接收地址一样，不处理");
        return;
    }

    // 创建交易
    let balance = await connection.getBalance(from.publicKey);
    if (balance < lamports) {
        console.log("from地址余额不足");
        return;
    }

    let transaction = new Transaction();

    transaction.add(
        SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: dest,
            lamports: lamports,
        })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [
        from,
    ]);

    console.log("signature: ", signature.toString());
}

/**
 * 生成指定范围内的随机数
 * @param min 最小值（包含）
 * @param max 最大值（包含）
 * @returns 范围内的随机数
 */
export function getRandomInRange(min: number, max: number): number {
    return Math.random() * (max - min + 1) + min;
}


// 洗牌算法
export function shuffle<T>(array: T[]): T[] {
    // 创建数组的副本，避免修改原数组
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {
        // 生成一个 [0, i] 范围内的随机索引
        const j = Math.floor(Math.random() * (i + 1));

        // 交换 arr[i] 和 arr[j]
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}