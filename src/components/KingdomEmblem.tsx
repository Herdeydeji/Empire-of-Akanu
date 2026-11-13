import React from 'react';
import { KingdomId, ResourceAmounts } from '../types/game';

interface EmblemProps {
  kingdomId: KingdomId;
  size?: number;
  className?: string;
}

export const KingdomEmblem: React.FC<EmblemProps> = ({
  kingdomId,
  size = 44,
  className = '',
}) => {
  switch (kingdomId) {
    case 'oru':
      // Oru: Bronze Bastion Shield & Crossed Infantry Spears
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className={className}
        >
          <circle cx="24" cy="24" r="21" fill="#261610" stroke="#e0a94f" strokeWidth="1.8" />
          <path d="M11 37L37 11M11 11L37 37" stroke="#cd8c3c" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M35 9L39 9L39 13Z" fill="#f5cf7a" />
          <path d="M13 9L9 9L9 13Z" fill="#f5cf7a" />
          <ellipse cx="24" cy="24" rx="10" ry="13.5" fill="#b84a27" stroke="#f2c46d" strokeWidth="2" />
          <path d="M24 13V35M17 24H31" stroke="#f2c46d" strokeWidth="1.6" />
          <circle cx="24" cy="24" r="3.2" fill="#f5cf7a" />
        </svg>
      );

    case 'zambara':
      // Zambara: Golden Horizon Sun-Crescent & Cavalry Lance Pennant
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className={className}
        >
          <circle cx="24" cy="24" r="21" fill="#24150e" stroke="#f4cf72" strokeWidth="1.8" />
          <path
            d="M13 31C13 21.5 20 14 29 14C24.5 16.5 22 21.2 22 26.5C22 31.5 25 35.2 29.5 37C19.8 37.5 13 35.5 13 31Z"
            fill="#d99b26"
            stroke="#ffe394"
            strokeWidth="1.4"
          />
          <path d="M26 11V37" stroke="#ffe394" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M26 13L38 17.5L26 22V13Z" fill="#b83b28" stroke="#f4cf72" strokeWidth="1.3" />
          <circle cx="26" cy="10.5" r="2.2" fill="#ffe394" />
        </svg>
      );

    case 'kemetra':
      // Kemetra: Monumental Stepped Pyramidion, Plumb-Compass & Solar Disc
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className={className}
        >
          <circle cx="24" cy="24" r="21" fill="#13202c" stroke="#e6b84c" strokeWidth="1.8" />
          <circle cx="24" cy="14" r="4.2" fill="#f5cb5c" />
          <path
            d="M11 35H37L31 21H17L11 35Z"
            fill="#27689b"
            stroke="#e6b84c"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M14.5 29H33.5M19 21L24 35L29 21" stroke="#f5cb5c" strokeWidth="1.4" />
        </svg>
      );

    case 'aseka':
      // Aseka: Royal Goldweight Scales & Woven Geometric Star
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className={className}
        >
          <circle cx="24" cy="24" r="21" fill="#11241c" stroke="#f0be43" strokeWidth="1.8" />
          <rect
            x="17"
            y="17"
            width="14"
            height="14"
            transform="rotate(45 24 24)"
            fill="#1f7a55"
            stroke="#f0be43"
            strokeWidth="1.8"
          />
          <path d="M12 21H36M24 12V36" stroke="#ffe082" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 26L13.5 21L17 26H10Z" fill="#f0be43" />
          <path d="M31 26L34.5 21L38 26H31Z" fill="#f0be43" />
          <circle cx="24" cy="24" r="3" fill="#ffe082" />
        </svg>
      );

    case 'nambara':
      // Nambara: Woodland Recurve Bow, Ironwood Arrow & Canopy Leaf
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className={className}
        >
          <circle cx="24" cy="24" r="21" fill="#162214" stroke="#d99343" strokeWidth="1.8" />
          <path
            d="M17 11C29 14 29 34 17 37"
            stroke="#d99343"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="M17 11V37" stroke="#e8cda2" strokeWidth="1.2" />
          <path d="M12 24H36" stroke="#f2c46d" strokeWidth="2" strokeLinecap="round" />
          <path d="M32 20.5L37.5 24L32 27.5L33.5 24L32 20.5Z" fill="#3f7d32" stroke="#f2c46d" strokeWidth="1.2" />
        </svg>
      );
  }
};

