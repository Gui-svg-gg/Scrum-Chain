import React, { useState } from 'react';
import {
  Container, Typography, Box, Paper, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Divider
} from '@mui/material';
import { useApp } from '../context/AppContext';
import { testConnection, resetEntireDatabase } from '../database/db-postgres';

function DbAdminPage() {
  const { currentTeam, logoutComplete } = useApp();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({ success: false, message: '' });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const connectionResult = await testConnection();
      setResult(connectionResult);
    } catch (error) {
      setResult({
        success: false,
        message: "Erro no teste de conexão: " + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResetDialog = () => {
    setConfirmDialogOpen(true);
  };

  const handleCloseResetDialog = () => {
    setConfirmDialogOpen(false);
  };

  const executeReset = async () => {
    setLoading(true);
    try {

      logoutComplete();


      const resetResult = await resetEntireDatabase();
      setResult(resetResult);


      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

    } catch (error) {
      setResult({
        success: false,
        message: "Erro ao redefinir banco de dados: " + error.message
      });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Administração do Banco de Dados
      </Typography>

      {result.message && (
        <Alert
          severity={result.success ? "success" : "error"}
          sx={{ mb: 2 }}
          onClose={() => setResult({ success: false, message: '' })}
        >
          {result.message}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Operações do Banco de Dados
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" flexDirection="column" gap={3}>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Redefinir Banco de Dados Completo
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              ATENÇÃO: Esta ação irá remover TODOS os dados do sistema, incluindo usuários, equipes
              e sprints. Todas as contas serão desconectadas.
              Esta operação não pode ser desfeita.
            </Typography>
            <Button
              variant="contained"
              color="error"
              onClick={handleOpenResetDialog}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : "Redefinir Banco de Dados Completamente"}
            </Button>
          </Box>

          <Divider sx={{ my: 1 }} />

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Testar Conexão
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Verifica se a conexão com o banco de dados está funcionando corretamente.
            </Typography>
            <Button
              variant="outlined"
              color="info"
              onClick={handleTestConnection}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : "Testar Conexão com o Banco"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCloseResetDialog}
      >
        <DialogTitle>
          Redefinir banco de dados completamente?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta ação irá remover TODOS os dados do sistema, incluindo todas as contas de usuários.
            Após esta operação, o sistema estará como recém-instalado e você será redirecionado
            para a página inicial.
            <br /><br />
            <strong>Esta operação não pode ser desfeita!</strong>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResetDialog}>Cancelar</Button>
          <Button
            onClick={executeReset}
            variant="contained"
            color="error"
            autoFocus
          >
            Confirmar Redefinição Completa
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default DbAdminPage;
