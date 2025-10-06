import React from 'react';
import { 
  Button, 
  Box, 
  Typography, 
  Chip, 
  Tooltip, 
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { 
  AccountBalanceWallet as WalletIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  MoreVert as MoreIcon,
  Settings as SettingsIcon,
  ExitToApp as DisconnectIcon
} from '@mui/icons-material';
import { useWallet } from '../context/WalletContext';
import WalletManager from './WalletManager';

function WalletButton() {
  const {
    account,
    isConnected,
    isConnecting,
    isCorrectNetwork,
    error,
    isMetaMaskInstalled,
    connectWallet,
    disconnectWallet,
    switchToHardhatNetwork
  } = useWallet();

  const [showError, setShowError] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [showWalletManager, setShowWalletManager] = React.useState(false);

  React.useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  const handleCloseError = () => {
    setShowError(false);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleOpenWalletManager = () => {
    setShowWalletManager(true);
    handleMenuClose();
  };

  const handleCloseWalletManager = () => {
    setShowWalletManager(false);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    handleMenuClose();
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getNetworkStatus = () => {
    if (!isConnected) return null;
    
    if (isCorrectNetwork) {
      return (
        <Chip 
          size="small" 
          icon={<CheckIcon />} 
          label="Hardhat" 
          color="success"
          variant="outlined"
        />
      );
    } else {
      return (
        <Tooltip title="Clique para trocar para rede Hardhat">
          <Chip 
            size="small" 
            icon={<WarningIcon />} 
            label="Rede Incorreta" 
            color="warning"
            variant="outlined"
            onClick={switchToHardhatNetwork}
            clickable
          />
        </Tooltip>
      );
    }
  };

  if (!isMetaMaskInstalled) {
    return (
      <Tooltip title="MetaMask não instalado">
        <Button
          variant="outlined"
          startIcon={<ErrorIcon />}
          color="error"
          disabled
          sx={{ textTransform: 'none' }}
        >
          MetaMask
        </Button>
      </Tooltip>
    );
  }

  if (isConnecting) {
    return (
      <Button
        variant="outlined"
        startIcon={<CircularProgress size={16} />}
        disabled
        sx={{ textTransform: 'none' }}
      >
        Conectando...
      </Button>
    );
  }

  if (isConnected && account) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Box display="flex" flexDirection="column" alignItems="flex-end">
          <Typography variant="caption" color="textSecondary">
            {formatAddress(account)}
          </Typography>
          {getNetworkStatus()}
        </Box>
        
        <Button
          variant="outlined"
          startIcon={<WalletIcon />}
          color="success"
          sx={{ 
            textTransform: 'none',
            minWidth: 'auto',
            px: 2
          }}
        >
          Conectado
        </Button>

        <Tooltip title="Opções da carteira">
          <IconButton
            onClick={handleMenuOpen}
            size="small"
            color="primary"
          >
            <MoreIcon />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleOpenWalletManager}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Gerenciar Conta</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleDisconnect}>
            <ListItemIcon>
              <DisconnectIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Desconectar</ListItemText>
          </MenuItem>
        </Menu>

        <WalletManager 
          open={showWalletManager} 
          onClose={handleCloseWalletManager}
        />
        
        <Snackbar
          open={showError}
          autoHideDuration={6000}
          onClose={handleCloseError}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  return (
    <>
      <Tooltip title="Conectar carteira MetaMask">
        <Button
          variant="outlined"
          startIcon={<WalletIcon />}
          onClick={connectWallet}
          sx={{ 
            textTransform: 'none',
            borderColor: 'primary.main',
            '&:hover': {
              borderColor: 'primary.dark',
              backgroundColor: 'primary.light'
            }
          }}
        >
          Conectar
        </Button>
      </Tooltip>
      
      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}

export default WalletButton;