export const AkanuTitleLockup: React.FC = () => (
  <div className="flex flex-col items-start">
    <div className="flex items-center gap-3.5 mb-2">
      <svg
        width="54"
        height="54"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="32" cy="32" r="29" fill="#1c130c" stroke="#d9a441" strokeWidth="2.2" />
        <circle cx="32" cy="32" r="24" stroke="#8a6224" strokeWidth="1" strokeDasharray="4 3" />
        <path
          d="M32 10L37 22L49 18L41 29L52 35L39 38L42 50L32 42L22 50L25 38L12 35L23 29L15 18L27 22L32 10Z"
          fill="#b86b23"
          stroke="#f5ce73"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="32" r="7.5" fill="#1c130c" stroke="#f5ce73" strokeWidth="2" />
        <circle cx="32" cy="32" r="3.2" fill="#f5ce73" />
      </svg>
      <div>
        <p className="text-xs font-medium tracking-[0.22em] text-[#d9a84e]">
          Continent of Akanu
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-[#fbf3e4] leading-tight">
          Empires of Akanu
        </h1>
      </div>
    </div>
    <p className="font-display text-sm sm:text-base tracking-[0.26em] text-[#e2b55f] pl-0.5">
      Rise. Conquer. Rule.
    </p>
  </div>
);

export const ResourceIcon: React.FC<{
  type: keyof ResourceAmounts | 'population';
  size?: number;
}> = ({ type, size = 18 }) => {
  switch (type) {
    case 'food':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21V7" stroke="#e5b84b" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="9" cy="10" rx="2.5" ry="4" transform="rotate(-25 9 10)" fill="#dfad3a" stroke="#3b260c" strokeWidth="1" />
          <ellipse cx="15" cy="10" rx="2.5" ry="4" transform="rotate(25 15 10)" fill="#f2c963" stroke="#3b260c" strokeWidth="1" />
          <ellipse cx="12" cy="6" rx="2.2" ry="3.6" fill="#ffe082" stroke="#3b260c" strokeWidth="1" />
        </svg>
      );
    case 'wood':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 15L15 7L20 10L9 18L4 15Z" fill="#8f5830" stroke="#29160a" strokeWidth="1.3" />
          <circle cx="6.5" cy="16.5" r="2.8" fill="#cfa06d" stroke="#4a2a13" strokeWidth="1.3" />
        </svg>
      );
    case 'stone':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polygon points="4,17 8,8 16,7 20,15 14,19" fill="#9e998e" stroke="#2d2a26" strokeWidth="1.4" />
          <polyline points="8,8 12,13 20,15" stroke="#d4cfc5" strokeWidth="1.2" />
        </svg>
      );
    case 'iron':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polygon points="5,16 8,9 17,9 20,16" fill="#7c8b99" stroke="#232930" strokeWidth="1.4" />
          <polygon points="8,9 10,13 18,13 17,9" fill="#b0bec9" />
        </svg>
      );
    case 'gold':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polygon points="4,16 7,9 17,9 20,16" fill="#e6b02e" stroke="#422c06" strokeWidth="1.4" />
          <polygon points="7,9 9,12.5 18,12.5 17,9" fill="#ffe27a" />
        </svg>
      );
    case 'population':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9" cy="8" r="3" fill="#e5c391" stroke="#362312" strokeWidth="1.2" />
          <path d="M4 19C4 15.8 6.2 14 9 14C11.8 14 14 15.8 14 19" fill="#c98449" stroke="#362312" strokeWidth="1.2" />
          <circle cx="16" cy="9.5" r="2.4" fill="#d4ad79" stroke="#362312" strokeWidth="1.2" />
          <path d="M13.5 19C13.8 16.5 15.2 15.2 17.2 15.2C19 15.2 20.4 16.5 20.6 19" fill="#9c5e31" stroke="#362312" strokeWidth="1.2" />
        </svg>
      );
  }
};
