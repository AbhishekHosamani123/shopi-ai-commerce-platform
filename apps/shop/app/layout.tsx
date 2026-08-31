import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { RenderWakeBeacon } from "@/components/RenderWakeBeacon";

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900']
});

export const metadata: Metadata = {
  title: "Shopi | AI-Powered Shopping Experience",
  description: "Shopi - Personal AI shopping assistant with intelligent product discovery, price comparisons, and seamless checkout.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta2/css/all.min.css" integrity="sha512-YWzhKL2whUzgiheMoBFwW8CKV4qpHQAEuvilg9FAn5VJUDwKZZxkJNuGM4XkWuk94WCrrwslk8yWNGmY1EduTA==" crossOrigin="anonymous" referrerPolicy="no-referrer"/>
      </head>
      <body className={poppins.className} suppressHydrationWarning>
        <ClientProviders>
        {/* Background Render wake-up beacon: pings the backend health endpoint on
            every page load so a sleeping Render service starts waking immediately. */}
        <RenderWakeBeacon />
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
