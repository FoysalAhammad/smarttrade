import React, { createContext, useContext, useMemo } from 'react';

import { tokens, Tokens } from './tokens';

const ThemeContext = createContext<Tokens>(tokens);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo(() => tokens, []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Tokens => useContext(ThemeContext);
