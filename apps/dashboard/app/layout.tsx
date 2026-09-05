import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider, themeBootstrapScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Mosquée Fitya — Administration",
  description: "Back-office de la Mosquée Fitya (Petro Ivoire, Abobo)",
  // L'emblème complet est illisible à 32 px : le favicon est cadré sur le
  // bâtiment, qui reste identifiable par sa silhouette et ses couleurs.
  icons: { icon: "/favicon.ico" },
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
