import * as web3 from "@solana/web3.js";
import { AccountLayout } from "@solana/spl-token";

import Papa from "papaparse";
import fs from "fs";

export async function getTokenBalance(
    connection: web3.Connection,
    owner: web3.PublicKey,
    mint: web3.PublicKey,
    programId: web3.PublicKey
): Promise<bigint> {
    const tokenAccounts = await connection.getTokenAccountsByOwner(owner, {
        programId: programId,
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

export interface CsvRecord {
    address: string;
    amount: number;
}

// 解析 CSV 字符串
export const parseCsvFile = (filePath: string): Promise<CsvRecord[]> => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, "utf-8", (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            const result = Papa.parse<CsvRecord>(data, {
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
};
