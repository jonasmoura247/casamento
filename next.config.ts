import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: ["*.ngrok-free.dev"],
  images: {
    // Fotos de presentes vêm de URLs que o casal cola livremente no /admin,
    // então precisa aceitar qualquer host https — o next/image proxeia a
    // imagem pelo próprio servidor, então o navegador nunca busca direto
    // no host externo (é isso que fecha o CSP img-src em 'self').
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
