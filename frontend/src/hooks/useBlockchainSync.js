import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import EnhancedBlockchainService from '../services/EnhancedBlockchainService';


const enhancedBlockchainService = new EnhancedBlockchainService();

const useBlockchainSync = () => {
  const { syncBeforeTransaction, syncAfterTransaction } = useApp();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current && syncBeforeTransaction && syncAfterTransaction) {
      console.log('🔗 Configurando sincronização automática no BlockchainService...');

      enhancedBlockchainService.setSyncCallbacks(
        syncBeforeTransaction,
        syncAfterTransaction
      );

      isInitialized.current = true;
    }
  }, [syncBeforeTransaction, syncAfterTransaction]);

  return enhancedBlockchainService;
};


export { enhancedBlockchainService };
export default useBlockchainSync;