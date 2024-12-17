import * as web3 from "@solana/web3.js";
import { AccountLayout } from "@solana/spl-token";

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
