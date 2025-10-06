import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import db, { TransactionService, TeamMemberService, testConnection } from '../database/db-postgres';
import useSyncService from '../hooks/useSyncService';
import { getApiUrl } from '../config/api';

const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  
  const syncService = useSyncService();
  
  
  const [currentTeam, setCurrentTeam] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [teamRole, setTeamRole] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState({
    team: false,
    database: false,
    blockchain: false
  });
  
  const [needsInvite, setNeedsInvite] = useState(false);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  
  useEffect(() => {
    async function initializeApp() {
      try {
        console.log('📋 Inicializando aplicação...');
        await testConnection();
        setDbInitialized(true);
        console.log('✅ Banco de dados inicializado');
        
        
        console.log('🔄 Iniciando sincronização automática...');
        const stopPeriodicSync = syncService.startPeriodicSync(120000); 
        
        
        return () => {
          if (stopPeriodicSync) {
            stopPeriodicSync();
          }
        };
      } catch (error) {
        console.error("Erro na inicialização:", error);
        setError("Erro de conexão com o servidor");
      }
    }
    
    
    if (!dbInitialized) {
      initializeApp();
    }
  }, []); 

  
  const syncCompleteSystem = useCallback(async () => {
    
    if (isSyncing) {
      console.log('⚠️ Sincronização já em andamento, ignorando...');
      return;
    }

    try {
      setIsSyncing(true);
      console.log('🔄 Iniciando sincronização completa do sistema...');
      
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ Token não encontrado');
        return;
      }

      
      let teamData = null;
      try {
        const response = await fetch(`${getApiUrl()}/api/groups/user-team`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const teamResponse = await response.json();
          console.log('🔍 Resposta da equipe:', teamResponse);
          
          if (teamResponse.success && teamResponse.data) {
            teamData = teamResponse.data;
            setCurrentTeam(teamData);
            
            
            let roleId = null;
            const role = teamData.member_role || teamData.role;
            
            if (role === 'Product Owner') {
              roleId = 0;
            } else if (role === 'Scrum Master') {
              roleId = 1;
            } else if (role === 'Developer') {
              roleId = 2;
            }
            
            setUserRole(roleId);
            setTeamRole(roleId);
            
            console.log('✅ Equipe sincronizada:', teamData.name, '| Role:', role, '| RoleId:', roleId);
          } else {
            console.log('⚠️ Usuário não possui equipe ativa');
            setCurrentTeam(null);
            setUserRole(null);
            setTeamRole(null);
          }
        } else {
          console.warn('⚠️ Erro ao buscar equipe do usuário');
        }
      } catch (teamError) {
        console.warn('⚠️ Erro ao sincronizar equipe:', teamError);
      }
      
      setSyncStatus(prev => ({ ...prev, team: true }));
      
      
      if (teamData?.id) {
        console.log('✅ Usuário autenticado com equipe ativa - sistema pronto para uso');
        
        
        console.log('🔗 Executando sincronização blockchain automática...');
        await syncService.syncAll(true);
      }
      
      setSyncStatus(prev => ({ 
        ...prev, 
        database: true,
        blockchain: true
      }));
      
      console.log('✅ Sincronização completa finalizada');
      
    } catch (error) {
      console.error('❌ Erro na sincronização completa:', error);
      setSyncStatus(prev => ({ 
        ...prev, 
        database: false, 
        team: false 
      }));
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  
  const logoutComplete = useCallback(() => {
    console.log("🚪 Executando logout completo do sistema...");
    
    
    setCurrentTeam(null);
    setTeamRole(null);
    setUserRole(null);
    setShowRegistrationDialog(false);
    setNeedsInvite(false);
    setError(null);
    setTransactions([]);
    
    setSyncStatus({
      team: false,
      database: false
    });

    
    localStorage.removeItem('token');
    localStorage.removeItem('scrumchain_user');
    
    console.log("✅ Logout completo executado - todos os dados limpos");
  }, []);

  
  const debugSyncSystem = useCallback(async () => {
    console.log('🔍 DEBUG: Forçando sincronização completa...');
    console.log('🔍 DEBUG: isSyncing:', isSyncing);
    
    if (isSyncing) {
      console.log('⚠️ DEBUG: Sincronização já em andamento');
      return;
    }
    
    console.log('🔄 DEBUG: Executando sincronização...');
    await syncCompleteSystem();
  }, [isSyncing, syncCompleteSystem]);

  const value = {
    loading,
    error,
    currentTeam,
    userRole,
    teamRole,
    transactions,
    syncStatus,
    needsInvite,
    showRegistrationDialog,
    dbInitialized,
    isSyncing,
    syncCompleteSystem,
    forceSyncSystem: syncCompleteSystem,
    debugSyncSystem,
    logoutComplete,
    setError,
    setNeedsInvite,
    setShowRegistrationDialog,
    setTeamRole,
    setCurrentTeam,
    setUserRole,
    
    syncService,
    syncBeforeTransaction: syncService.syncBeforeTransaction,
    syncAfterTransaction: syncService.syncAfterTransaction,
    isBlockchainSyncing: syncService.isSyncing
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppContext;
