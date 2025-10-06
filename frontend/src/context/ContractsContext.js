import { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './WalletContext';


import contractAddresses from '../contracts/contract-addresses.json';
import ScrumTeamABI from '../contracts/ScrumTeam.json';
import ProductBacklogABI from '../contracts/ProductBacklog.json';
import SprintManagementABI from '../contracts/SprintManagement.json';
import TaskManagementABI from '../contracts/TaskManagement.json';

export const useContracts = () => {
  const { isConnected, account } = useWallet();
  const [contracts, setContracts] = useState({
    scrumTeam: null,
    productBacklog: null,
    sprintManagement: null,
    taskManagement: null
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);

  
  const contractConfigs = useMemo(() => ({
    scrumTeam: {
      address: contractAddresses.ScrumTeam,
      abi: ScrumTeamABI.abi
    },
    productBacklog: {
      address: contractAddresses.ProductBacklog,
      abi: ProductBacklogABI.abi
    },
    sprintManagement: {
      address: contractAddresses.SprintManagement,
      abi: SprintManagementABI.abi
    },
    taskManagement: {
      address: contractAddresses.TaskManagement,
      abi: TaskManagementABI.abi
    }
  }), []); 

  
  useEffect(() => {
    const initContracts = async () => {
      if (!isConnected || !account || !window.ethereum) {
        setContracts({
          scrumTeam: null,
          productBacklog: null,
          sprintManagement: null,
          taskManagement: null
        });
        setIsInitialized(false);
        return;
      }

      try {
        setError(null);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        
        const newContracts = {};
        
        Object.keys(contractConfigs).forEach(key => {
          const config = contractConfigs[key];
          if (config.address && config.abi) {
            newContracts[key] = new ethers.Contract(config.address, config.abi, signer);
          } else {
            console.warn(`⚠️ Configuração incompleta para contrato ${key}`);
          }
        });

        setContracts(newContracts);
        setIsInitialized(true);
        console.log('✅ Todos os contratos inicializados automaticamente');

      } catch (error) {
        console.error('❌ Erro ao inicializar contratos:', error);
        setError(error.message);
        setIsInitialized(false);
      }
    };

    initContracts();
  }, [isConnected, account, contractConfigs]);

  
  const generateDataHash = (data) => {
    try {
      const dataString = JSON.stringify(data);
      return ethers.keccak256(ethers.toUtf8Bytes(dataString));
    } catch (error) {
      console.error('Erro ao gerar hash dos dados:', error);
      return null;
    }
  };

  
  const isValidAddress = (address) => {
    try {
      return ethers.isAddress(address) && address !== ethers.ZeroAddress;
    } catch {
      return false;
    }
  };

  return {
    
    contracts,
    
    
    isInitialized,
    error,
    
    
    contractAddresses,
    contractConfigs,
    
    
    generateDataHash,
    isValidAddress,
    
    
    scrumContract: contracts.scrumTeam,
    productBacklogContract: contracts.productBacklog,
    sprintContract: contracts.sprintManagement,
    taskContract: contracts.taskManagement
  };
};

export default useContracts;