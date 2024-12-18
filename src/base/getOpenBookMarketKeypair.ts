import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Liquidity } from "@raydium-io/raydium-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as CryptoJS from "crypto-js";

function sha256ToUint8Array(data: string): Uint8Array {
    const hash = CryptoJS.SHA256(data); // 生成哈希
    const hexString = hash.toString(CryptoJS.enc.Hex); // 转为十六进制字符串
    const byteArray = hexString
        .match(/.{2}/g)!
        .map((byte) => parseInt(byte, 16)); // 转为字节数组
    return new Uint8Array(byteArray);
}

function uint8ArrayToHex(uint8Array: Uint8Array): string {
    return Array.from(uint8Array)
        .map((byte) => byte.toString(16).padStart(2, "0")) // 转为十六进制，确保两位
        .join(""); // 拼接成字符串
}

export async function getOpenBookMarketKeypair(
    // env: string,
    mint: string
): Promise<Keypair> {
    // token的mint地址
    let tokenMint = new PublicKey(mint);

    // 拼接成字符串
    let hashStr = "idolx_openbook_market" + tokenMint.toBase58();
    // console.log("hashStr: ", hashStr);

    // 对字符串进行sha256
    let s = sha256ToUint8Array(hashStr);
    // console.log("hash值(字节数组):", s.toString());
    // console.log("hash值:", uint8ArrayToHex(s));

    // 生成 keypair
    let marketKeypair = Keypair.fromSeed(s);
    // console.log(
    //     "私钥: ",
    //     uint8ArrayToHex(marketKeypair.secretKey.subarray(0, 32))
    // );
    // console.log("公钥:", uint8ArrayToHex(marketKeypair.publicKey.toBytes()));
    console.log("OpenBook marketId: ", marketKeypair.publicKey.toBase58());

    // 计算 Raydium PoolId
    // let ammProgramId =
    //     env == "devnet"
    //         ? new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8") // devnet
    //         : new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"); // mainnet

    // let raydiumPoolId = Liquidity.getAssociatedId({
    //     marketId: marketKeypair.publicKey,
    //     programId: ammProgramId,
    // });

    // console.log("raydium poolId: ", raydiumPoolId.toBase58());

    return marketKeypair;
}
