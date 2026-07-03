import React from 'react';
import { Toaster } from 'react-hot-toast';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-c-bg font-sans">
      <main className="flex-1 flex flex-col">{children}</main>
      <Toaster position="bottom-right" />
    </div>
  );
};
