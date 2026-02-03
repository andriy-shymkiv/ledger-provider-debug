import { useEffect } from "react";
import { WalletProviders } from "./WalletProviders";

export default function App() {
  useEffect(() => {
    // Dynamic import is required because the library uses browser APIs
    // and won't work with Server-Side Rendering (SSR)
    const initializeProvider = async () => {
      await import("@ledgerhq/ledger-wallet-provider/styles.css"); // Import styles dynamically
      const { initializeLedgerProvider } =
        await import("@ledgerhq/ledger-wallet-provider");

      const cleanup = initializeLedgerProvider({
        devConfig: {
          stub: {
            base: false, // Set to true for development
            account: false, // Enable account stubbing
            device: false, // Enable device stubbing
            web3Provider: false, // Enable Web3 provider stubbing
            dAppConfig: false, // Enable dApp config stubbing
          },
        },
        dAppIdentifier: "velora",
        loggerLevel: "info", // Log level configuration
        dmkConfig: undefined, // Device Management Kit config (optional)
      });

      return cleanup;
    };

    let cleanup: (() => void) | undefined;

    initializeProvider().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  return <WalletProviders />;
}
