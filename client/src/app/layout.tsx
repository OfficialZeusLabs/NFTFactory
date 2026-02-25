"use client";
import AppLayout from "@/layout";
import WalletConnectProvider, { wagmiConfig } from "@/providers/walletconnect";
import store from "@/store";
import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { WagmiConfig } from "wagmi";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WagmiConfig config={wagmiConfig}>
          <WalletConnectProvider />
          <Provider store={store}>
            <AppLayout>{children}</AppLayout>
          </Provider>
          <ToastContainer />
        </WagmiConfig>
      </body>
    </html>
  );
}
