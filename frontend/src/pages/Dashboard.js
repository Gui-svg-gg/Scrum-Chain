import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../config/api';
import { 
  Container, Box, Typography, Paper, Grid, Card, CardContent, 
  CircularProgress, Alert, Button, Chip, Avatar, List, ListItem, 
  ListItemAvatar, ListItemText, Divider, LinearProgress
} from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  AccountTree as BacklogIcon,
  DirectionsRun as SprintIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import JoinTeamPage from './JoinTeamPage';

function Dashboard() {
  const [userTeam, setUserTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    
    teamInfo: null,
    totalMembers: 0,

    totalBacklogItems: 0,
    lastBacklogItem: null,
    
    
    totalSprints: 0,
    completedSprints: 0,
    lastTwoSprints: [],
    
    
    totalTasks: 0,
    lastTwoTasks: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
          return membersData.data || [];
        }
      }
      return [];
    } catch (error) {
      console.error('❌ Erro ao carregar membros:', error);
      return [];
    }
  };

  
  const loadBacklogData = async (teamId) => {
    try {
      console.log('🎯 Carregando backlog para equipe:', teamId);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/backlog/group/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Resposta backlog:', response.status, response.ok);

      if (response.ok) {
        const backlogData = await response.json();
        console.log('📋 Dados do backlog:', backlogData);
        const items = backlogData.data || backlogData.items || [];
        
        return {
          totalBacklogItems: items.length,
          lastBacklogItem: items.length > 0 ? items[items.length - 1] : null
        };
      }
      
      return { totalBacklogItems: 0, lastBacklogItem: null };
    } catch (error) {
      console.error('❌ Erro ao carregar backlog:', error);
      return { totalBacklogItems: 0, lastBacklogItem: null };
    }
  };

  
  const loadSprintsData = async (teamId) => {
    try {
      console.log('🏃 Carregando sprints para equipe:', teamId);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamId}/sprints`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Resposta sprints:', response.status, response.ok);

      if (response.ok) {
        const sprintsData = await response.json();
        console.log('🏃 Dados dos sprints:', sprintsData);
        const sprints = sprintsData.data || sprintsData.sprints || [];
        
        const completedSprints = sprints.filter(sprint => 
          sprint.status === 'completed' || sprint.status === 'finished'
        ).length;

        const lastTwoSprints = sprints
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 2);

        return {
          totalSprints: sprints.length,
          completedSprints,
          lastTwoSprints
        };
      }
      
      return { totalSprints: 0, completedSprints: 0, lastTwoSprints: [] };
    } catch (error) {
      console.error('❌ Erro ao carregar sprints:', error);
      return { totalSprints: 0, completedSprints: 0, lastTwoSprints: [] };
    }
  };

  
  const loadTasksData = async (teamId) => {
    try {
      console.log('📝 Carregando tarefas para equipe:', teamId);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/groups/${teamId}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Resposta tarefas:', response.status, response.ok);

      if (response.ok) {
        const tasksData = await response.json();
        console.log('📝 Dados das tarefas:', tasksData);
        const tasks = tasksData.data || tasksData.tasks || [];

        const lastTwoTasks = tasks
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 2);

        return {
          totalTasks: tasks.length,
          lastTwoTasks
        };
      }
      
      return { totalTasks: 0, lastTwoTasks: [] };
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
      return { totalTasks: 0, lastTwoTasks: [] };
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

      console.log('📊 Carregando dados do dashboard para equipe:', teamData.name);

      
      const [members, backlogData, sprintsData, tasksData] = await Promise.all([
        loadTeamMembers(teamData.id),
        loadBacklogData(teamData.id),
        loadSprintsData(teamData.id),
        loadTasksData(teamData.id)
      ]);

      console.log('📊 Dados carregados:', {
        teamId: teamData.id,
        members: members.length,
        backlog: backlogData,
        sprints: sprintsData,
        tasks: tasksData
      });

      setDashboardData({
        teamInfo: teamData,
        totalMembers: members.length,
        ...backlogData,
        ...sprintsData,
        ...tasksData
      });

      console.log('✅ Dados do dashboard carregados com sucesso');

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
        >
          Tentar Novamente
        </Button>
      </Container>
    );
  }

  const getPapelColor = (role) => {
    switch (role) {
      case 'Product Owner': return 'error';
      case 'Scrum Master': return 'primary';
      case 'Developer': return 'success';
      default: return 'default';
    }
  };

  
  const getSprintStatusLabel = (status) => {
    const statusLabels = {
      'completed': 'Concluído',
      'finished': 'Finalizado',
      'active': 'Ativo',
      'in_progress': 'Em Progresso',
      'planning': 'Planejamento',
      'cancelled': 'Cancelado'
    };
    return statusLabels[status] || status;
  };

  
  const getTaskStatusLabel = (status) => {
    const statusLabels = {
      'done': 'Concluído',
      'completed': 'Concluído',
      'in_progress': 'Em Progresso',
      'doing': 'Fazendo',
      'todo': 'A Fazer',
      'pending': 'Pendente'
    };
    return statusLabels[status] || status;
  };

  
  const getPriorityLabel = (priority) => {
    const priorityLabels = {
      '1': 'Baixa',
      '2': 'Média',
      '3': 'Alta',
      '4': 'Crítica',
      '5': 'Urgente',
      'baixa': 'Baixa',
      'media': 'Média',
      'alta': 'Alta',
      'critica': 'Crítica',
      'urgente': 'Urgente',
      'low': 'Baixa',
      'medium': 'Média',
      'high': 'Alta',
      'critical': 'Crítica',
      'urgent': 'Urgente'
    };
    return priorityLabels[priority.toString().toLowerCase()] || priority;
  };

  const getSprintStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'finished':
        return 'success';
      case 'active':
      case 'in_progress':
        return 'primary';
      case 'planning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'done':
      case 'completed':
        return 'success';
      case 'in_progress':
      case 'doing':
        return 'warning';
      case 'todo':
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          <DashboardIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Dashboard - {dashboardData.teamInfo?.name}
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Visão geral das atividades da sua equipe Scrum
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              <GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Equipe - {dashboardData.teamInfo?.name}
            </Typography>
            
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Total de membros: {dashboardData.totalMembers}
            </Typography>

            <List dense>
              {teamMembers.map((member) => (
                <ListItem key={member.id} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.full_name || member.name}
                    secondary={
                      <Chip 
                        label={member.role} 
                        size="small"
                        color={getPapelColor(member.role)}
                        variant="outlined"
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>

            {teamMembers.length === 0 && (
              <Typography color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                Nenhum membro encontrado
              </Typography>
            )}
          </Paper>
        </Grid>

        {}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              <BacklogIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Product Backlog
            </Typography>
            
            <Typography variant="h4" color="primary" gutterBottom>
              {dashboardData.totalBacklogItems}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Total de itens no backlog
            </Typography>

            {dashboardData.lastBacklogItem ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Último item criado:
                </Typography>
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {dashboardData.lastBacklogItem.title}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Criado em: {formatDate(dashboardData.lastBacklogItem.created_at)}
                  </Typography>
                  {dashboardData.lastBacklogItem.priority && (
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        label={`Prioridade: ${getPriorityLabel(dashboardData.lastBacklogItem.priority)}`} 
                        size="small" 
                        color="warning"
                      />
                    </Box>
                  )}
                  {dashboardData.lastBacklogItem.story_points && (
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        label={`Story Points: ${dashboardData.lastBacklogItem.story_points}`} 
                        size="small" 
                        color="info"
                      />
                    </Box>
                  )}
                </Card>
              </Box>
            ) : (
              <Typography color="textSecondary">
                Nenhum item no backlog ainda
              </Typography>
            )}

            <Button 
              variant="outlined" 
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => navigate('/backlog')}
              startIcon={<BacklogIcon />}
            >
              Ver Backlog
            </Button>
          </Paper>
        </Grid>

        {}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <SprintIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Sprints & Tarefas
            </Typography>
            
            <Grid container spacing={4}>
              {}
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Sprints
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6}>
                      <Typography variant="h4" color="primary">
                        {dashboardData.totalSprints}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Total de sprints
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h4" color="success.main">
                        {dashboardData.completedSprints}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Finalizados
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="subtitle2" gutterBottom>
                    Últimos sprints criados:
                  </Typography>

                  {dashboardData.lastTwoSprints.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      {dashboardData.lastTwoSprints.map((sprint, index) => (
                        <Card key={sprint.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {sprint.name}
                            </Typography>
                            <Chip 
                              label={getSprintStatusLabel(sprint.status)} 
                              size="small" 
                              color={getSprintStatusColor(sprint.status)}
                            />
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                          </Typography>
                        </Card>
                      ))}
                    </Box>
                  ) : (
                    <Typography color="textSecondary" sx={{ mb: 2 }}>
                      Nenhum sprint criado ainda
                    </Typography>
                  )}
                </Box>
              </Grid>

              {}
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Tarefas
                  </Typography>
                  
                  <Typography variant="h4" color="primary" gutterBottom>
                    {dashboardData.totalTasks}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    Total de tarefas
                  </Typography>

                  <Typography variant="subtitle2" gutterBottom>
                    Últimas tarefas criadas:
                  </Typography>

                  {dashboardData.lastTwoTasks.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      {dashboardData.lastTwoTasks.map((task) => (
                        <Card key={task.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {task.title}
                            </Typography>
                            <Chip 
                              label={getTaskStatusLabel(task.status)} 
                              size="small" 
                              color={getTaskStatusColor(task.status)}
                            />
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            Sprint: {task.sprint_name || 'Sprint não identificado'}
                          </Typography>
                          <br />
                          <Typography variant="caption" color="textSecondary">
                            Criada em: {formatDate(task.created_at)}
                          </Typography>
                        </Card>
                      ))}
                    </Box>
                  ) : (
                    <Typography color="textSecondary" sx={{ mb: 2 }}>
                      Nenhuma tarefa criada ainda
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
            
            {}
            <Box sx={{ mt: 3 }}>
              <Button 
                variant="contained" 
                size="large"
                fullWidth
                onClick={() => navigate('/sprints')}
                startIcon={<SprintIcon />}
              >
                Gerenciar Sprints
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;