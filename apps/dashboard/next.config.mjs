import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Les packages du monorepo sont en TS brut : Next les transpile.
  transpilePackages: ["@fitia/design-tokens", "@fitia/shared", "@fitia/supabase"],

  // Image autonome pour Render : Next produit un serveur qui n'embarque QUE les
  // fichiers réellement utilisés. Sans ça, il faudrait copier tout `node_modules`
  // dans l'image — plusieurs centaines de Mo, intenable sur le plan gratuit.
  output: "standalone",

  // ⚠️ Indispensable en monorepo : par défaut Next trace les dépendances depuis
  // le dossier de l'app. Il manquerait alors `packages/*` et le `node_modules`
  // hoissé à la racine, et le serveur planterait au démarrage sur un module
  // introuvable. On remonte donc la racine de traçage au dépôt entier.
  outputFileTracingRoot: path.join(here, "../../"),
};

export default nextConfig;
