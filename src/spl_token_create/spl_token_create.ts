import fs from "fs";
import { PinataSDK } from "pinata-web3";
import { AuthorityType, setAuthority } from "@metaplex-foundation/mpl-toolbox";
import { Connection, Keypair } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
    TokenStandard,
    createAndMint,
    mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
    generateSigner,
    percentAmount,
    publicKey,
} from "@metaplex-foundation/umi";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { MyWalletAdapter } from "./adapter";

const NEXT_PUBLIC_PINATA_JWT =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2ZDBmOWE0ZS00ZmI3LTRjYzUtYTZmMS04ZDIxMzIyYzkyY2YiLCJlbWFpbCI6InlvdW5ncXFjbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiYzBiMTY1YWRiNjA1ODE1NzViMDkiLCJzY29wZWRLZXlTZWNyZXQiOiIwNzRiNThmYzMxYmE1MTAwZmMxZWI1YjdhYTZiMmE4ZDEwZjBkNGZhOTE0NmQ5NGE3MTI0ZWE4ZjM0ZTlmMzM0IiwiZXhwIjoxNzY1NjEyMTM0fQ.L-8x9KE5DP5Yg4xPDWL-GmUeMtYkwxUy-M_bJQA49qI";
const NEXT_PUBLIC_PINATE_GATEWAY_KEY =
    "qjEf2Z-UPk1o5gchMQEZz4euTdi_dPj-njjHTaeXpOI7cQwAoj-eXkjqsLPkY-uE";
const NEXT_PUBLIC_PINATE_GATEWAY = "amber-close-beetle-946.mypinata.cloud";

async function createSplToken(
    tokenName: string,
    symbol: string,
    description: string,
    decimals: number,
    totalSupply: number
) {
    let URI: string = "";
    let imageUri = "";

    const RPC_ENDPOINT_MAIN =
        "https://mainnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";

    const RPC_ENDPOINT_DEV =
        "https://devnet.helius-rpc.com/?api-key=f95cc4fe-fe7c-4de8-abed-eaefe0771ba7";
    let connection = new Connection(RPC_ENDPOINT_DEV);

    let keypair = Keypair.fromSecretKey(
        bs58.decode(
            // "3pTyHxqf4a3HZyK4QSaorRhHJsd1HqByDmVX592Bq66TTMPUDMtZSNpwM4aGMRx1ZPbCxywbnR33aLPtvnpQEP3D"
            "DD7evt2hCGZ9kV9do2zhubQkSqTizB2bBuL5YLR3oZJ8nQsUqEJyASjUqnjj2x5RXexP6k3PR8E2UBRovsDVESt"
        )
    );
    let walletAdapter = new MyWalletAdapter(
        // "3pTyHxqf4a3HZyK4QSaorRhHJsd1HqByDmVX592Bq66TTMPUDMtZSNpwM4aGMRx1ZPbCxywbnR33aLPtvnpQEP3D"
        "DD7evt2hCGZ9kV9do2zhubQkSqTizB2bBuL5YLR3oZJ8nQsUqEJyASjUqnjj2x5RXexP6k3PR8E2UBRovsDVESt"
    );

    const umi = createUmi(connection);
    const mint = generateSigner(umi);

    // 修复 upload
    const imgBuffer = fs.readFileSync("./src/spl_token_create/ROSE.png");

    const pinata = new PinataSDK({
        pinataJwt: NEXT_PUBLIC_PINATA_JWT,
        pinataGatewayKey: NEXT_PUBLIC_PINATE_GATEWAY_KEY,
        pinataGateway: NEXT_PUBLIC_PINATE_GATEWAY,
    });

    const upload = await pinata.upload.file(new File([imgBuffer], "ROSE.png"));
    console.log("upload ", upload);

    if (upload.IpfsHash) {
        imageUri =
            "https://gateway.pinata.cloud/ipfs/" + upload.IpfsHash.toString();

        const metadata = await pinata.upload.json(
            {
                name: tokenName,
                symbol: symbol,
                description: description,
                image: imageUri,
            },
            {
                metadata: {
                    name: tokenName,
                },
                pinType: "sync",
            }
        );

        if (metadata) {
            URI =
                "https://gateway.pinata.cloud/ipfs/" +
                metadata.IpfsHash.toString();
            console.log("URI:", URI);
        }
    }

    if (URI != "") {
        const ixs = [];

        // 丢弃增发权
        umi.use(mplTokenMetadata()).use(walletAdapterIdentity(walletAdapter));
        ixs.push(
            setAuthority(umi, {
                authorityType: AuthorityType.MintTokens,
                newAuthority: null,
                owned: mint.publicKey,
                owner: umi.identity,
            })
        );

        // 丢弃黑名单权限
        ixs.push(
            setAuthority(umi, {
                authorityType: AuthorityType.FreezeAccount,
                newAuthority: null,
                owned: mint.publicKey,
                owner: umi.identity,
            })
        );

        const tx = await createAndMint(umi, {
            mint,
            name: tokenName,
            symbol: symbol,
            uri: URI,
            sellerFeeBasisPoints: percentAmount(0),
            decimals: decimals,
            amount: totalSupply * 10 ** decimals,
            tokenOwner: publicKey(keypair.publicKey.toBase58()),
            tokenStandard: TokenStandard.Fungible,
        })
            .add(ixs)
            .sendAndConfirm(umi, {
                confirm: { commitment: "confirmed" },
            });

        const signature = base58.deserialize(tx.signature)[0];
        console.log(signature.toString());
    }
}

(async () => {
    await createSplToken(
        "ROSE1220",
        "ROSE1220",
        "ROSE is a sexy woman.",
        6,
        10_0000_0000
    );
})();
