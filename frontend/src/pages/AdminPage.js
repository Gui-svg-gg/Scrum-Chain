import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import axios from 'axios';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  Grid,
  Divider
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Assessment as StatsIcon,
  Refresh as RefreshIcon,
  DeleteSweep as DeleteAllIcon
} from '@mui/icons-material';

const AdminPage = () => {
  const [tables, setTables] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  
  const [deleteTableDialog, setDeleteTableDialog] = useState({ open: false, table: null });
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);

  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      const [tablesResponse, statsResponse] = await Promise.all([
        axios.get(`${getApiUrl()}/api/admin/tables`),
        axios.get(`${getApiUrl()}/api/admin/stats`)
      ]);

      if (tablesResponse.data.success) {
        setTables(tablesResponse.data.data.tables);
      }

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados do banco de dados');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async (tableName) => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      const response = await axios.delete(`${getApiUrl()}/api/admin/tables/${tableName}`);

      if (response.data.success) {
        setSuccess(`✅ Tabela '${tableName}' limpa com sucesso! ${response.data.data.records_deleted} registros excluídos.`);
        setDeleteTableDialog({ open: false, table: null });
        await loadData(); 
      }

    } catch (error) {
      console.error('Erro ao excluir tabela:', error);
      setError(error.response?.data?.message || 'Erro ao excluir dados da tabela');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      const response = await axios.delete(`${getApiUrl()}/api/admin/all`);

      if (response.data.success) {
        setSuccess(`🎉 BANCO COMPLETAMENTE LIMPO! ${response.data.data.total_records_deleted} registros excluídos.`);
        setDeleteAllDialog(false);
        await loadData(); 
      }

    } catch (error) {
      console.error('Erro ao limpar banco:', error);
      setError(error.response?.data?.message || 'Erro ao limpar banco de dados');
    } finally {
      setActionLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('pt-BR').format(num || 0);
  };

  const getTableChipColor = (count) => {
    if (count === 0) return 'default';
    if (count < 10) return 'success';
    if (count < 100) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={50} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ 
          fontWeight: 'bold', 
          background: 'linear-gradient(45deg, #f44336 30%, #ff9800 90%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent'
        }}>
          🛠️ Painel de Administração
        </Typography>
        <Typography variant="h6" color="textSecondary" gutterBottom>
          Gerenciamento completo do banco de dados - Use com cuidado!
        </Typography>
      </Box>

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

      {}
      {stats && (
        <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatsIcon />
              Estatísticas Gerais
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" fontWeight="bold">{stats.total_tables}</Typography>
                  <Typography variant="body2">Tabelas</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" fontWeight="bold">{formatNumber(stats.total_records)}</Typography>
                  <Typography variant="body2">Registros</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" fontWeight="bold">{stats.database_size}</Typography>
                  <Typography variant="body2">Tamanho</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<RefreshIcon />}
                    onClick={loadData}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                  >
                    Atualizar
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteAllIcon />
            Ações Gerais
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>⚠️ ZONA DE PERIGO:</strong> As ações abaixo são irreversíveis!
          </Alert>
        </CardContent>
        <CardActions>
          <Button
            variant="contained"
            color="error"
            startIcon={actionLoading ? <CircularProgress size={20} /> : <DeleteAllIcon />}
            onClick={() => setDeleteAllDialog(true)}
            disabled={actionLoading}
            size="large"
            sx={{ minWidth: 200 }}
          >
            LIMPAR BANCO COMPLETO
          </Button>
        </CardActions>
      </Card>

      {}
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon />
            Gerenciar Tabelas ({tables.length})
          </Typography>
        </CardContent>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Tabela</strong></TableCell>
                <TableCell align="center"><strong>Registros</strong></TableCell>
                <TableCell align="center"><strong>Colunas</strong></TableCell>
                <TableCell align="center"><strong>Tamanho</strong></TableCell>
                <TableCell align="center"><strong>Ações</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.table_name} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {table.table_name}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={formatNumber(table.record_count)}
                      color={getTableChipColor(table.record_count)}
                      variant={table.record_count === 0 ? "outlined" : "filled"}
                    />
                  </TableCell>
                  <TableCell align="center">{table.column_count}</TableCell>
                  <TableCell align="center">{table.size}</TableCell>
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={actionLoading ? <CircularProgress size={16} /> : <DeleteIcon />}
                      onClick={() => setDeleteTableDialog({ open: true, table })}
                      disabled={actionLoading || table.record_count === 0}
                    >
                      Limpar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {}
      <Dialog
        open={deleteTableDialog.open}
        onClose={() => setDeleteTableDialog({ open: false, table: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta ação é <strong>IRREVERSÍVEL</strong>!
          </Alert>
          <Typography>
            Você tem certeza que deseja excluir <strong>TODOS os {formatNumber(deleteTableDialog.table?.record_count)} registros</strong> da tabela <strong>'{deleteTableDialog.table?.table_name}'</strong>?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            Os dados serão permanentemente removidos do banco de dados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTableDialog({ open: false, table: null })}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleDeleteTable(deleteTableDialog.table?.table_name)}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            Confirmar Exclusão
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={deleteAllDialog}
        onClose={() => setDeleteAllDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          ⚠️ CONFIRMAÇÃO CRÍTICA
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>ATENÇÃO:</strong> Esta ação irá excluir <strong>TODOS OS DADOS</strong> do banco!
          </Alert>
          <Typography gutterBottom>
            Você está prestes a excluir <strong>{formatNumber(stats?.total_records)} registros</strong> de <strong>{stats?.total_tables} tabelas</strong>.
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            ⚠️ Esta operação é <strong>COMPLETAMENTE IRREVERSÍVEL</strong> e irá resetar todo o sistema!
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllDialog(false)} variant="contained">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAll}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <DeleteAllIcon />}
          >
            🗑️ CONFIRMAR LIMPEZA TOTAL
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminPage;