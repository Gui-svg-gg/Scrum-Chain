import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  AccountBalanceWallet as WalletIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
  VpnKey as KeyIcon,
  LinkOff as UnlinkIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

function ContaPage() {
  const navigate = useNavigate();
  const { userWalletAddress, unlinkWalletFromUser, getWalletStatus } = useWallet();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [walletStatus, setWalletStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);


  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUnlinkWalletModal, setShowUnlinkWalletModal] = useState(false);


  const [editForm, setEditForm] = useState({
    full_name: '',
    email: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });


  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingUnlink, setLoadingUnlink] = useState(false);


  useEffect(() => {
    loadUserData();
    loadWalletStatus();
  }, []);


  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);


  const loadUserData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await fetch(`${getApiUrl()}/api/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        setUserData(result.data.user);
        setEditForm({
          full_name: result.data.user.full_name || '',
          email: result.data.user.email || ''
        });
      } else {
        setError('Erro ao carregar dados do usuário');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  };


  const loadWalletStatus = async () => {
    try {
      const status = await getWalletStatus();
      setWalletStatus(status);
    } catch (error) {
      setWalletStatus(null);
    }
  };


  const handleEditProfile = async () => {
    try {
      setLoadingEdit(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: editForm.full_name,
          email: editForm.email
        })
      });

      if (response.ok) {
        setSuccess('Perfil atualizado com sucesso!');
        setShowEditModal(false);
        await loadUserData();
      } else {
        const result = await response.json();
        setError(result.message || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      setError('Erro ao atualizar perfil');
    } finally {
      setLoadingEdit(false);
    }
  };


  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Todos os campos de senha são obrigatórios');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setLoadingPassword(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      if (response.ok) {
        setSuccess('Senha alterada com sucesso!');
        setShowPasswordModal(false);
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        const result = await response.json();
        setError(result.message || 'Erro ao alterar senha');
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      setError('Erro ao alterar senha');
    } finally {
      setLoadingPassword(false);
    }
  };


  const handleUnlinkWallet = async () => {
    try {
      setLoadingUnlink(true);
      setError(null);

      await unlinkWalletFromUser();
      setSuccess('Conta desvinculada com sucesso!');
      setShowUnlinkWalletModal(false);
      await loadWalletStatus();
    } catch (error) {
      console.error('Erro ao desvincular conta:', error);
      setError(error.message || 'Erro ao desvincular conta');
    } finally {
      setLoadingUnlink(false);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!userData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Erro ao carregar dados do usuário
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          <PersonIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Minha Conta
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Gerencie suas informações pessoais e configurações de segurança
        </Typography>
      </Box>

      {}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <PersonIcon />
              Informações Pessoais
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Nome Completo"
                  secondary={userData.full_name || 'Não informado'}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => setShowEditModal(true)}>
                    <EditIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>

              <Divider />

              <ListItem>
                <ListItemIcon>
                  <EmailIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Email"
                  secondary={userData.email || 'Não informado'}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => setShowEditModal(true)}>
                    <EditIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>

              <Divider />

              <ListItem>
                <ListItemIcon>
                  <ScheduleIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Membro desde"
                  secondary={formatDate(userData.created_at)}
                />
              </ListItem>
            </List>
          </Paper>

          {}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <SecurityIcon />
              Segurança
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <KeyIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Senha"
                  secondary="Altere sua senha regularmente para manter sua conta segura"
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowPasswordModal(true)}
                  >
                    Alterar Senha
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <WalletIcon />
                Conta Blockchain
              </Typography>

              {walletStatus?.hasWallet ? (
                <Box>
                  <Box mb={2}>
                    <Chip
                      icon={<CheckIcon />}
                      label="Conta Vinculada"
                      color="success"
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Endereço:
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace" gutterBottom>
                    {formatAddress(walletStatus.walletAddress)}
                  </Typography>

                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<UnlinkIcon />}
                      onClick={() => setShowUnlinkWalletModal(true)}
                      fullWidth
                      size="small"
                    >
                      Desvincular Conta
                    </Button>
                  </Box>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      Sua Conta está vinculada exclusivamente à sua usuário.
                      Ela será conectada automaticamente quando você fizer login.
                    </Typography>
                  </Alert>
                </Box>
              ) : (
                <Box>
                  <Box mb={2}>
                    <Chip
                      icon={<WarningIcon />}
                      label="Nenhuma conta"
                      color="warning"
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Você ainda não vinculou uma conta MetaMask à seu usuário.
                  </Typography>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      Conecte uma conta MetaMask para participar de operações blockchain
                      como criação de equipes e gerenciamento de membros.
                    </Typography>
                  </Alert>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {}
      <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Perfil</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              margin="normal"
              label="Nome Completo"
              fullWidth
              variant="outlined"
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
            />
            <TextField
              margin="normal"
              label="Email"
              type="email"
              fullWidth
              variant="outlined"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditModal(false)}>Cancelar</Button>
          <Button
            onClick={handleEditProfile}
            disabled={loadingEdit}
            variant="contained"
            startIcon={loadingEdit ? <CircularProgress size={16} /> : null}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog open={showPasswordModal} onClose={() => setShowPasswordModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Alterar Senha</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              margin="normal"
              label="Senha Atual"
              type="password"
              fullWidth
              variant="outlined"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
            <TextField
              margin="normal"
              label="Nova Senha"
              type="password"
              fullWidth
              variant="outlined"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
            <TextField
              margin="normal"
              label="Confirmar Nova Senha"
              type="password"
              fullWidth
              variant="outlined"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordModal(false)}>Cancelar</Button>
          <Button
            onClick={handleChangePassword}
            disabled={loadingPassword}
            variant="contained"
            startIcon={loadingPassword ? <CircularProgress size={16} /> : null}
          >
            Alterar Senha
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog open={showUnlinkWalletModal} onClose={() => setShowUnlinkWalletModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Desvincular Conta</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Atenção:</strong> Ao desvincular sua conta, você perderá o acesso automático
              às funcionalidades blockchain. Você precisará vincular uma nova conta ou a mesma novamente para continuar
              usando essas funcionalidades.
            </Typography>
          </Alert>

          <Typography variant="body2">
            Tem certeza que deseja desvincular a conta <strong>{formatAddress(walletStatus?.walletAddress)}</strong>
            da sua conta?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnlinkWalletModal(false)}>Cancelar</Button>
          <Button
            onClick={handleUnlinkWallet}
            disabled={loadingUnlink}
            variant="contained"
            color="warning"
            startIcon={loadingUnlink ? <CircularProgress size={16} /> : <UnlinkIcon />}
          >
            Desvincular
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ContaPage;