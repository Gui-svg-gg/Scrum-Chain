import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#646464', 
      light: '#8c8c8c',
      dark: '#404040',
    },
    secondary: {
      main: '#9e9e9e', 
      light: '#cfcfcf',
      dark: '#707070',
    },
    error: {
      main: '#a36464', 
    },
    warning: {
      main: '#b39554', 
    },
    info: {
      main: '#6d8a9c', 
    },
    success: {
      main: '#5e8c71', 
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#585858', 
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: '#646464',
          '&:hover': {
            backgroundColor: '#4a4a4a',
          },
        },
      },
    },
  },
});

export default theme;