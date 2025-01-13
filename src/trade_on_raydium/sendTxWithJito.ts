import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { Connection, SendOptions } from "@solana/web3.js";
import { web3 } from "@project-serum/anchor";
/**
 * Send a transaction using Jito. This only supports sending a single transaction on mainnet only.
 * See https://jito-labs.gitbook.io/mev/searcher-resources/json-rpc-api-reference/transactions-endpoint/sendtransaction.
 * @param args.serialisedTx - A single transaction to be sent, in serialised form
 * @param args.region - The region of the Jito endpoint to use
 */
export async function sendTxUsingJito(
    versionedTx: web3.VersionedTransaction | web3.Transaction
) {
    let rpcEndpoint =
        "https://mainnet.block-engine.jito.wtf/api/v1/transactions";

    const serializedTx = versionedTx.serialize();
    let encodedTx = bs58.encode(serializedTx);
    let payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [encodedTx],
    };
    let res = await fetch(`${rpcEndpoint}?bundleOnly=true`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
    });
    let json = await res.json();
    if (json.error) {
        throw new Error(json.error.message);
    }
    return json;
}
