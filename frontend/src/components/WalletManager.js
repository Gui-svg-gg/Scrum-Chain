import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import { 
  AccountBalanceWallet as WalletIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useWallet } from '../context/WalletContext';

function WalletManager({ open, onClose }) {
  const {
    account,
    isConnected,
    isCorrectNetwork,
    connectWallet,
    linkWalletToUser,
    unlinkWalletFromUser,
    getWalletStatus
  } = useWallet();

  const [loading, setLoading] = useState(false);
  const [walletStatus, setWalletStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (open) {
      loadWalletStatus();
    }
  }, [open]);

  const loadWalletStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await getWalletStatus();
      setWalletStatus(status);
    } catch (error) {
      console.error('Erro ao carregar status da Conta:', error);
      setError('Erro ao carregar status da Conta');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkWallet = async () => {
    if (!isConnected) {
      try {
        await connectWallet();
      } catch (error) {
        setError('Erro ao conectar Conta');
        return;
      }
    }

    if (!isCorrectNetwork) {
      setError('Troque para a rede Hardhat no MetaMask');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await linkWalletToUser();
      setSuccess('Conta vinculada com sucesso!');
      await loadWalletStatus();
    } catch (error) {
      console.error('Erro ao vincular Conta:', error);
      setError(error.message || 'Erro ao vincular Conta');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await unlinkWalletFromUser();
      setSuccess('Conta desvinculada com sucesso!');
      await loadWalletStatus();
    } catch (error) {
      console.error('Erro ao desvincular Conta:', error);
      setError(error.message || 'Erro ao desvincular Conta');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

  const renderWalletStatus = () => {
    if (loading && !walletStatus) {
      return (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      );
    }

    if (!walletStatus) {
      return (
        <Alert severity="info">
          Erro ao carregar informações da Conta
        </Alert>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <WalletIcon />
          Status da Conta
        </Typography>

        <Box mb={2}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Status de Vinculação:
          </Typography>
          {walletStatus.hasWallet ? (
            <Chip 
              icon={<CheckIcon />} 
              label="Conta Vinculada" 
              color="success" 
              variant="outlined"
            />
          ) : (
            <Chip 
              icon={<WarningIcon />} 
              label="Nenhuma Conta Vinculada" 
              color="warning" 
              variant="outlined"
            />
          )}
        </Box>

        {walletStatus.hasWallet && walletStatus.walletAddress && (
          <Box mb={2}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Endereço Vinculado:
            </Typography>
            <Typography variant="body1" fontFamily="monospace">
              {formatAddress(walletStatus.walletAddress)}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="textSecondary" gutterBottom>
          Conta MetaMask Atual:
        </Typography>
        {isConnected && account ? (
          <Box>
            <Typography variant="body1" fontFamily="monospace" gutterBottom>
              {formatAddress(account)}
            </Typography>
            {isCorrectNetwork ? (
              <Chip 
                icon={<CheckIcon />} 
                label="Rede Hardhat" 
                color="success" 
                size="small"
              />
            ) : (
              <Chip 
                icon={<WarningIcon />} 
                label="Rede Incorreta" 
                color="warning" 
                size="small"
              />
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            Nenhuma Conta conectada
          </Typography>
        )}
      </Box>
    );
  };

  const canLinkWallet = () => {
    return !walletStatus?.hasWallet && isConnected && isCorrectNetwork;
  };

  const canUnlinkWallet = () => {
    return walletStatus?.hasWallet;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Gerenciar Conta
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {renderWalletStatus()}

        {!walletStatus?.hasWallet && (
          <Box mt={3}>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Como funciona:</strong><br />
                • Conecte sua Conta MetaMask<br />
                • Vincule-a à seu usuário<br />
                • A Conta ficará exclusiva para você<br />
                • Necessário para operações blockchain
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Fechar
        </Button>
        
        {canUnlinkWallet() && (
          <Button
            onClick={handleUnlinkWallet}
            startIcon={loading ? <CircularProgress size={16} /> : <UnlinkIcon />}
            disabled={loading}
            color="warning"
            variant="outlined"
          >
            Desvincular
          </Button>
        )}
        
        {canLinkWallet() && (
          <Button
            onClick={handleLinkWallet}
            startIcon={loading ? <CircularProgress size={16} /> : <LinkIcon />}
            disabled={loading}
            color="primary"
            variant="contained"
          >
            Vincular Conta
          </Button>
        )}

        {!isConnected && (
          <Button
            onClick={connectWallet}
            startIcon={<WalletIcon />}
            color="primary"
            variant="contained"
          >
            Conectar MetaMask
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default WalletManager;
