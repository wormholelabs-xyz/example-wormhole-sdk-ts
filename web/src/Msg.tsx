import { MetaMaskSDK, SDKProvider } from "@metamask/sdk";
import {
    Chain,
    PlatformToChains,
    SignAndSendSigner,
    Signer,
    VAA,
    Wormhole,
    WormholeMessageId,
    chainToPlatform,
    encoding,
    signSendWait,
    wormhole
} from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";

import { useEffect, useState } from "react";

import "./App.css";
import { NETWORK } from "./consts.js";
import { MetaMaskSigner } from "./wallets/metamask.ts";
import { PhantomProvider, PhantomSigner } from "./wallets/phantom.ts";

const msk = new MetaMaskSDK();

function Msg() {
  const [evmProvider, setEvmProvider] = useState<SDKProvider | null>(null);
  const [evmSigner, setEvmSigner] = useState<SignAndSendSigner<
    typeof NETWORK,
    PlatformToChains<"Evm">
  > | null>(null);

  const [phantomProvider, setPhantomProvider] =
    useState<PhantomProvider | null>(null);
  const [solSigner, setSolSigner] = useState<SignAndSendSigner<
    typeof NETWORK,
    PlatformToChains<"Solana">
  > | null>(null);


  // TODO: hardcoded for now, later allow selection of chains
  const [chain] = useState<"Solana">("Solana");
  // The message to send
  const [message, setMessage] = useState<string>("Lol");
  // Set once the transfer is started
  const [srcTxIds, setSrcTxIds] = useState<string[]>([]);
  // The unsigned VAA generated
  const [publishedMessage, setPublishedMessage] = useState<VAA<"Uint8Array">>();
  // The signed VAA after finality is reached
  const [signedMessage, setSignedMessage] = useState<VAA<"Uint8Array">>();

  const [wh, setWormhole] = useState<Wormhole<typeof NETWORK> | null>(null);

  useEffect(() => {
    if (!wh) wormhole(NETWORK, [evm, solana]).then(setWormhole);
  });

  // Effect for phantom/solana
  useEffect(() => {
    if (phantomProvider || !("phantom" in window) || !wh) return;
    (async function () {
      // @ts-ignore
      const provider = window.phantom!.solana as PhantomProvider;
      if (!provider?.isPhantom) return;

      await provider.connect();
      await PhantomSigner.fromProvider(wh!, provider).then((signer) => {
        setSolSigner(signer);
      });
      setPhantomProvider(provider);
    })().catch((e) => {
      console.error(e);
    });
  }, [phantomProvider, wh]);

  // Effect for metamask/evm
  useEffect(() => {
    if (evmProvider) return;
    (async function () {
      await msk.connect();
      const provider = msk.getProvider();
      await MetaMaskSigner.fromProvider(provider).then((signer) => {
        setEvmSigner(signer);
      });
      setEvmProvider(provider);
    })().catch((e) => {
      console.error(e);
    });
  }, [evmProvider, wh]);

  function getSigner<C extends Chain>(chain: C): Signer<typeof NETWORK, C> {
    let s: Signer<typeof NETWORK, C> | null = null;
    switch (chainToPlatform(chain)) {
      case "Evm":
        // TODO: actually check that the chain matches the one passed
        // @ts-ignore
        s = evmSigner;
        (s as MetaMaskSigner<any>).requestChainChange(chain);
        break;
      case "Solana":
        // @ts-ignore
        s = solSigner;
        break;
      default:
        throw new Error("No signer for: " + chain);
    }

    return s!;
  }

  async function start(): Promise<void> {
    if (!wh) throw new Error("No wormhole");

    const signer = getSigner(chain);
    if (!signer) throw new Error("No signer");

    const chainCtx = wh.getChain(signer.chain());
    const snd = Wormhole.chainAddress(signer.chain(), signer.address());
    const core = await chainCtx.getWormholeCore();

    // Publish the message
    const pubTxs = core.publishMessage(snd.address, message, 0, 0);
    const txids = await signSendWait(chainCtx, pubTxs, signer);
    setSrcTxIds(txids.map((tx) => tx.txid));

    // Get the published message as an unsigned VAA
    const [published] = await core.parseMessages(txids[txids.length - 1].txid);
    setPublishedMessage(published);

    pollForSigned(published)
  }

  async function pollForSigned(published: VAA<"Uint8Array">): Promise<void> {
    const msg: WormholeMessageId = {
      chain: published.emitterChain,
      emitter: published.emitterAddress,
      sequence: published.sequence,
    };
    try {
      // TODO: Get timeout from conf
      const vaa = await wh!.getVaa(msg, "Uint8Array", 60_000);
      if (vaa) setSignedMessage(vaa);
    } catch (e) {
      console.error(e);
    }
  }


  return (
    <>
      <div className="message">
        <textarea
          id="message"
          onChange={(e) => { setMessage(e.target.value); }}
        ></textarea>
        <button onClick={start} disabled={srcTxIds.length > 0}> Publish Message </button>
        <div className="status">
            <div className="txId">
                {srcTxIds.length > 0 ? (
                    <p> Transaction ID:{" "} <a href={
                        "https://wormholescan.io/#/tx/" + srcTxIds[srcTxIds.length - 1] + "?network=" + NETWORK
                    }> {srcTxIds[srcTxIds.length - 1]} </a> </p>
                ) : null}
            </div>
            <div className="unsignedVaa">
                <h5>Unsigned VAA</h5>
                {publishedMessage ? <Message message={publishedMessage} /> : null}
            </div>
            <div className="signedVaa">
                <h5>Signed VAA</h5>
                {signedMessage ? <Message message={signedMessage} /> : null}
            </div>
        </div>
      </div>
    </>
  );
}

function Message({ message }: { message: VAA<"Uint8Array"> }) {
  return (
    <div>
      <p>Chain: {message.emitterChain} </p>
      <p>Emitter: {message.emitterAddress.toString()} </p>
      <p>Sequence: {message.sequence.toString()} </p>
      <p>Message: {encoding.bytes.decode(message.payload)} ({encoding.hex.encode(message.payload, true)})</p>
    </div>
  );
}

export default Msg;
