import { Toast } from '@base-ui/react/toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
  });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Toast.Provider>
        {children}
        <Toast.Portal>
          <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 outline-none">
            <ToastList />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>
    </QueryClientProvider>
  );
}

function ToastList() {
  const manager = Toast.useToastManager();
  const { t } = useTranslation();

  return manager.toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="rounded-md border border-border bg-surface p-4 text-sm text-foreground shadow-lg"
    >
      <Toast.Title className="font-semibold" />
      <Toast.Description className="mt-1 text-muted-foreground" />
      <div className="mt-3 flex items-center gap-2">
        <Toast.Action className="rounded-md border border-border px-3 py-1 text-sm font-medium hover:bg-muted" />
        <Toast.Close
          aria-label={t('common.close')}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          {t('common.ok')}
        </Toast.Close>
      </div>
    </Toast.Root>
  ));
}
