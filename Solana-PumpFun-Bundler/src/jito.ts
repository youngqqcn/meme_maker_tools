// Jito Bundling part

import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    VersionedTransaction,
} from "@solana/web3.js";

import base58 from "bs58";
import {
    SearcherClient,
    searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import { isError } from "jito-ts/dist/sdk/block-engine/utils";
import {
    BLOCKENGINE_URL,
    JITO_FEE,
    RPC_ENDPOINT,
    RPC_WEBSOCKET_ENDPOINT,
} from "./constants";
// const connection = new Connection(RPC_ENDPOINT, {
//     wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
// });

export async function build_send_bundle(
    connection: Connection,
    // bundleTransactionLimit: number,
    txs: VersionedTransaction[],
    keypair: Keypair
) {
    const search = searcherClient(BLOCKENGINE_URL);
    const accounts = await search.getTipAccounts();
    const _tipAccount =
        accounts[Math.min(Math.floor(Math.random() * accounts.length), 3)];
    const tipAccount = new PublicKey(_tipAccount);

    const bund = new Bundle([], 5);
    const resp = await connection.getLatestBlockhash();
    let ret = bund.addTransactions(...txs);
    if (isError(ret)) {
        console.log(ret);
        throw ret;
    }

    console.log("bund: ", bund);

    let maybeBundle = bund.addTipTx(
        keypair,
        Number(JITO_FEE),
        tipAccount,
        resp.blockhash
    );

    console.log(maybeBundle);
    if (isError(maybeBundle)) {
        console.log(maybeBundle);
        throw maybeBundle;
    }
    try {
        await search.sendBundle(maybeBundle);
    } catch (e) {
        console.log(e);
    }
    return maybeBundle;
}

// export const onBundleResult = (c: SearcherClient): Promise<number> => {
//     let first = 0;
//     let isResolved = false;

//     return new Promise((resolve) => {
//         // Set a timeout to reject the promise if no bundle is accepted within 5 seconds
//         setTimeout(() => {
//             resolve(first);
//             isResolved = true;
//         }, 30000);

//         c.onBundleResult(
//             (result: any) => {
//                 if (isResolved) return first;
//                 // clearTimeout(timeout) // Clear the timeout if a bundle is accepted
//                 const isAccepted = result.accepted;
//                 const isRejected = result.rejected;
//                 if (isResolved == false) {
//                     if (isAccepted) {
//                         // console.log(`bundle accepted, ID: ${result.bundleId}  | Slot: ${result.accepted!.slot}`)
//                         first += 1;
//                         isResolved = true;
//                         resolve(first); // Resolve with 'first' when a bundle is accepted
//                     }
//                     if (isRejected) {
//                         // Do not resolve or reject the promise here
//                     }
//                 }
//             },
//             (e: any) => {
//                 // Do not reject the promise here
//             }
//         );
//     });
// };

export const onBundleResult = (c: SearcherClient) => {
    c.onBundleResult(
        (result) => {
            console.log("received bundle result:", result);
        },
        (e) => {
            throw e;
        }
    );
};
