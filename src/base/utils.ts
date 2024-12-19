import { web3 } from "@project-serum/anchor";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Result } from "./types";
import { AccountLayout } from "@solana/spl-token";
import { Percent } from "@raydium-io/raydium-sdk";

export function calcNonDecimalValue(value: number, decimals: number): number {
    return Math.trunc(value * Math.pow(10, decimals));
}

export function calcDecimalValue(value: number, decimals: number): number {
    return value / Math.pow(10, decimals);
}

export function getKeypairFromStr(str: string): web3.Keypair | null {
    try {
        return web3.Keypair.fromSecretKey(Uint8Array.from(bs58.decode(str)));
    } catch (error) {
        return null;
    }
}

export function getKeypairFromEnv() {
    const keypairStr = process.env.KEYPAIR ?? "";
    try {
        const keypair = getKeypairFromStr(keypairStr);
        if (!keypair) throw "keypair not found";
        return keypair;
    } catch (error) {
        console.log({ error });
        throw "Keypair Not Found";
    }
}

export async function getNullableResutFromPromise<T>(
    value: Promise<T>,
    opt?: { or?: T; logError?: boolean }
): Promise<T | null> {
    return value.catch((error) => {
        if (opt) console.log({ error });
        return opt?.or != undefined ? opt.or : null;
    });
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createLookupTable(
    connection: web3.Connection,
    signer: web3.Keypair,
    addresses: web3.PublicKey[] = []
): Promise<Result<{ txSignature: string; lookupTable: string }, string>> {
    try {
        const slot = await connection.getSlot();
        addresses.push(web3.AddressLookupTableProgram.programId);
        const [lookupTableInst, lookupTableAddress] =
            web3.AddressLookupTableProgram.createLookupTable({
                authority: signer.publicKey,
                payer: signer.publicKey,
                recentSlot: slot - 1,
            });
        const extendInstruction =
            web3.AddressLookupTableProgram.extendLookupTable({
                payer: signer.publicKey,
                authority: signer.publicKey,
                lookupTable: lookupTableAddress,
                addresses,
            });
        const transaction = new web3.Transaction().add(
            lookupTableInst,
            extendInstruction
        );
        const txSignature = await connection.sendTransaction(transaction, [
            signer,
        ]);
        return {
            Ok: { txSignature, lookupTable: lookupTableAddress.toBase58() },
        };
    } catch (err) {
        err = err ?? "";
        return { Err: (err as any).toString() };
    }
}

export async function sendAndConfirmTransactionEx(
    tx: web3.VersionedTransaction | web3.Transaction,
    connection: web3.Connection
) {
    const rawTx = tx.serialize();
    const txSignature = await web3
        .sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), {
            commitment: "confirmed",
            maxRetries: 4,
        })
        .catch(async () => {
            await sleep(500);
            return await web3
                .sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), {
                    commitment: "confirmed",
                })
                .catch((txError) => {
                    console.log({ txError });
                    return null;
                });
        });
    return txSignature;
}

/**
 * 获取某个token的余额
 */
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

export function getSlippage(value?: number) {
    try {
        const slippageVal = value ?? 0;
        let denominator = (slippageVal.toString().split(".")[1] ?? "").length;
        denominator = 10 ** denominator;
        const number = slippageVal * denominator;
        denominator = denominator * 100;
        const slippage = new Percent(number, denominator);
        return slippage;
    } catch (error) {
        throw "failed to parse slippage input";
    }
}
