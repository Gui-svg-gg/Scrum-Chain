import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { Warning as WarningIcon, Group as GroupIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const BlockchainSyncAlert = ({ show = false }) => {
  const navigate = useNavigate();

  if (!show) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Alert 
        severity="warning" 
        icon={<WarningIcon />}
        action={
          <Button 
            color="inherit" 
            size="small"
            variant="outlined"
            startIcon={<GroupIcon />}
            onClick={() => navigate('/team')}
            sx={{ ml: 2 }}
          >
            Ir para Equipe
          </Button>
        }
      >
        <AlertTitle>⚠️ Equipe não sincronizada com a blockchain</AlertTitle>
        <strong>Para usar todas as funcionalidades do sistema, você precisa sincronizar sua equipe com a blockchain primeiro.</strong>
        <br />
        Vá para a página "Gerenciamento de Equipe" e clique em sincronizar.
      </Alert>
    </Box>
  );
};

export default BlockchainSyncAlert;