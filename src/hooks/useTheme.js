import { useContext } from 'react';
import { ThemeContext } from '../theme/theme';

export const useTheme = () => {
  return useContext(ThemeContext);
}; 