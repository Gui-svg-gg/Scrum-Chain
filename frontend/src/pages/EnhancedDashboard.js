import React, { useState, useEffect, useContext } from 'react';
import { getApiUrl } from '../config/api';
import {
  Container, Box, Typography, Paper, Grid, Card, CardContent,
  CircularProgress, Alert, Button, Chip, IconButton, Tooltip,
  LinearProgress, Avatar, List, ListItem, ListItemAvatar, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Sprint as SprintIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  AccountTree as BacklogIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import JoinTeamPage from './JoinTeamPage';

function EnhancedDashboard() {
  const [userTeam, setUserTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0,
    activeSprints: 0,
    completedSprints: 0,
    backlogItems: 0,
    teamProductivity: 0,
    burndownData: [],
    recentActivity: [],
    sprintProgress: null,
    teamVelocity: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const hasChecked = useRef(false);
  const navigate = useNavigate();


  const checkUserTeam = async () => {
    if (hasChecked.current) return null;

    try {
      hasChecked.current = true;
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Token não encontrado');
      }

      const response = await fetch(`${getApiUrl()}/api/groups/user-team`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success && data.data) {
        setUserTeam(data.data);
        return data.data;
      } else {
        setUserTeam(null);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao verificar equipe:', error);
      setUserTeam(null);
      return null;
    }
  };


  const loadDashboardStats = async (teamData) => {
    try {
      const token = localStorage.getItem('token');


      const tasksResponse = await fetch(`${getApiUrl()}/api/tasks/team/${teamData.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let tasksData = { tasks: [] };
      if (tasksResponse.ok) {
        tasksData = await tasksResponse.json();
      }


      const sprintsResponse = await fetch(`${getApiUrl()}/api/sprints/team/${teamData.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let sprintsData = { sprints: [] };
      if (sprintsResponse.ok) {
        sprintsData = await sprintsResponse.json();
      }


      const backlogResponse = await fetch(`${getApiUrl()}/api/backlog/team/${teamData.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let backlogData = { items: [] };
      if (backlogResponse.ok) {
        backlogData = await backlogResponse.json();
      }


      const activityResponse = await fetch(`${getApiUrl()}/api/audit/history?groupId=${teamData.id}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let activityData = { data: [] };
      if (activityResponse.ok) {
        activityData = await activityResponse.json();
      }


      const tasks = tasksData.tasks || tasksData.data || [];
      const completedTasks = tasks.filter(task => task.status === 'done' || task.status === 'completed').length;
      const inProgressTasks = tasks.filter(task => task.status === 'in_progress' || task.status === 'doing').length;
      const todoTasks = tasks.filter(task => task.status === 'todo' || task.status === 'pending').length;


      const sprints = sprintsData.sprints || sprintsData.data || [];
      const activeSprints = sprints.filter(sprint => sprint.status === 'active' || sprint.status === 'in_progress').length;
      const completedSprints = sprints.filter(sprint => sprint.status === 'completed').length;


      const teamProductivity = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;


      const currentSprint = sprints.find(sprint => sprint.status === 'active' || sprint.status === 'in_progress');
      let sprintProgress = null;
      if (currentSprint) {
        const sprintTasks = tasks.filter(task => task.sprint_id === currentSprint.id);
        const sprintCompletedTasks = sprintTasks.filter(task => task.status === 'done' || task.status === 'completed').length;
        sprintProgress = {
          name: currentSprint.name,
          completed: sprintCompletedTasks,
          total: sprintTasks.length,
          percentage: sprintTasks.length > 0 ? Math.round((sprintCompletedTasks / sprintTasks.length) * 100) : 0,
          startDate: currentSprint.start_date,
          endDate: currentSprint.end_date
        };
      }


      const teamVelocity = completedSprints > 0 ? Math.round(completedTasks / Math.max(completedSprints, 1)) : 0;

      const stats = {
        totalTasks: tasks.length,
        completedTasks,
        inProgressTasks,
        todoTasks,
        activeSprints,
        completedSprints,
        backlogItems: (backlogData.items || backlogData.data || []).length,
        teamProductivity,
        sprintProgress,
        teamVelocity,
        recentActivity: (activityData.data || []).slice(0, 5).map(activity => ({
          action: activity.action_type || activity.action,
          entity: activity.entity_type || activity.entity,
          user: activity.user_name || activity.username || 'Usuário',
          timestamp: activity.created_at || activity.timestamp,
          details: activity.details
        }))
      };

      setDashboardStats(stats);

    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);

      setDashboardStats({
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        activeSprints: 0,
        completedSprints: 0,
        backlogItems: 0,
        teamProductivity: 0,
        sprintProgress: null,
        teamVelocity: 0,
        recentActivity: []
      });
    }
  };


  const loadTeamMembers = async (teamId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const membersData = await response.json();
        if (membersData.success) {
          setTeamMembers(membersData.data || []);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar membros:', error);
    }
  };


  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const teamData = await checkUserTeam();

      if (!teamData) {
        setLoading(false);
        return;
      }

      await Promise.all([
        loadDashboardStats(teamData),
        loadTeamMembers(teamData.id)
      ]);

    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);


  if (!loading && !userTeam) {
    return <JoinTeamPage />;
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Box textAlign="center">
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Carregando dashboard...
            </Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          onClick={loadDashboardData}
          startIcon={<RefreshIcon />}
        >
          Tentar Novamente
        </Button>
      </Container>
    );
  }

  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'done':
        return 'success';
      case 'in_progress':
      case 'doing':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getActivityIcon = (actionType) => {
    if (actionType?.includes('TASK')) return <AssignmentIcon color="primary" />;
    if (actionType?.includes('SPRINT')) return <SprintIcon color="warning" />;
    if (actionType?.includes('GROUP')) return <GroupIcon color="secondary" />;
    return <InfoIcon color="action" />;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {}
      <Box mb={4}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" component="h1" gutterBottom>
              <DashboardIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
              Dashboard - {userTeam?.name}
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Visão geral completa do progresso da sua equipe Scrum
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} textAlign="right">
            <Button
              variant="outlined"
              onClick={() => setShowTeamDialog(true)}
              startIcon={<GroupIcon />}
              sx={{ mr: 1 }}
            >
              Equipe
            </Button>
            <Button
              variant="outlined"
              onClick={loadDashboardData}
              startIcon={<RefreshIcon />}
            >
              Atualizar
            </Button>
          </Grid>
        </Grid>
      </Box>

      {}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total de Tarefas
                  </Typography>
                  <Typography variant="h4">
                    {dashboardStats.totalTasks}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    {dashboardStats.completedTasks} concluídas
                  </Typography>
                </Box>
                <AssignmentIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Produtividade
                  </Typography>
                  <Typography variant="h4">
                    {dashboardStats.teamProductivity}%
                  </Typography>
                  <Typography variant="body2" color="info.main">
                    Taxa de conclusão
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Sprints Ativos
                  </Typography>
                  <Typography variant="h4">
                    {dashboardStats.activeSprints}
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    {dashboardStats.completedSprints} finalizados
                  </Typography>
                </Box>
                <SprintIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Velocidade
                  </Typography>
                  <Typography variant="h4">
                    {dashboardStats.teamVelocity}
                  </Typography>
                  <Typography variant="body2" color="info.main">
                    Tarefas por sprint
                  </Typography>
                </Box>
                <SpeedIcon sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {}
      {dashboardStats.sprintProgress && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            <PlayArrowIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Sprint Atual: {dashboardStats.sprintProgress.name}
          </Typography>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Progresso: {dashboardStats.sprintProgress.completed} de {dashboardStats.sprintProgress.total} tarefas
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={dashboardStats.sprintProgress.percentage}
                sx={{ height: 8, borderRadius: 1 }}
                color={dashboardStats.sprintProgress.percentage >= 70 ? 'success' : dashboardStats.sprintProgress.percentage >= 40 ? 'warning' : 'error'}
              />
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="textSecondary">
                  Início: {formatDate(dashboardStats.sprintProgress.startDate)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Fim: {formatDate(dashboardStats.sprintProgress.endDate)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4} textAlign="center">
              <Typography variant="h3" color="primary">
                {dashboardStats.sprintProgress.percentage}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Concluído
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Grid container spacing={3}>
        {}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Status das Tarefas
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4} textAlign="center">
                <Avatar sx={{ bgcolor: 'grey.300', mx: 'auto', mb: 1 }}>
                  <ScheduleIcon />
                </Avatar>
                <Typography variant="h6">{dashboardStats.todoTasks}</Typography>
                <Typography variant="caption" color="textSecondary">
                  A Fazer
                </Typography>
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 1 }}>
                  <PlayArrowIcon />
                </Avatar>
                <Typography variant="h6">{dashboardStats.inProgressTasks}</Typography>
                <Typography variant="caption" color="textSecondary">
                  Em Progresso
                </Typography>
              </Grid>
              <Grid item xs={4} textAlign="center">
                <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                  <CheckCircleIcon />
                </Avatar>
                <Typography variant="h6">{dashboardStats.completedTasks}</Typography>
                <Typography variant="caption" color="textSecondary">
                  Concluídas
                </Typography>
              </Grid>
            </Grid>

            <Box mt={3}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/tasks')}
                startIcon={<AssignmentIcon />}
              >
                Ver Todas as Tarefas
              </Button>
            </Box>
          </Paper>
        </Grid>

        {}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              <CalendarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Atividade Recente
            </Typography>

            {dashboardStats.recentActivity.length > 0 ? (
              <List dense>
                {dashboardStats.recentActivity.map((activity, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {getActivityIcon(activity.action)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          <strong>{activity.user}</strong> {activity.action?.toLowerCase().replace(/_/g, ' ')}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="textSecondary">
                          {activity.timestamp ? formatDate(activity.timestamp) : 'Recente'}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box textAlign="center" py={3}>
                <InfoIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="textSecondary">
                  Nenhuma atividade recente
                </Typography>
              </Box>
            )}

            <Box mt={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/history')}
                startIcon={<TimelineIcon />}
              >
                Ver Histórico Completo
              </Button>
            </Box>
          </Paper>
        </Grid>

        {}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Ações Rápidas
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/sprints')}
                  startIcon={<SprintIcon />}
                >
                  Sprints
                </Button>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/backlog')}
                  startIcon={<BacklogIcon />}
                >
                  Backlog
                </Button>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/tasks')}
                  startIcon={<AssignmentIcon />}
                >
                  Tarefas
                </Button>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/groups')}
                  startIcon={<GroupIcon />}
                >
                  Equipe
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {}
      <Dialog open={showTeamDialog} onClose={() => setShowTeamDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Equipe: {userTeam?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            <strong>Descrição:</strong> {userTeam?.description || 'Sem descrição'}
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>Seu papel:</strong> {userTeam?.member_role}
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>Membros ({teamMembers.length}):</strong>
          </Typography>

          <List>
            {teamMembers.map((member) => (
              <ListItem key={member.id}>
                <ListItemAvatar>
                  <Avatar>
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.full_name || member.name}
                  secondary={
                    <Chip
                      label={member.role}
                      size="small"
                      color={member.role === 'Product Owner' ? 'error' : member.role === 'Scrum Master' ? 'primary' : 'success'}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTeamDialog(false)}>
            Fechar
          </Button>
          <Button variant="contained" onClick={() => navigate('/groups')}>
            Gerenciar Equipe
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default EnhancedDashboard;
