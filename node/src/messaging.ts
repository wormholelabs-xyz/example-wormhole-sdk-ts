import {
  Wormhole,
  encoding,
  signSendWait,
  wormhole,
} from "@wormhole-foundation/sdk";
import solana from "@wormhole-foundation/sdk/solana";
import evm from "@wormhole-foundation/sdk/evm";
import algorand from "@wormhole-foundation/sdk/algorand";

import { getStuff } from "./helpers.js";

(async function () {
  const wh = await wormhole("Testnet", [solana, evm, algorand]);

  const chainCtx = wh.getChain("Algorand");
  const coreBridge = await chainCtx.getWormholeCore();

  // Get local signer and parse the address
  const {
    signer,
    address: { address },
  } = await getStuff(chainCtx);

  // prepare transactions to publish a message
  const msgTxs = coreBridge.publishMessage(
    address.toUniversalAddress(),
    encoding.bytes.encode("lol"),
    0, // nonce
    0 // consistency (0,1)
  );
  // submit post msg txs txs
  const [txid] = await signSendWait(chainCtx, msgTxs, signer);
  console.log("Origin txid: ", txid);

  const [whm] = await chainCtx.parseTransaction(txid.txid);
  // it is also possible to search by txid but takes longer to show up
  // e.g. await wh.getVaaByTxHash(txids[0].txid, "Uint8Array");
  const vaa = await wh.getVaa(whm, "Uint8Array");
  console.log(`VAA payload: '${encoding.bytes.decode(vaa!.payload!)}'`);

  // prepare transactions to verify the VAA
  const verifyTxs = coreBridge.verifyMessage(
    address.toUniversalAddress(),
    vaa!
  );
  // submit verify txs
  console.log(
    "Verify txids: ",
    await signSendWait(chainCtx, verifyTxs, signer)
  );
})();
