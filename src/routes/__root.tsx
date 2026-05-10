import { ClerkProvider } from '@clerk/tanstack-react-start';
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { I18nextProvider } from 'react-i18next';

import { AppNav } from '#/components/app-nav';
import { appI18n } from '#/i18n';
import { normalizeLanguage } from '#/i18n/resources';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Leland',
      },
      {
        name: 'description',
        content: 'Leland hairstylist cost tracking',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const language = normalizeLanguage(
    appI18n.resolvedLanguage ?? appI18n.language,
  );

  return (
    <html lang={language}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider>
          <I18nextProvider i18n={appI18n}>
            <div className="app-root min-h-dvh bg-background text-foreground">
              <AppNav />
              {children}
            </div>
          </I18nextProvider>
        </ClerkProvider>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
