/**
 *  SPL Token 多对多转账
 */
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
    createAssociatedTokenAccountInstruction,
    createCloseAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    Transaction,
} from "@solana/web3.js";
import { getRandomInRange, getTokenBalance, parseCsvFile } from "../utils";
import { getTokenDelegateRoleSerializer } from "@metaplex-foundation/mpl-token-metadata";
import { web3 } from "@project-serum/anchor";
import { COMPUTE_UNIT_PRICE } from "../base/baseMpl";

interface CsvRecord {
    fromkey: string;
    mint: string;
    address: string;
    amount: Number;
    decimals: Number;
}

(async () => {
    console.log("xx");

    const RPC_ENDPOINT_MAIN =
        // "https://mainnet.helius-rpc.com/?api-key=a72af9a3-d315-4df0-8e00-883ed4cebb61";
        // "https://mainnet.helius-rpc.com/?api-key=29acd0dc-e336-4909-873a-0ed1010a9de2";
        "https://mainnet.helius-rpc.com/?api-key=adbb2586-7020-4d8b-b814-e4f39bcd36c6"; // 李咏，付费RPC

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    let connection = new Connection(RPC_ENDPOINT_MAIN, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
    });

    let m2mDatas: CsvRecord[] = await parseCsvFile<CsvRecord>("./m2m.csv");
    console.log("datas长度", m2mDatas.length);

    let dataList = m2mDatas;
    let failedList: CsvRecord[] = [];
    while (true) {
        if (failedList.length > 0) {
            dataList = failedList;

            // 清空
            failedList = []
        }
        if (dataList.length == 0) {
            console.log("所有数据处理完成");
            break;
        }

        for (let data of dataList) {
            try {
                console.log("===============");
                let from = Keypair.fromSecretKey(
                    Uint8Array.from(bs58.decode(data.fromkey.trim()))
                );
                console.log(
                    `当前处理: ${from.publicKey.toBase58()} => ${
                        data.address
                    } , ${data.amount} Token`
                );

                let rawBalance = await getTokenBalance(
                    connection,
                    from.publicKey,
                    new PublicKey(data.mint)
                );
                let amount = Number(data.amount);
                if (Number(data.amount) < 0) {
                    amount = Number(rawBalance);
                } else {
                    // amount = data.amount * Math.pow(10, data.decimals);

                    // 随机增加一点，
                    console.log("data.amount: ", data.amount);
                    console.log("data.decimals", data.decimals);
                    amount = Math.floor(
                        (amount + getRandomInRange(1, 10000)) *
                            Math.pow(10, Number(data.decimals))
                    );
                    console.log("amount = ", amount);
                }

                let tx = new Transaction();
                let payer = from;
                let mint = new PublicKey(data.mint);
                let dest = new PublicKey(data.address);

                // 更新计算单元价格
                const updateCuIx =
                    web3.ComputeBudgetProgram.setComputeUnitPrice({
                        microLamports: 500_000,
                    });
                tx.add(updateCuIx);

                let srcATA = getAssociatedTokenAddressSync(
                    mint,
                    from.publicKey
                );
                console.log("source ,", from.publicKey.toBase58());
                console.log("source ata,", srcATA.toBase58());
                let destATA = getAssociatedTokenAddressSync(mint, dest);

                let ataInfo = await connection.getAccountInfo(destATA);
                if (!ataInfo) {
                    tx.add(
                        createAssociatedTokenAccountInstruction(
                            payer.publicKey,
                            destATA,
                            dest,
                            mint
                        )
                    );
                }

                if (Number(data.amount) > 0 && ataInfo) {
                    let balance = await getTokenBalance(connection, dest, mint);
                    if (balance > BigInt(160680 * 10 ** 6)) {
                        console.log("已经有余额，跳过");
                        continue;
                    }
                }

                tx.add(
                    createTransferInstruction(
                        srcATA,
                        destATA,
                        from.publicKey,
                        amount
                    )
                );

                // 如果是清空， 则关闭ATA账户
                if (Number(data.amount) < 0) {
                    tx.add(
                        createCloseAccountInstruction(
                            srcATA,
                            from.publicKey,
                            from.publicKey
                        )
                    );
                }

                // transfer
                let sig = await sendAndConfirmTransaction(connection, tx, [
                    from,
                ]);
                console.log("signature:", sig.toString());
            } catch (e) {
                console.log("error:", e);

                // 插入到失败列表，稍后继续重试
                failedList.push(data)
            }
        }
    }
})();
