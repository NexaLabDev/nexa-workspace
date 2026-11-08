/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Liga o agendador de avisos quando o servidor inicia (instrumentation.ts)
    instrumentationHook: true,
    // Biblioteca de push roda direto no Node, sem empacotar
    serverComponentsExternalPackages: ['web-push'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // O service worker precisa ser sempre a versão mais nova
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

module.exports = nextConfig;
