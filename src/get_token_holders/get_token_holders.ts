// const { Connection, PublicKey } = require('@solana/web3.js');
// const { TOKEN_PROGRAM_ID, getAccount } = require('@solana/spl-token');
import * as web3 from "@solana/web3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    createBurnInstruction,
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { parseCsvFile } from "../utils";
import { tryResolvePackage } from "tslint/lib/utils";

interface CsvRecord {
    address: string;
}

// Solana RPC连接
const connection = new Connection(
    "https://mainnet.helius-rpc.com/?api-key=29acd0dc-e336-4909-873a-0ed1010a9de2",
    "confirmed"
);

// 目标Token的Mint地址
const mintAddress = new PublicKey(
    "DWYNRC2FFBRFAuifHYmyDG6427sBqjKS1NBsdnfpLUL9" // CAMI
    // "84FhSgZexvSf2pjGGRSiAWtvJJHZcS6VVrXhJmqYmidx" // KOIAI
); // 替换为实际Mint地址

async function getTokenHolders() {
    // 获取所有与目标Mint地址相关的账户
    const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
            {
                dataSize: 165, // SPL Token账户的大小
            },
            {
                memcmp: {
                    offset: 0, // Token账户的第一部分是Mint地址
                    bytes: mintAddress.toBase58(), // 与目标Mint地址匹配
                },
            },
        ],
    });
    // console.log(accounts);

    //账户数据结构： https://github.com/solana-program/token/blob/main/program/src/state.rs#L89-L110
    const holders = accounts.map((account) => {
        const accountInfo = account.account.data;
        const tokenAmount = accountInfo.slice(64, 72); // 余额在Account的第64-72字节
        const balance = tokenAmount.readBigInt64LE(0); // 转换为数量
        const holderAddress = account.pubkey.toString();

        // 获取持币者地址（ATA账户的所有者地址）
        const ownerBuffer = accountInfo.slice(32, 64); //
        const ownerAddress = new PublicKey(ownerBuffer);

        return {
            holderAddress,
            ownerAddress: ownerAddress.toBase58(),
            balance: Number(balance) / 10 ** 6,
        };
    });

    // let holders = [""];
    // console.log(holders);

    const addresses = new Map();
    for (let holder of holders) {
        addresses.set(holder.ownerAddress, holder);
    }

    return addresses;
}

(async () => {
    try {
        // let datas: CsvRecord[] = await parseCsvFile<CsvRecord>("./data_koiai.csv");
        let datas: CsvRecord[] = await parseCsvFile<CsvRecord>("./data_cami.csv");
        console.log("地址数", datas.length);

        // 获取holders
        let holders = await getTokenHolders();
        // console.log(holders);

        // 挑出外部地址
        let innerAddrMap = new Map();
        for (let d of datas) {
            innerAddrMap.set(d.address.trim(), d.address.trim());
        }

        console.log("===========外部地址=========");
        let extAmountTokenSum = 0;
        let extAddrCount = 0;
        let totalHolders = 0;
        let innertTokenSum = 0;
        let poolTokenSum = 0;

        let extAddrs = [];
        let innerAddrs = [];
        for (let [k, v] of holders) {
            if (v["balance"] > 0) {
                if (k == "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1") {
                    // 池子
                    poolTokenSum += v["balance"];
                    continue;
                }

                totalHolders += 1;
                if (!innerAddrMap.has(k)) {
                    // console.log(k, v["balance"]);
                    extAddrs.push(v);
                    extAmountTokenSum += v["balance"];
                    extAddrCount += 1;
                } else {
                    innertTokenSum += v["balance"];
                    innerAddrs.push(v);
                }
            }
        }

        extAddrs.sort((a: any, b: any) => b["balance"] - a["balance"]); // 倒序排序，大的在前
        console.log("地址".padStart(35), "token数量".padStart(15), "占比(%)".padStart(12));
        extAddrs.forEach((a: any) =>
            console.log(String(a["ownerAddress"]).padStart(45), Number(a["balance"]).toFixed(2).toString().padEnd(15), (Number(a["balance"])/10_0000_0000).toFixed(8).toString() + '%')
        );

        // innerAddrs.sort((a: any, b: any) => b["balance"] - a["balance"]); // 倒序排序，大的在前
        // console.log("地址".padStart(35), "token数量".padStart(15), "占比(%)".padStart(12));
        // innerAddrs.forEach((a: any) =>
        //     console.log(String(a["ownerAddress"]).padStart(45), Number(a["balance"]).toFixed(2).toString().padEnd(15), (Number(a["balance"])/10_0000_0000).toFixed(8).toString() + '%')
        // );


        console.log("==========================");
        console.log("总有效持仓地址数: ", totalHolders);
        console.log("====");
        console.log("  Raydium池子Token数:", poolTokenSum.toFixed(2));
        console.log(
            "  Raydium池子Token占比:",
            ((poolTokenSum / 10_0000_0000) * 100).toFixed(3),
            "%"
        );

        console.log("=====");
        console.log("  内部持仓地址:", totalHolders - extAddrCount);
        console.log("  内部持仓token数:", innertTokenSum.toFixed(2));
        console.log(
            "  内部持仓token占比: ",
            ((innertTokenSum / 10_0000_0000) * 100).toFixed(3),
            "%"
        );
        console.log("===");

        console.log("  外部持仓地址数: ", extAddrCount);
        console.log("  外部总token数: ", extAmountTokenSum.toFixed(2));
        console.log(
            "  外部总token占比: ",
            ((extAmountTokenSum / 10_0000_0000) * 100).toFixed(3),
            "%"
        );
    } catch (e) {
        console.log("error", e);
    }
})();
