import React from 'react';
import { 
  Container, Box, Typography, Paper, Avatar, Button, Alert
} from '@mui/material';
import { 
  GroupAdd as GroupAddIcon,
  Group as GroupIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function JoinTeamPage() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ mt: 8, mb: 4 }}>
      {}
      <Box mb={4} textAlign="center">
        <Avatar sx={{ bgcolor: 'warning.main', width: 100, height: 100, mx: 'auto', mb: 3 }}>
          <GroupAddIcon sx={{ fontSize: 50 }} />
        </Avatar>
        <Typography variant="h4" component="h1" gutterBottom>
          Você ainda não faz parte de uma equipe
        </Typography>
        <Typography variant="h6" color="textSecondary" sx={{ mb: 4 }}>
          Para acessar o dashboard e começar a trabalhar com Scrum, você precisa estar em uma equipe.
        </Typography>
      </Box>

      {}
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Como participar de uma equipe?
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Box display="flex" alignItems="center">
              <InfoIcon sx={{ mr: 1 }} />
              <Typography variant="body1">
                <strong>Duas opções para você:</strong>
              </Typography>
            </Box>
          </Alert>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              🎯 Opção 1: Criar sua própria equipe
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
              Crie uma nova equipe Scrum e torne-se o Scrum Master automaticamente.
            </Typography>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<GroupAddIcon />}
              onClick={() => navigate('/team')}
              sx={{ px: 4, py: 1.5 }}
            >
              Criar Nova Equipe
            </Button>
          </Box>

          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            ⏳ Opção 2: Aguarde o Chamado
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Aguarde um Scrum Master de alguma equipe existente adicionar você como membro.
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Importante:</strong> Você só poderá acessar o dashboard e as funcionalidades do sistema após fazer parte de uma equipe Scrum.
          </Typography>
        </Alert>
      </Paper>
    </Container>
  );
}

export default JoinTeamPage;
