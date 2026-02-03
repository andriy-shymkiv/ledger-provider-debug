import { useEffect, useState, useSyncExternalStore } from "react";

// EthereumProviderTypes.d.ts

// Interface for provider information following EIP-6963.
interface EIP6963ProviderInfo {
  walletId: string; // Unique identifier for the wallet
  uuid: string; // Globally unique ID to differentiate between provider sessions for the lifetime of the page
  name: string; // Human-readable name of the wallet
  icon: string; // URL to the wallet's icon
}

// Interface for Ethereum providers based on the EIP-1193 standard.
interface EIP1193Provider {
  isStatus?: boolean; // Optional: Indicates the status of the provider
  host?: string; // Optional: Host URL of the Ethereum node
  path?: string; // Optional: Path to a specific endpoint or service on the host
  sendAsync?: (
    request: { method: string; params?: Array<unknown> },
    callback: (error: Error | null, response: unknown) => void,
  ) => void; // For sending asynchronous requests
  send?: (
    request: { method: string; params?: Array<unknown> },
    callback: (error: Error | null, response: unknown) => void,
  ) => void; // For sending synchronous requests
  request: (request: {
    method: string;
    params?: Array<unknown>;
  }) => Promise<unknown>; // Standard method for sending requests per EIP-1193
}

// Interface detailing the structure of provider information and its Ethereum provider.
interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo; // The provider's info
  provider: EIP1193Provider; // The EIP-1193 compatible provider
}

// Type representing the event structure for announcing a provider based on EIP-6963.
type EIP6963AnnounceProviderEvent = {
  detail: {
    info: EIP6963ProviderInfo; // The provider's info
    provider: EIP1193Provider; // The EIP-1193 compatible provider
  };
};

// store.tsx

declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<EIP6963AnnounceProviderEvent>;
  }
}

let providers: EIP6963ProviderDetail[] = [];

const store = {
  value: () => providers,

  subscribe: (callback: () => void) => {
    function onAnnouncement(event: EIP6963AnnounceProviderEvent) {
      // Prevent adding a provider if it already exists in the list based on its uuid.
      if (providers.some((p) => p.info.uuid === event.detail.info.uuid)) return;

      // Add the new provider to the list and call the provided callback function.
      providers = [...providers, event.detail];
      callback();
    }

    window.addEventListener(
      "eip6963:announceProvider",
      onAnnouncement as unknown as EventListener,
    );
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () =>
      window.removeEventListener(
        "eip6963:announceProvider",
        onAnnouncement as unknown as EventListener,
      );
  },
};

const useSyncProviders = () =>
  useSyncExternalStore(store.subscribe, store.value, store.value);

function produceTypedDataPayload(address: string) {
  return {
    method: "eth_signTypedData_v4",
    params: [
      address,
      JSON.stringify({
        types: {
          EIP712Domain: [
            {
              name: "name",
              type: "string",
            },
            {
              name: "version",
              type: "string",
            },
            {
              name: "chainId",
              type: "uint256",
            },
            {
              name: "verifyingContract",
              type: "address",
            },
          ],
          Person: [
            {
              name: "name",
              type: "string",
            },
            {
              name: "wallet",
              type: "address",
            },
          ],
          Mail: [
            {
              name: "from",
              type: "Person",
            },
            {
              name: "to",
              type: "Person",
            },
            {
              name: "contents",
              type: "string",
            },
          ],
        },
        primaryType: "Mail",
        domain: {
          name: "Ether Mail",
          version: "1",
          chainId: 1,
          verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
        },
        message: {
          from: {
            name: "Cow",
            wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
          },
          to: {
            name: "Bob",
            wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
          },
          contents: "Hello, Bob!",
        },
      }),
    ],
  };
}

export const WalletProviders = () => {
  const [selectedWallet, setSelectedWallet] = useState<
    EIP6963ProviderDetail | undefined
  >();
  const [userAccount, setUserAccount] = useState<string>("");
  const providers = useSyncProviders();

  const isConnected = !!selectedWallet && !!userAccount;

  const handleConnect = async (providerWithInfo: EIP6963ProviderDetail) => {
    const accounts = (await providerWithInfo.provider
      .request({ method: "eth_requestAccounts" })
      .catch(console.error)) as string[] | undefined;

    if (accounts && accounts[0]) {
      setSelectedWallet(providerWithInfo);
      setUserAccount(accounts[0]);
    }
  };

  useEffect(() => {
    if (!isConnected) return;
    // call eth_chainId and wallet_getCapabilities repetedly every 5 seconds
    const interval = setInterval(async () => {
      const chainId = await selectedWallet.provider.request({
        method: "eth_chainId",
      });
      const capabilities = await selectedWallet.provider.request({
        method: "wallet_getCapabilities",
        params: [userAccount],
      });
      console.log(
        "%c[Wallet Debug] Effect run:",
        "color: white; background: #0070f3; font-weight: bold; padding: 2px 6px; border-radius: 3px;",
        { chainId, capabilities },
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, selectedWallet?.provider, userAccount]);

  // @ts-expect-error debug purpose
  // eslint-disable-next-line react-hooks/immutability
  window.provider = selectedWallet?.provider;

  const signMessages = async () => {
    if (!isConnected) return;
    const signature1 = await selectedWallet.provider
      .request(produceTypedDataPayload(userAccount))
      .catch(console.error);

    const signature2 = await selectedWallet.provider
      .request(produceTypedDataPayload(userAccount))
      .catch(console.error);

    console.log(
      "%c[Wallet Debug] Signatures:",
      "color: white; background: #e67e22; font-weight: bold; padding: 2px 6px; border-radius: 3px;",
      {
        signature1,
        signature2,
        typeofSignature1: typeof signature1,
        typeofSignature2: typeof signature2,
      },
    );
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h2>Wallets Detected:</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {providers.length > 0 ? (
          providers.map((provider) => (
            <button
              key={provider.info.uuid}
              onClick={() => handleConnect(provider)}
            >
              <img
                src={provider.info.icon}
                alt={provider.info.name}
                width={24}
                height={24}
              />
              <div>{provider.info.name}</div>
            </button>
          ))
        ) : (
          <div>There are no announced providers.</div>
        )}
      </div>
      <hr />
      <div
        style={{
          display: "flex",
          gap: 24,
          paddingBottom: 24,
        }}
      >
        <h2>{isConnected ? "Wallet Selected" : "No Wallet Selected"}</h2>
        {isConnected && (
          <div>
            <img
              src={selectedWallet.info.icon}
              alt={selectedWallet.info.name}
              width={24}
              height={24}
            />
            <div>{selectedWallet.info.name}</div>
            <div>({userAccount})</div>
          </div>
        )}
      </div>
      {isConnected && <button onClick={signMessages}>Sign Messages</button>}
    </div>
  );
};
