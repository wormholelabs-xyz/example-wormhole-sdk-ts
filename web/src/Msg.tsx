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
    wormhole
} from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";
import solana from "@wormhole-foundation/sdk/solana";

import { useEffect, useState } from "react";

import "./App.css";
import { NETWORK } from "./consts.js";
import { MetaMaskSigner } from "./metamask.ts";
import { PhantomProvider, PhantomSigner } from "./phantom.ts";

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
  const [chain] = useState<Chain>("Solana");
  // Set once the transfer is started
  const [srcTxIds, setSrcTxIds] = useState<string[]>([]);
  // Set once the transfer is attested
  const [attestations, setAttestations] = useState<WormholeMessageId[]>([]);
  // Set after completing transfer
  const [dstTxIds, setDstTxIds] = useState<string[]>([]);

  const [wh, setWormhole] = useState<Wormhole<Network> | null>(null);

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

  function getSigner<C extends Chain, P extends ChainToPlatform<C>>(chain: C): Signer<typeof NETWORK, C> {
    const platform: P = chainToPlatform(chain) as P

    let s: Signer<typeof NETWORK, C> | null = null;
    if(platform === "Evm"){
        // @ts-ignore
       s  = evmSigner;
      (s as MetaMaskSigner<any>).requestChainChange(chain)
    }else{
        // @ts-ignore
        s = solSigner
    }
    if(s) return s;


    throw new Error("No signer for: "+ chain)
  }


  async function start(): Promise<void> {
    if (!wh) throw new Error("No wormhole");

    const signer = getSigner(chain)
    if (!signer) throw new Error("No signer");


    // Create a transfer
    const chainCtx = wh.getChain(signer.chain());
    const snd = Wormhole.chainAddress(signer.chain(), signer.address());
    const core = await chainCtx.getWormholeCore();
    // @ts-ignore
    const xfer = core.publishMessage(snd, "Lol", 0, 0)

    // Start the transfer
    const txids = await signSendWait(chainCtx, xfer, signer);
    setSrcTxIds(txids.map((tx) => tx.txid));

    // Wait for attestation to be available
    const att = await core.parseTransaction(txids[txids.length-1].txid);
    setAttestations(att as WormholeMessageId[]);
  }

  //async function finish(): Promise<void> {
  //  if (!wh) throw new Error("No wormhole");
  //  if (!transfer) throw new Error("No Current transfer");

  //  const signer = dstChain === "Solana" ? solSigner : evmSigner;
  //  if (!signer) throw new Error("No signer");

  //  // Finish transfer with updated signer
  //  const finalTxs = await transfer.completeTransfer(signer);
  //  setDstTxIds(finalTxs);
  //}

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
