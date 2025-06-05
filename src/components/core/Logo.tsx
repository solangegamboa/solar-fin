import type { SVGProps } from 'react';

const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width="40"
    height="40"
    aria-label="Solar Fin Logo"
    {...props}
  >
    <defs>
      <radialGradient id="sunGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" style={{ stopColor: '#FFD700', stopOpacity: 1 }} /> {/* Gold */ }
        <stop offset="70%" style={{ stopColor: '#FFA500', stopOpacity: 1 }} /> {/* Orange */ }
        <stop offset="100%" style={{ stopColor: '#FF8C00', stopOpacity: 0.8 }} /> {/* DarkOrange */ }
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="30" fill="url(#sunGradient)" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
      <line
        key={angle}
        x1="50"
        y1="50"
        x2={50 + 38 * Math.cos((angle * Math.PI) / 180)}
        y2={50 + 38 * Math.sin((angle * Math.PI) / 180)}
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-yellow-400 dark:stroke-yellow-500"
      />
    ))}
  </svg>
);

export default Logo;
