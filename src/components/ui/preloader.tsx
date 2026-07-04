'use client';

import Image from 'next/image';

interface PreloaderProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Preloader({ 
  message = 'Loading...', 
  fullScreen = false,
  size = 'md'
}: PreloaderProps) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    xl: 'w-64 h-64'
  };

  const containerClasses = fullScreen 
    ? 'fixed inset-0 flex items-center justify-center bg-white z-[9999]'
    : 'flex items-center justify-center';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className={`${sizeClasses[size]} mx-auto mb-4 relative`}>
          <Image
            src="/Writing in book.gif"
            alt="Loading..."
            width={size === 'sm' ? 64 : size === 'md' ? 128 : size === 'lg' ? 192 : 256}
            height={size === 'sm' ? 64 : size === 'md' ? 128 : size === 'lg' ? 192 : 256}
            className="w-full h-full object-contain"
            unoptimized
          />
        </div>
        {message && (
          <p className={`text-gray-600 ${size === 'xl' ? 'text-xl' : size === 'lg' ? 'text-lg' : size === 'md' ? 'text-base' : 'text-sm'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
