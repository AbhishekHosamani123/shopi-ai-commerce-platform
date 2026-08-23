'use client';

import React, { useState } from 'react';

interface StarsProps {
  stars?: number;
  value?: number;
  size?: number;
  color?: string;
  color2?: string;
  className?: string;
  edit?: boolean;
  onChange?: (rating: number) => void;
  count?: number;
}

const Stars: React.FC<StarsProps> = ({
  stars,
  value,
  size = 20,
  color = '#e5e7eb',
  color2 = '#ffa500',
  className = 'flex gap-1',
  edit = false,
  onChange,
  count = 5
}) => {
  const currentRating = typeof value === 'number' ? value : (typeof stars === 'number' ? stars : 0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const activeRating = hoverRating !== null ? hoverRating : currentRating;

  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {Array.from({ length: count }, (_, index) => {
        const starNumber = index + 1;
        const isFilled = starNumber <= activeRating;
        const isHalf = !isFilled && starNumber - 0.5 <= activeRating;

        return (
          <button
            key={starNumber}
            type={edit ? 'button' : undefined}
            disabled={!edit}
            onClick={() => {
              if (edit && onChange) {
                onChange(starNumber);
              }
            }}
            onMouseEnter={() => {
              if (edit) setHoverRating(starNumber);
            }}
            onMouseLeave={() => {
              if (edit) setHoverRating(null);
            }}
            className={`${edit ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} p-0 border-0 bg-transparent inline-flex items-center justify-center focus:outline-none`}
            aria-label={`${starNumber} stars`}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={isFilled ? color2 : isHalf ? `url(#half-grad-${size})` : color}
              stroke={isFilled || isHalf ? color2 : '#d1d5db'}
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <defs>
                <linearGradient id={`half-grad-${size}`}>
                  <stop offset="50%" stopColor={color2} />
                  <stop offset="50%" stopColor={color} />
                </linearGradient>
              </defs>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};

export default Stars;