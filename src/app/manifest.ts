import { MetadataRoute } from 'next';
import { YOLPAY_LOGO_BASE64 } from '@/assets/logo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YolPay™ - Akıllı Yolculuk & Yakıt Maliyeti',
    short_name: 'YolPay™',
    description: 'Trafiğe duyarlı gerçek yakıt tüketimi, canlı akaryakıt ve köprü/otoyol geçiş ücreti hesaplama.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: YOLPAY_LOGO_BASE64,
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: YOLPAY_LOGO_BASE64,
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: YOLPAY_LOGO_BASE64,
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  };
}
