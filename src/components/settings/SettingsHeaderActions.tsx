import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

const SettingsHeaderActionsContext = createContext<HTMLElement | null | undefined>(undefined);

export const SettingsHeaderActionsProvider = SettingsHeaderActionsContext.Provider;

export const SettingsHeaderActionPortal: React.FC<React.PropsWithChildren> = ({ children }) => {
  const target = useContext(SettingsHeaderActionsContext);
  if (target === undefined) return <>{children}</>;
  return target ? createPortal(children, target) : null;
};
