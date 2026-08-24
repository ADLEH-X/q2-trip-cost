'use client';

import React from 'react';
import { YOLPAY_LOGO_BASE64 } from '@/assets/logo';

interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 44, className = '' }: LogoProps) {
  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative rounded-2xl overflow-hidden border border-white/15 shadow-[0_0_20px_rgba(230,0,0,0.25)] flex items-center justify-center bg-black/80 shrink-0 ${className}`}
    >
      <img
        src={YOLPAY_LOGO_BASE64}
        alt="YolPay Logo"
        width={size}
        height={size}
        className="w-full h-full object-cover select-none pointer-events-none"
        loading="eager"
      />
    </div>
  );
}
