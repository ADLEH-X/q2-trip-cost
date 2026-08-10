import React from 'react';

export default function AudiLogo({ className = "w-12 h-4" }: { className?: string }) {
  // Audi rings SVG
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 35" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="17.5" cy="17.5" r="14.5" stroke="currentColor" strokeWidth="4" />
      <circle cx="39.5" cy="17.5" r="14.5" stroke="currentColor" strokeWidth="4" />
      <circle cx="61.5" cy="17.5" r="14.5" stroke="currentColor" strokeWidth="4" />
      <circle cx="83.5" cy="17.5" r="14.5" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}
