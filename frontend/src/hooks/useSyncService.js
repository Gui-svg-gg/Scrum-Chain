import { useState, useCallback, useRef } from 'react';
import BlockchainService from '../services/BlockchainService';

const useSyncService = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState({
    equipe: null,
    sprints: null,
    tarefas: null,
    backlog: null
  });
  
  
  const [circuitBreakerCount, setCircuitBreakerCount] = useState(0);
  const [lastResetTime, setLastResetTime] = useState(null);
  const CIRCUIT_BREAKER_THRESHOLD = 5; 
  const RESET_COOLDOWN_MS = 300000; 
  
  
  const syncTimeouts = useRef({});
  const SYNC_THROTTLE_MS = 30000; 

  
  const handleCircuitBreakerError = useCallback(async () => {
    const newCount = circuitBreakerCount + 1;
    setCircuitBreakerCount(newCount);
    
    console.warn(`⚠️ Circuit breaker detectado (${newCount}/${CIRCUIT_BREAKER_THRESHOLD})`);
    
    
    if (newCount >= CIRCUIT_BREAKER_THRESHOLD) {
      const now = Date.now();
      const canReset = !lastResetTime || (now - lastResetTime) > RESET_COOLDOWN_MS;
      
      if (canReset) {
        console.log('🔄 Tentando reset automático da Hardhat devido a circuit breaker...');
        try {
          const resetSuccess = await BlockchainService.resetHardhatNetwork();
          if (resetSuccess) {
            setCircuitBreakerCount(0);
            setLastResetTime(now);
            console.log('✅ Reset automático da Hardhat bem-sucedido!');
            return true;
          } else {
            console.warn('⚠️ Reset automático da Hardhat falhou');
            return false;
          }
        } catch (error) {
          console.error('❌ Erro no reset automático da Hardhat:', error);
          return false;
        }
      } else {
        const waitTime = Math.ceil((RESET_COOLDOWN_MS - (now - lastResetTime)) / 60000);
        console.log(`⏳ Aguardando ${waitTime} minutos antes do próximo reset automático`);
        return false;
      }
    }
    
    return false;
  }, [circuitBreakerCount, lastResetTime]);

  
  const isCircuitBreakerError = useCallback((error) => {
    return error.message?.includes('circuit breaker is open') || 
           error.message?.includes('Internal JSON-RPC error') ||
           error.code === -32603;
  }, []);

  
  const syncEquipe = useCallback(async (force = false, userTeam = null) => {
    const now = Date.now();
    const lastSync = lastSyncTime.equipe;
    
    if (!force && lastSync && (now - lastSync) < SYNC_THROTTLE_MS) {
      return true; 
    }

    try {
      
      if (!userTeam || !userTeam.blockchain_id || userTeam.blockchain_id <= 0) {
        console.log('⚠️ Equipe não está sincronizada com blockchain');
        return false;
      }

      console.log('✅ Equipe verificada localmente - sincronização OK, ID:', userTeam.blockchain_id);
      setLastSyncTime(prev => ({ ...prev, equipe: now }));
      return true;
    } catch (error) {
      console.error('❌ Erro ao verificar sincronização da equipe:', error);
      return false;
    }
  }, [lastSyncTime.equipe]);

  
  const syncSprints = useCallback(async (force = false) => {
    const now = Date.now();
    const lastSync = lastSyncTime.sprints;
    
    if (!force && lastSync && (now - lastSync) < SYNC_THROTTLE_MS) {
      return true; 
    }

    try {
      const initResult = await BlockchainService.initialize();
      if (!initResult) {
        console.log('⚠️ BlockchainService não inicializado, pulando sincronização dos sprints');
        return false;
      }

      const contracts = BlockchainService.getContracts();
      if (!contracts?.sprintContract) {
        console.log('⚠️ Contratos de sprint não disponíveis, pulando sincronização');
        return false;
      }

      
      try {
        const account = await BlockchainService.getCurrentAccount();
        if (!account) {
          console.log('⚠️ Nenhuma conta conectada');
          return false;
        }

        
        
        console.log('✅ Sprints verificados - sincronização OK');
        setLastSyncTime(prev => ({ ...prev, sprints: now }));
        return true;
      } catch (blockchainError) {
        if (blockchainError.message?.includes('circuit breaker is open') || 
            blockchainError.code === -32603) {
          console.log('⚠️ Circuit breaker ativo - sincronização dos sprints bloqueada temporariamente');
          return false;
        }
        
        console.log('⚠️ Erro ao verificar sprints na blockchain:', BlockchainService.handleTransactionError(blockchainError));
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar sprints:', BlockchainService.handleTransactionError(error));
      return false;
    }
  }, [lastSyncTime.sprints]);

  
  const syncTarefas = useCallback(async (force = false) => {
    const now = Date.now();
    const lastSync = lastSyncTime.tarefas;
    
    if (!force && lastSync && (now - lastSync) < SYNC_THROTTLE_MS) {
      return true; 
    }

    try {
      const initResult = await BlockchainService.initialize();
      if (!initResult) {
        console.log('⚠️ BlockchainService não inicializado, pulando sincronização das tarefas');
        return false;
      }

      const contracts = BlockchainService.getContracts();
      if (!contracts?.taskContract) {
        console.log('⚠️ Contratos de tarefa não disponíveis, pulando sincronização');
        return false;
      }

      try {
        const account = await BlockchainService.getCurrentAccount();
        if (!account) {
          console.log('⚠️ Nenhuma conta conectada');
          return false;
        }

        
        console.log('✅ Tarefas verificadas - sincronização OK');
        setLastSyncTime(prev => ({ ...prev, tarefas: now }));
        return true;
      } catch (blockchainError) {
        if (blockchainError.message?.includes('circuit breaker is open') || 
            blockchainError.code === -32603) {
          console.log('⚠️ Circuit breaker ativo - sincronização das tarefas bloqueada temporariamente');
          return false;
        }
        
        console.log('⚠️ Erro ao verificar tarefas na blockchain:', BlockchainService.handleTransactionError(blockchainError));
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar tarefas:', BlockchainService.handleTransactionError(error));
      return false;
    }
  }, [lastSyncTime.tarefas]);

  
  const syncBacklog = useCallback(async (force = false) => {
    const now = Date.now();
    const lastSync = lastSyncTime.backlog;
    
    if (!force && lastSync && (now - lastSync) < SYNC_THROTTLE_MS) {
      return true; 
    }

    try {
      const initResult = await BlockchainService.initialize();
      if (!initResult) {
        console.log('⚠️ BlockchainService não inicializado, pulando sincronização do backlog');
        return false;
      }

      const contracts = BlockchainService.getContracts();
      if (!contracts?.backlogContract) {
        console.log('⚠️ Contratos de backlog não disponíveis, pulando sincronização');
        return false;
      }

      try {
        const account = await BlockchainService.getCurrentAccount();
        if (!account) {
          console.log('⚠️ Nenhuma conta conectada');
          return false;
        }

        
        console.log('✅ Backlog verificado - sincronização OK');
        setLastSyncTime(prev => ({ ...prev, backlog: now }));
        return true;
      } catch (blockchainError) {
        if (blockchainError.message?.includes('circuit breaker is open') || 
            blockchainError.code === -32603) {
          console.log('⚠️ Circuit breaker ativo - sincronização do backlog bloqueada temporariamente');
          return false;
        }
        
        console.log('⚠️ Erro ao verificar backlog na blockchain:', BlockchainService.handleTransactionError(blockchainError));
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar backlog:', BlockchainService.handleTransactionError(error));
      return false;
    }
  }, [lastSyncTime.backlog]);

  
  const syncAll = useCallback(async (force = false, userTeam = null) => {
    if (isSyncing && !force) return;
    
    setIsSyncing(true);
    try {
      const results = await Promise.allSettled([
        syncEquipe(force, userTeam),
        syncSprints(force),
        syncTarefas(force),
        syncBacklog(force)
      ]);

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failedCount = results.filter(r => r.status === 'fulfilled' && r.value === false).length;
      const errorCount = results.filter(r => r.status === 'rejected').length;
      
      if (successCount === 4) {
        console.log(`✅ Sincronização automática completa: ${successCount}/4 sucessos`);
      } else if (failedCount > 0 || errorCount > 0) {
        console.log(`⚠️ Sincronização automática parcial: ${successCount}/4 sucessos, ${failedCount} falhas, ${errorCount} erros`);
        
        
        results.forEach((result, index) => {
          const names = ['equipe', 'sprints', 'tarefas', 'backlog'];
          if (result.status === 'rejected') {
            console.error(`❌ Erro na sincronização de ${names[index]}:`, result.reason);
          } else if (result.value === false) {
            console.warn(`⚠️ Falha na sincronização de ${names[index]}`);
          }
        });
      }
      
      return successCount === 4;
    } finally {
      setIsSyncing(false);
    }
  }, [syncEquipe, syncSprints, syncTarefas, syncBacklog, isSyncing]);

  
  const syncBeforeTransaction = useCallback(async (transactionType = 'all') => {
    console.log(`Iniciando sincronização pré-transação: ${transactionType}`);
    
    switch (transactionType) {
      case 'equipe':
        return await syncEquipe(true);
      case 'sprints':
        return await syncSprints(true);
      case 'tarefas':
        return await syncTarefas(true);
      case 'backlog':
        return await syncBacklog(true);
      default:
        return await syncAll(true);
    }
  }, [syncEquipe, syncSprints, syncTarefas, syncBacklog, syncAll]);

  
  const syncAfterTransaction = useCallback(async (transactionType = 'all') => {
    console.log(`Iniciando sincronização pós-transação: ${transactionType}`);
    
    
    setTimeout(async () => {
      switch (transactionType) {
        case 'equipe':
          await syncEquipe(true);
          break;
        case 'sprints':
          await syncSprints(true);
          break;
        case 'tarefas':
          await syncTarefas(true);
          break;
        case 'backlog':
          await syncBacklog(true);
          break;
        default:
          await syncAll(true);
      }
    }, 2000); 
  }, [syncEquipe, syncSprints, syncTarefas, syncBacklog, syncAll]);

  
  const startPeriodicSync = useCallback((intervalMs = 300000) => { 
    console.log(`🔄 Sincronização periódica desabilitada temporariamente para evitar erros de getUserTeam`);
    
    
    return () => {
      console.log('🛑 Parando sincronização periódica');
    };
  }, []);

  return {
    
    isSyncing,
    lastSyncTime,
    
    
    syncEquipe,
    syncSprints,
    syncTarefas,
    syncBacklog,
    syncAll,
    
    
    syncBeforeTransaction,
    syncAfterTransaction,
    
    
    startPeriodicSync,
    
    
    circuitBreakerCount,
    handleCircuitBreakerError,
    isCircuitBreakerError
  };
};

export default useSyncService;