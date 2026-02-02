import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "MT Party Game",
    description: "술자리 인싸가 되는 길",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}