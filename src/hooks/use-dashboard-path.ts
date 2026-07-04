'use client';

import { usePathname } from 'next/navigation';

export function useDashboardPath() {
  const pathname = usePathname();

  const getPath = (subpath: string) => {
    let prefix = '/admin-dashboard';
    if (pathname.startsWith('/clerk-dashboard')) {
      prefix = '/clerk-dashboard';
    } else if (pathname.startsWith('/college-admin-dashboard')) {
      prefix = '/college-admin-dashboard';
    } else if (pathname.startsWith('/asset-manager-dashboard')) {
      prefix = '/asset-manager-dashboard';
    }

    if (!subpath || subpath === '/') {
      return prefix;
    }

    const cleanSubpath = subpath.startsWith('/') ? subpath : `/${subpath}`;
    return `${prefix}${cleanSubpath}`;
  };

  const prefix = pathname.startsWith('/clerk-dashboard')
    ? '/clerk-dashboard'
    : pathname.startsWith('/college-admin-dashboard')
    ? '/college-admin-dashboard'
    : pathname.startsWith('/asset-manager-dashboard')
    ? '/asset-manager-dashboard'
    : '/admin-dashboard';

  return { getPath, prefix };
}
