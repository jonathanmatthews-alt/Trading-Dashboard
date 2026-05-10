import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";

export const metadata: Metadata = {
  title: "TIM DASH 2026 — Trading Dashboard",
  description: "Personal trading dashboard. PA + Prop. Futures.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <TopBar />
            <main className="flex-1 overflow-x-hidden p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
