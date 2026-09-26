import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { InstallPrompt } from '@/components/install-prompt';

export const metadata: Metadata = {
  title: 'Campus Management System',
  description: 'A student-teacher interaction application.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Campus Management System',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme_preset') || 'default';
                  var html = document.documentElement;
                  html.classList.remove('dark', 'theme-white', 'theme-simple-dark', 'theme-glass-dark');
                  if (theme === 'theme-simple-dark') {
                    html.classList.add('dark', 'theme-simple-dark');
                  } else if (theme === 'theme-glass-dark') {
                    html.classList.add('dark', 'theme-glass-dark');
                  } else if (theme === 'theme-white') {
                    html.classList.add('theme-white');
                  } else {
                    html.classList.add('theme-default');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster />
            <InstallPrompt />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
