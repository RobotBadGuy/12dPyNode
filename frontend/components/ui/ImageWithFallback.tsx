'use client';

import React, { useState } from 'react';

interface ImageWithFallbackProps {
    src: string;
    alt: string;
    className?: string;
}

export function ImageWithFallback({ src, alt, className }: ImageWithFallbackProps) {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        // Render initials-based fallback
        const initials = alt
            .split(' ')
            .map((word) => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        return (
            <div
                className={`flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-2xl ${className || ''}`}
            >
                {initials || '?'}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setHasError(true)}
        />
    );
}
