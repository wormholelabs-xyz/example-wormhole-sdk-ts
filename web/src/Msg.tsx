import { MetaMaskSDK, SDKProvider } from "@metamask/sdk";
import {
    Chain,
    ChainToPlatform,
    Network,
    PlatformToChains,
    SignAndSendSigner,
    Signer,
    Wormhole,
    WormholeMessageId,
    chainToPlatform,
    signSendWait,
    wormhole,
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
  // Set once the transfer is started
  const [srcTxIds, setSrcTxIds] = useState<string[]>([]);
  // Set once the transfer is attested
  const [attestations, setAttestations] = useState<WormholeMessageId[]>([]);
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

  function getSigner<C extends Chain>(
    chain: C
  ): Signer<typeof NETWORK, C> {
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
    console.log("Signer: ", signer);
    if (!signer) throw new Error("No signer");

    const chainCtx = wh.getChain(signer.chain());
    const snd = Wormhole.chainAddress(signer.chain(), signer.address());
    const core = await chainCtx.getWormholeCore();

    const xfer = core.publishMessage(snd.address, "Lol", 0, 0);

    // Start the transfer
    const txids = await signSendWait(chainCtx, xfer, signer);
    setSrcTxIds(txids.map((tx) => tx.txid));

    // Wait for attestation to be available
    const att = await core.parseTransaction(txids[txids.length - 1].txid);
    setAttestations(att as WormholeMessageId[]);
  }

  return (
    <>
      <div className="card">
        <textarea></textarea>
        <button onClick={start} disabled={srcTxIds.length > 0}>
          Start transfer
        </button>
      </div>
    </>
  );
}

export default Msg;
