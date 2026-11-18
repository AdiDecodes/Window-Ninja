import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './popup.css';
import App from './App';
import { wnTheme } from '../../utils/theme';

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={wnTheme} forceColorScheme="dark">
    <App />
  </MantineProvider>,
);
