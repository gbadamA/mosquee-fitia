import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider, themeBootstrapScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Mosquée Fitia — Administration",
  description: "Back-office de la Mosquée Fitia (Petro Ivoire, Abobo)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applique le thème AVANT le premier rendu : sans ça, un écran clair
            clignote une frame avant de passer en sombre. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen bg-light-bg text-light-text antialiased dark:bg-dark-bg dark:text-dark-text">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
