import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--background, #fff)',
          color: 'var(--foreground, #000)',
          border: '1px solid var(--border, #e5e7eb)',
        },
      }}
    />
  );
}
