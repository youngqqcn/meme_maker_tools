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

// Solana RPC连接
const connection = new Connection(
    "https://mainnet.helius-rpc.com/?api-key=29acd0dc-e336-4909-873a-0ed1010a9de2",
    "confirmed"
);

// 目标Token的Mint地址
const mintAddress = new PublicKey(
    "DWYNRC2FFBRFAuifHYmyDG6427sBqjKS1NBsdnfpLUL9"
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

    const holders = accounts.map((account) => {
        const accountInfo = account.account.data;
        const tokenAmount = accountInfo.slice(64, 72); // 余额在Account的第64-72字节
        const balance = tokenAmount.readBigInt64LE(0); // 转换为数量
        const holderAddress = account.pubkey.toString();

        // 获取持币者地址（ATA账户的所有者地址）
        const ownerBuffer = accountInfo.slice(0, 32); // 从前32字节获取所有者地址
        const ownerAddress = new PublicKey(ownerBuffer);

        return {
            holderAddress,
            ownerAddress: ownerAddress.toBase58(),
            balance: balance.toString(),
        };
    });

    // let holders = [""];
    // console.log(holders);

    return holders;
}

getTokenHolders()
    .then((holders) => {
        console.log(holders);
        console.log("总共持仓地址: ", holders.length)
    })
    .catch((err) => {
        console.error(err);
    });
