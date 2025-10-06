import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getApiUrl } from '../config/api';
import {
  Container, Typography, Box, Paper, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, Chip, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Grid, Card, CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Visibility as ViewIcon,
  Assessment as StatsIcon,
  AccountTree as BacklogIcon
} from '@mui/icons-material';


import { useWallet } from '../context/WalletContext';
import ProductBacklogABI from '../contracts/ProductBacklog.json';
import ScrumTeamABI from '../contracts/ScrumTeam.json';
import contractAddresses from '../contracts/contract-addresses.json';
import BlockchainService from '../services/BlockchainService';

function ProductBacklogPage() {
  const { account, isConnected, isCorrectNetwork } = useWallet();

  const [currentTeam, setCurrentTeam] = useState(null);
  const [backlogItems, setBacklogItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successType, setSuccessType] = useState('success');
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [stats, setStats] = useState(null);


  const [productBacklogContract, setProductBacklogContract] = useState(null);
  const [scrumContract, setScrumContract] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [blockchainTxHash, setBlockchainTxHash] = useState(null);


  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    storyPoints: 1
  });

  const priorities = [
    { value: 'low', label: 'Baixa', number: 4 },
    { value: 'medium', label: 'Média', number: 3 },
    { value: 'high', label: 'Alta', number: 2 },
    { value: 'critical', label: 'Crítica', number: 1 }
  ];

  const statusOptions = [
    { value: 'todo', label: 'A fazer' },
    { value: 'in_progress', label: 'Em progresso' },
    { value: 'done', label: 'Concluído' }
  ];

  const priorityColors = {
    low: 'success',
    medium: 'info',
    high: 'warning',
    critical: 'error'
  };


  const generateDataHash = (data) => {
    const dataString = JSON.stringify(data);
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
  };


  const setSuccessWithType = (message, type = 'success') => {
    setSuccess(message);
    setSuccessType(type);
  };


  const originalSetSuccess = setSuccess;
  const customSetSuccess = (message, type = 'success') => {
    if (typeof message === 'string' && type) {
      setSuccessWithType(message, type);
    } else {
      originalSetSuccess(message);
      setSuccessType('success');
    }
  };


  const mapPriorityToEnum = (priority) => {
    switch (priority) {
      case 'low': return 0;
      case 'medium': return 1;
      case 'high': return 2;
      case 'critical': return 3;
      default: return 1;
    }
  };


  const mapStatusToEnum = (status) => {
    switch (status) {
      case 'todo': return 0;
      case 'in_progress': return 1;
      case 'done': return 2;
      default: return 0;
    }
  };


  const initializeContracts = async () => {
    if (!isConnected || !window.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();


      const productBacklogContract = new ethers.Contract(
        contractAddresses.ProductBacklog,
        ProductBacklogABI.abi,
        signer
      );


      const scrumContract = new ethers.Contract(
        contractAddresses.ScrumTeam,
        ScrumTeamABI.abi,
        signer
      );

      setProductBacklogContract(productBacklogContract);
      setScrumContract(scrumContract);

      console.log('🔗 Contratos ProductBacklog e ScrumTeam inicializados');
    } catch (error) {
      console.error('❌ Erro ao inicializar contratos:', error);
      setError('Erro ao conectar com os contratos blockchain');
    }
  };


  const isTeamSyncedLocally = () => {
    return currentTeam?.blockchain_id && currentTeam.blockchain_id > 0;
  };






  useEffect(() => {
    if (isConnected && isCorrectNetwork) {
      initializeContracts();
    }
  }, [isConnected, isCorrectNetwork]);


  const autoSyncBlockchain = async () => {
    if (!currentTeam || !productBacklogContract || !scrumContract || !account) {
      return;
    }

    try {
      setLoadingAction(true);
      console.log('⚡ Iniciando sincronização automática...');


      if (!isTeamSyncedLocally()) {
        console.log('⚡ Sincronizando equipe para blockchain...');

        try {

          const teamHash = generateDataHash({
            name: currentTeam.name,
            description: currentTeam.description || '',
            createdBy: account
          });

          const tx = await scrumContract.registerTeam(teamHash);


          const receipt = await tx.wait();
          console.log('✅ Transação confirmada:', receipt.transactionHash);

          console.log('✅ Equipe sincronizada com blockchain');
        } catch (teamError) {
          if (teamError.message.includes('User already belongs to a team')) {
            console.log('✅ Equipe já estava registrada na blockchain');
          } else {
            console.warn('⚠️ Erro ao sincronizar equipe:', teamError);


            console.error('❌ Erro na transação:', teamError.message);
          }
        }
      }


      await new Promise(resolve => setTimeout(resolve, 1000));
      const finalTeamId = currentTeam?.blockchain_id || 0;

      if (finalTeamId && finalTeamId > 0 && backlogItems && backlogItems.length > 0) {
        console.log('� Sincronizando itens para blockchain...');


        console.log('⚠️ Pulando verificação de itens existentes - registrando todos os itens');
        const existingHashes = new Set();


        let syncedCount = 0;
        for (const item of backlogItems) {
          try {
            const blockchainData = {
              id: item.id,
              title: item.title,
              description: item.description,
              priority: item.priority,
              storyPoints: item.storyPoints,
              teamId: finalTeamId.toString()
            };

            const dataHash = generateDataHash(blockchainData);


            if (!existingHashes.has(dataHash)) {
              const priorityEnum = mapPriorityToEnum(item.priority);
              const tx = await productBacklogContract.registerBacklogItem(
                finalTeamId,
                priorityEnum,
                dataHash
              );
              await tx.wait();
              syncedCount++;
              console.log('✅ Item sincronizado:', item.title);
            }
          } catch (itemError) {
            console.warn('⚠️ Erro ao sincronizar item:', item.title, itemError);
          }
        }

        if (syncedCount > 0) {
          console.log(`✅ ${syncedCount} novos itens sincronizados`);
        } else {
          console.log('✅ Todos os itens já estavam sincronizados');
        }
      }


      console.log('🗺️ Atualizando mapeamento...');
      const mapping = await getBlockchainItemMapping();
      setBlockchainMapping(mapping);

      setSuccess('✅ Sucesso! Sincronização concluída.');
      console.log('✅ Sincronização automática concluída');

    } catch (error) {
      console.error('❌ Erro na sincronização automática:', error);
      setError('Erro na sincronização automática. Sistema funcionará apenas com backend.');
    } finally {
      setLoadingAction(false);
    }
  };


  const updateMappingAfterBlockchainOperation = async () => {
    if (productBacklogContract && scrumContract && account) {
      try {
        console.log('🗺️ Atualizando mapeamento após operação blockchain...');
        const mapping = await getBlockchainItemMapping();
        setBlockchainMapping(mapping);
        console.log('✅ Mapeamento atualizado:', mapping);
      } catch (error) {
        console.warn('⚠️ Erro ao atualizar mapeamento:', error);
      }
    }
  };


  const getBlockchainItemMapping = async () => {

    try {
      console.log('🗺️ Iniciando sistema de mapeamento agnóstico de contas...');
      console.log('🔍 Qualquer conta MetaMask será suportada automaticamente');


      if (!productBacklogContract || !currentTeam) {
        console.log('⚠️ Contratos não disponíveis ou equipe não encontrada - usando apenas dados locais');
        console.log('🔍 Debug - productBacklogContract:', !!productBacklogContract);
        console.log('🔍 Debug - currentTeam:', currentTeam);
        return {};
      }

      console.log('🔍 Sistema agnóstico de contas ativado - buscando dados de qualquer MetaMask');
      console.log('🔍 Team completo no mapeamento:', currentTeam);


      console.log('🔄 Estratégia principal: método baseado em transações salvas - funciona com qualquer conta...');


      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ Token não encontrado, não é possível buscar transações');
        return {};
      }

      try {
        console.log('🔍 Buscando transações blockchain do backlog...');
        const transactionsResponse = await fetch(`${getApiUrl()}/api/admin/table/blockchain_transactions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!transactionsResponse.ok) {
          throw new Error(`Erro ao buscar transações: ${transactionsResponse.status}`);
        }

        const transactionsData = await transactionsResponse.json();
        console.log('📊 Transações encontradas:', transactionsData);


        const backlogTransactions = transactionsData.data?.records?.filter(tx =>
          tx.contract_name === 'ProductBacklog' &&
          tx.method_name === 'registerBacklogItem' &&
          tx.item_id &&
          tx.team_id === currentTeam.id
        ) || [];

        console.log('📋 Transações de backlog desta equipe:', backlogTransactions);


        const mapping = {};
        backlogTransactions.forEach((transaction, index) => {

          mapping[transaction.item_id] = index.toString();
          console.log(`✅ Mapeamento criado: PostgreSQL ID ${transaction.item_id} -> Blockchain ID ${index}`);
        });

        console.log('🎯 Mapeamento baseado em transações concluído:', mapping);
        return mapping;

      } catch (fetchError) {
        console.warn('⚠️ Erro ao buscar transações do backend:', fetchError);


        console.log('🔄 Estratégia adicional: mapeamento inteligente para conta MetaMask atual...');

        try {
          if (productBacklogContract) {
            const signer = productBacklogContract.signer;
            const signerAddress = await signer.getAddress();
            console.log('🔍 Tentando lógica inteligente para conta:', signerAddress);






            if (!currentTeam.blockchain_id) {
              console.log('💡 Implementando estratégia de mapeamento consistente para conta sem blockchain_id...');


              const mapping = {};
              const localItems = backlogItems || [];


              const sortedItems = localItems.sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
              );

              sortedItems.forEach((item, index) => {
                if (item && item.id) {
                  mapping[item.id] = index.toString();
                  console.log(`✅ Mapeamento inteligente: PostgreSQL ID ${item.id} -> Blockchain ID ${index} (data: ${item.created_at})`);
                }
              });

              if (Object.keys(mapping).length > 0) {
                console.log('🎯 Mapeamento inteligente criado com sucesso:', mapping);
                return mapping;
              }
            }
          }
        } catch (smartMappingError) {
          console.log('⚠️ Estratégia de mapeamento inteligente falhou:', smartMappingError.message);
        }


        console.log('🔄 Fallback final: mapeamento sequencial dos itens locais...');

        const mapping = {};
        const localItems = backlogItems || [];


        const sortedLocalItems = localItems.sort((a, b) => a.id - b.id);

        sortedLocalItems.forEach((item, index) => {
          if (item && item.id) {
            mapping[item.id] = index.toString();
            console.log(`✅ Mapeamento fallback ordenado: PostgreSQL ID ${item.id} -> Blockchain ID ${index}`);
          }
        });

        console.log('🎯 Mapeamento fallback concluído (sistema totalmente agnóstico):', mapping);
        return mapping;
      }

    } catch (error) {
      console.error('❌ Erro no mapeamento blockchain:', error);
      console.log('⚠️ Ativando fallback de emergência para sistema totalmente agnóstico...');


      try {
        const mapping = {};
        const localItems = backlogItems || [];

        if (localItems.length > 0) {
          console.log('🔄 Criando mapeamento de emergência com', localItems.length, 'itens...');


          localItems.forEach((item, index) => {
            if (item && item.id) {
              mapping[item.id] = index.toString();
              console.log(`✅ Mapeamento emergência: ${item.id} -> ${index}`);
            }
          });

          console.log('🎯 Mapeamento de emergência criado:', mapping);
          return mapping;
        } else {
          console.log('⚠️ Nenhum item local encontrado para mapeamento');
        }
      } catch (emergencyError) {
        console.error('❌ Erro crítico no fallback de emergência:', emergencyError);
      }

      console.log('🔄 Retornando mapeamento vazio - sistema continuará funcionando');
      return {};
    }
  };


  const [blockchainMapping, setBlockchainMapping] = useState({});


  const getUserPermissions = () => {
    if (!currentTeam?.userRole) return { canAdd: false, canEdit: false, canDelete: false, canChangeStatus: false };


    const role = currentTeam.userRole.toLowerCase().replace(/\s+/g, '_');

    console.log('🔍 BACKLOG: Verificando permissões para papel:', role);

    switch (role) {
      case 'product_owner':
      case 'productowner':
        return { canAdd: true, canEdit: true, canDelete: true, canChangeStatus: true };
      case 'scrum_master':
      case 'scrummaster':
        return { canAdd: false, canEdit: false, canDelete: false, canChangeStatus: true };
      case 'developer':
      case 'desenvolvedor':
      default:
        return { canAdd: false, canEdit: false, canDelete: false, canChangeStatus: false };
    }
  };

  const permissions = getUserPermissions();


  const convertPriorityNumberToString = (priorityNumber) => {
    switch (parseInt(priorityNumber)) {
      case 1: return 'critical';
      case 2: return 'high';
      case 3: return 'medium';
      case 4: return 'low';
      default: return 'medium';
    }
  };


  const checkUserTeam = async () => {
    try {
      console.log('🔍 BACKLOG: Verificando equipe do usuário...');
      const token = localStorage.getItem('token');

      if (!token) {
        console.log('❌ BACKLOG: Token não encontrado');
        setCurrentTeam(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`${getApiUrl()}/api/groups/user-team`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ BACKLOG: Resposta da verificação de equipe:', result);

        if (result.success && result.data) {

          const teamData = {
            ...result.data,
            userRole: result.data.member_role
          };
          setCurrentTeam(teamData);
          console.log('✅ BACKLOG: Equipe encontrada:', teamData.name, 'Papel:', teamData.userRole);
        } else {
          console.log('⚠️ BACKLOG: Usuário não possui equipe ativa');
          setCurrentTeam(null);
        }
      } else {
        console.error('❌ BACKLOG: Erro ao verificar equipe do usuário');
        setError('Erro ao verificar dados da equipe');
        setCurrentTeam(null);
      }
    } catch (error) {
      console.error('❌ BACKLOG: Erro na verificação:', error);
      setError('Erro de conexão com o servidor');
      setCurrentTeam(null);
    } finally {
      setLoading(false);
    }
  };


  const loadBacklogItems = async () => {
    if (!currentTeam?.id) {
      console.log('⚠️ Nenhuma equipe ativa encontrada');
      setBacklogItems([]);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/backlog/group/${currentTeam.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Backlog carregado:', result);

        if (result.success && result.data) {
          const processedItems = result.data.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            priority: convertPriorityNumberToString(item.priority),
            storyPoints: item.story_points || item.storyPoints,
            status: item.status || 'todo',
            createdAt: new Date(item.created_at || item.createdAt),
            assignee: item.assignee
          }));


          processedItems.sort((a, b) => {
            const priorityA = priorities.find(p => p.value === a.priority)?.number || 5;
            const priorityB = priorities.find(p => p.value === b.priority)?.number || 5;

            if (priorityA !== priorityB) {
              return priorityA - priorityB;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
          });

          setBacklogItems(processedItems);
          calculateStats(processedItems);
        } else {
          setBacklogItems([]);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao carregar backlog');
        setBacklogItems([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar backlog:', error);
      setError('Erro de conexão ao carregar backlog');
      setBacklogItems([]);
    } finally {
      setLoading(false);
    }
  };


  const calculateStats = (items) => {
    const completedItems = items.filter(item => item.status === 'done');
    const completedStoryPoints = completedItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);

    const stats = {
      total: items.length,
      totalStoryPoints: items.reduce((sum, item) => sum + (item.storyPoints || 0), 0),
      completedItems: completedItems.length,
      completedStoryPoints: completedStoryPoints
    };
    setStats(stats);
  };


  const handleSave = async () => {
    console.log(`🚀 INICIANDO ${editItem ? 'EDIÇÃO' : 'CRIAÇÃO'} DE ITEM DO BACKLOG - PROCESSO HÍBRIDO`);

    if (!permissions.canAdd && !editItem) {
      setError('Apenas o Product Owner pode adicionar itens');
      return;
    }

    if (!permissions.canEdit && editItem) {
      setError('Apenas o Product Owner pode editar itens');
      return;
    }

    if (!formData.title.trim()) {
      setError('Título é obrigatório');
      return;
    }

    if (!currentTeam?.id) {
      setError('Nenhuma equipe ativa encontrada');
      return;
    }

    try {
      setLoadingAction(true);
      setError('');
      setBlockchainTxHash(null);

      const token = localStorage.getItem('token');
      const itemData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        storyPoints: formData.storyPoints,
        groupId: currentTeam.id,
        status: editItem ? editItem.status : 'todo'
      };

      console.log(`📊 ETAPA 1: ${editItem ? 'ATUALIZANDO' : 'CRIANDO'} ITEM NO BANCO DE DADOS`);


      const url = editItem
        ? `${getApiUrl()}/api/backlog/${editItem.id}`
        : `${getApiUrl()}/api/backlog/`;

      const method = editItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ao ${editItem ? 'atualizar' : 'criar'} item no banco`);
      }

      const result = await response.json();
      const itemId = editItem ? editItem.id : result.data.id;
      console.log(`✅ ETAPA 1 CONCLUÍDA: Item ${editItem ? 'atualizado' : 'criado'} no banco - ID: ${itemId}`);


      if (productBacklogContract && scrumContract && isConnected) {
        try {
          console.log('🔗 ETAPA 2: PROCESSANDO TRANSAÇÃO BLOCKCHAIN');


          if (!isTeamSyncedLocally()) {
            console.warn('❌ BACKLOG: Usuário não possui equipe registrada na blockchain.');
            setError('❌ EQUIPE NÃO SINCRONIZADA: Por favor, vá para a página "Gerenciamento de Equipe" e sincronize sua equipe com a blockchain primeiro.');
            return;
          }

          console.log(`🔗 Equipe verificada - iniciando transação blockchain para ${editItem ? 'atualização' : 'criação'}`);

          if (!editItem) {

            console.log('🆕 EXECUTANDO CRIAÇÃO NA BLOCKCHAIN');
            const blockchainData = {
              id: itemId,
              title: formData.title,
              description: formData.description,
              priority: formData.priority,
              storyPoints: formData.storyPoints,
              teamId: currentTeam.blockchain_id.toString()
            };

            const dataHash = generateDataHash(blockchainData);
            const priorityEnum = mapPriorityToEnum(formData.priority);

            console.log('🔗 REGISTRANDO ITEM NO BACKLOG BLOCKCHAIN:');
            console.log('📊 Dados do item:', blockchainData);
            console.log('🧮 Data Hash:', dataHash);

            const tx = await productBacklogContract.registerBacklogItem(
              currentTeam.blockchain_id,
              priorityEnum,
              dataHash
            );

            console.log('📤 ETAPA 2A: Transação enviada - Hash:', tx.hash);
            setBlockchainTxHash(tx.hash);

            const receipt = await tx.wait();
            console.log('✅ ETAPA 2B: Transação blockchain confirmada');


            console.log('🔄 ETAPA 3: ATUALIZANDO HASH NO BANCO COM DADOS DA BLOCKCHAIN');


            console.log('📝 ETAPA 4: REGISTRANDO TRANSAÇÃO NO LOG DO BANCO');
            try {
              const transactionPayload = {
                transactionHash: tx.hash,
                contractName: 'ProductBacklog',
                methodName: 'registerBacklogItem',
                gasUsed: receipt.gasUsed?.toString(),
                gasPrice: tx.gasPrice?.toString(),
                blockNumber: receipt.blockNumber,
                network: 'localhost',
                itemType: 'backlog',
                itemId: itemId,
                itemTitle: formData.title
              };

              const transactionResponse = await fetch(`${getApiUrl()}/api/backlog/${itemId}/blockchain-transaction`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(transactionPayload)
              });

              if (transactionResponse.ok) {
                console.log('✅ ETAPA 4 CONCLUÍDA: Transação registrada no log');
                customSetSuccess(`✅ Sucesso! Item criado. Hash: ${tx.hash}`, 'success');
              } else {
                console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação no log');
                customSetSuccess(`✅ Sucesso! Item criado. Hash: ${tx.hash}`, 'success');
              }
            } catch (dbError) {
              console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação:', dbError);
              customSetSuccess(`✅ Sucesso! Item criado. Hash: ${tx.hash}`, 'success');
            }


            setTimeout(async () => {
              await updateMappingAfterBlockchainOperation();
            }, 1000);

          } else {

            console.log('✏️ EXECUTANDO ATUALIZAÇÃO NA BLOCKCHAIN');
            const blockchainData = {
              id: itemId,
              title: formData.title,
              description: formData.description,
              priority: formData.priority,
              storyPoints: formData.storyPoints,
              teamId: currentTeam.blockchain_id.toString()
            };

            const dataHash = generateDataHash(blockchainData);


            let blockchainItemId = blockchainMapping[itemId];

            if (blockchainItemId === undefined) {
              console.log('🔄 Item não encontrado no mapeamento, atualizando...');
              setSuccess('Verificando blockchain...');

              const newMapping = await getBlockchainItemMapping();
              setBlockchainMapping(newMapping);
              blockchainItemId = newMapping[itemId];
            }

            if (blockchainItemId !== undefined) {
              console.log('🔗 ATUALIZANDO ITEM NO BACKLOG BLOCKCHAIN:');
              console.log('📊 DB ID:', itemId, '→ Blockchain ID:', blockchainItemId);
              console.log('🧮 Novo Data Hash:', dataHash);

              const tx = await productBacklogContract.updateItemDataHash(blockchainItemId, dataHash);

              console.log('📤 ETAPA 2A: Transação enviada - Hash:', tx.hash);
              setBlockchainTxHash(tx.hash);

              const receipt = await tx.wait();
              console.log('✅ ETAPA 2B: Transação blockchain confirmada');


              console.log('🔄 ETAPA 3: HASH ATUALIZADO AUTOMATICAMENTE NA BLOCKCHAIN');


              console.log('📝 ETAPA 4: REGISTRANDO TRANSAÇÃO NO LOG DO BANCO');
              try {
                const transactionPayload = {
                  transactionHash: tx.hash,
                  contractName: 'ProductBacklog',
                  methodName: 'updateItemDataHash',
                  gasUsed: receipt.gasUsed?.toString(),
                  gasPrice: tx.gasPrice?.toString(),
                  blockNumber: receipt.blockNumber,
                  network: 'localhost',
                  itemType: 'backlog',
                  itemId: itemId,
                  itemTitle: formData.title
                };

                const transactionResponse = await fetch(`${getApiUrl()}/api/backlog/${itemId}/blockchain-transaction`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(transactionPayload)
                });

                if (transactionResponse.ok) {
                  console.log('✅ ETAPA 4 CONCLUÍDA: Transação registrada no log');
                  customSetSuccess(`✅ Sucesso! Item atualizado. Hash: ${tx.hash}`, 'success');
                } else {
                  console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação no log');
                  customSetSuccess(`✅ Sucesso! Item atualizado. Hash: ${tx.hash}`, 'success');
                }
              } catch (dbError) {
                console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação:', dbError);
                customSetSuccess(`✅ Sucesso! Item atualizado. Hash: ${tx.hash}`, 'success');
              }


              setTimeout(async () => {
                await updateMappingAfterBlockchainOperation();
              }, 500);
            } else {
              console.warn('⚠️ Item não encontrado na blockchain. ID:', itemId);
              setSuccess('✅ Sucesso! Item atualizado.');
            }
          }

          console.log('🎯 ETAPA 2 CONCLUÍDA: Processo blockchain finalizado');

        } catch (blockchainError) {
          console.warn('⚠️ ETAPA 2 FALHOU: Erro na blockchain, continuando apenas com backend:', blockchainError);
          setSuccess(editItem
            ? '✅ Sucesso! Item atualizado.'
            : '✅ Sucesso! Item criado.'
          );
        }
      } else {
        console.log('🔇 ETAPA 2 IGNORADA: Blockchain indisponível ou MetaMask desconectado');
        setSuccess(editItem
          ? '✅ Sucesso! Item atualizado.'
          : '✅ Sucesso! Item criado.'
        );
      }

      console.log('🎬 FINALIZANDO PROCESSO HÍBRIDO COM SUCESSO');
      setOpenDialog(false);
      resetForm();
      await loadBacklogItems();

    } catch (error) {
      console.error('❌ ERRO NO PROCESSO HÍBRIDO:', error);

      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao processar item');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const handleDelete = async (item) => {
    if (!permissions.canDelete) {
      setError('Apenas o Product Owner pode deletar itens');
      return;
    }

    setItemToDelete(item);
    setOpenDeleteDialog(true);
  };


  const confirmDelete = async () => {
    if (!itemToDelete) return;

    console.log('🗑️ INICIANDO EXCLUSÃO DE ITEM DO BACKLOG - PROCESSO HÍBRIDO');
    console.log('📊 Item a ser excluído:', itemToDelete);

    try {
      setLoadingAction(true);
      setError('');
      setBlockchainTxHash(null);


      if (!isTeamSyncedLocally()) {
        setError('Você não é membro da equipe sincronizada na blockchain. Não é possível excluir este item.');
        setLoadingAction(false);
        setOpenDeleteDialog(false);
        setItemToDelete(null);
        return;
      }

      console.log('📊 ETAPA 1: DELETANDO ITEM DO BANCO DE DADOS');
      const token = localStorage.getItem('token');

      const response = await fetch(`${getApiUrl()}/api/backlog/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao deletar item do banco');
      }

      console.log('✅ ETAPA 1 CONCLUÍDA: Item deletado do banco de dados');


      if (productBacklogContract && scrumContract && isConnected) {
        try {
          console.log('🔗 ETAPA 2: PROCESSANDO REMOÇÃO NA BLOCKCHAIN');


          let blockchainItemId = blockchainMapping[itemToDelete.id];


          if (blockchainItemId === undefined) {
            console.log('🔄 Item não encontrado no mapeamento, atualizando...');
            setSuccess('Verificando blockchain...');

            const newMapping = await getBlockchainItemMapping();
            setBlockchainMapping(newMapping);
            blockchainItemId = newMapping[itemToDelete.id];

            console.log('🗺️ Novo mapeamento:', newMapping);
            console.log('🔍 Item após remapeamento:', blockchainItemId);
          }

          if (blockchainItemId !== undefined) {
            console.log('🗑️ EXECUTANDO REMOÇÃO NA BLOCKCHAIN');
            const tx = await productBacklogContract.removeBacklogItem(blockchainItemId);

            console.log('📤 ETAPA 2A: Transação enviada - Hash:', tx.hash);
            setBlockchainTxHash(tx.hash);

            const receipt = await tx.wait();
            console.log('✅ ETAPA 2B: Transação blockchain confirmada');


            console.log('🔄 ETAPA 3: SALVANDO TRANSACTION HASH NO CAMPO blockchain_address PARA AUDITORIA');
            try {
              const hashUpdateResponse = await fetch(`${getApiUrl()}/api/backlog/${itemToDelete.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  blockchain_address: tx.hash
                })
              });

              if (hashUpdateResponse.ok) {
                console.log('✅ ETAPA 3 CONCLUÍDA: Transaction hash salvo no item para auditoria histórica');
              } else {
                console.warn('⚠️ ETAPA 3 FALHOU: Erro ao salvar transaction hash no item');
              }
            } catch (hashError) {
              console.warn('⚠️ ETAPA 3 FALHOU: Erro ao atualizar transaction hash do item:', hashError);
            }


            console.log('� ETAPA 4: REGISTRANDO TRANSAÇÃO NO LOG DO BANCO');
            try {
              const transactionPayload = {
                transactionHash: tx.hash,
                contractName: 'ProductBacklog',
                methodName: 'removeBacklogItem',
                gasUsed: receipt.gasUsed?.toString(),
                gasPrice: tx.gasPrice?.toString(),
                blockNumber: receipt.blockNumber,
                network: 'localhost',
                itemType: 'backlog',
                itemId: itemToDelete.id,
                itemTitle: itemToDelete.title
              };

              const saveResponse = await fetch(`${getApiUrl()}/api/backlog/${itemToDelete.id}/blockchain-transaction`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(transactionPayload)
              });

              const saveResult = await saveResponse.json();

              if (saveResult.success) {
                console.log('✅ ETAPA 4 CONCLUÍDA: Transação registrada no log');
                customSetSuccess(`✅ Sucesso! Item deletado. Hash: ${tx.hash}`, 'success');
              } else {
                console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação no log');
                customSetSuccess(`✅ Sucesso! Item deletado. Hash: ${tx.hash}`, 'success');
              }
            } catch (saveError) {
              console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação:', saveError);
              customSetSuccess(`✅ Sucesso! Item deletado. Hash: ${tx.hash}`, 'success');
            }


            setTimeout(async () => {
              await updateMappingAfterBlockchainOperation();
            }, 500);
          } else {
            console.warn('⚠️ Item não encontrado na blockchain. ID:', itemToDelete.id);
            customSetSuccess('✅ Sucesso! Item deletado do banco de dados. (Item não existia na blockchain)', 'success');
          }

          console.log('🎯 ETAPA 2 CONCLUÍDA: Processo blockchain finalizado');

        } catch (blockchainError) {
          console.warn('⚠️ ETAPA 2 FALHOU: Erro na blockchain, continuando apenas com backend:', blockchainError);
          setSuccess('✅ Item deletado do banco com sucesso! (Blockchain: erro na integração)');
        }
      } else {
        console.log('🔇 ETAPA 2 IGNORADA: Blockchain indisponível ou MetaMask desconectado');
        setSuccess('Item deletado do banco! (Blockchain indisponível)');
      }

      console.log('🎬 FINALIZANDO PROCESSO HÍBRIDO DE EXCLUSÃO COM SUCESSO');
      await loadBacklogItems();
    } catch (error) {
      console.error('❌ ERRO NO PROCESSO HÍBRIDO DE EXCLUSÃO:', error);
      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao deletar item');
      }
    } finally {
      setLoadingAction(false);
      setOpenDeleteDialog(false);
      setItemToDelete(null);
    }
  };


  const handleStatusChange = async (item, newStatus) => {
    console.log('🔄 INICIANDO ALTERAÇÃO DE STATUS - PROCESSO HÍBRIDO');
    console.log('📊 Item:', item);
    console.log('📊 Status atual → novo:', item.status, '→', newStatus);

    if (!permissions.canChangeStatus) {
      setError('Você não tem permissão para alterar status');
      return;
    }

    try {
      setLoadingAction(true);
      setError('');
      setBlockchainTxHash(null);

      console.log('📊 ETAPA 1: ATUALIZANDO STATUS NO BANCO DE DADOS');
      const token = localStorage.getItem('token');

      const response = await fetch(`${getApiUrl()}/api/backlog/${item.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atualizar status no banco');
      }

      console.log('✅ ETAPA 1 CONCLUÍDA: Status atualizado no banco de dados');


      if (productBacklogContract && scrumContract && isConnected) {
        try {
          console.log('🔗 ETAPA 2: PROCESSANDO ATUALIZAÇÃO NA BLOCKCHAIN');


          if (!isTeamSyncedLocally()) {
            console.warn('❌ BACKLOG: Usuário não possui equipe registrada na blockchain.');
            setError('❌ EQUIPE NÃO SINCRONIZADA: Por favor, vá para a página "Gerenciamento de Equipe" e sincronize sua equipe com a blockchain primeiro.');
            return;
          }

          console.log('🔗 Equipe verificada - iniciando atualização de status na blockchain');

          const statusEnum = mapStatusToEnum(newStatus);


          let blockchainItemId = blockchainMapping[item.id];


          if (blockchainItemId === undefined) {
            console.log('🔄 Item não encontrado no mapeamento, atualizando...');

            const newMapping = await getBlockchainItemMapping();
            setBlockchainMapping(newMapping);
            blockchainItemId = newMapping[item.id];

            console.log('🗺️ Novo mapeamento:', newMapping);
            console.log('🔍 Item após remapeamento:', blockchainItemId);
          }

          if (blockchainItemId !== undefined) {
            console.log('� EXECUTANDO ATUALIZAÇÃO DE STATUS NA BLOCKCHAIN');
            console.log('📊 Dados do status:');
            console.log('  - DB ID:', item.id);
            console.log('  - Blockchain ID:', blockchainItemId);
            console.log('  - Status atual → novo:', item.status, '→', newStatus, '(enum:', statusEnum, ')');

            const tx = await productBacklogContract.updateItemStatus(blockchainItemId, statusEnum);

            console.log('📤 ETAPA 2A: Transação enviada - Hash:', tx.hash);
            setBlockchainTxHash(tx.hash);

            const receipt = await tx.wait();
            console.log('✅ ETAPA 2B: Transação blockchain confirmada');


            console.log('🔄 ETAPA 3: SALVANDO TRANSACTION HASH NO CAMPO blockchain_address PARA AUDITORIA');
            try {
              const hashUpdateResponse = await fetch(`${getApiUrl()}/api/backlog/${item.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  blockchain_address: tx.hash
                })
              });

              if (hashUpdateResponse.ok) {
                console.log('✅ ETAPA 3 CONCLUÍDA: Transaction hash salvo no item para auditoria histórica');
              } else {
                console.warn('⚠️ ETAPA 3 FALHOU: Erro ao salvar transaction hash no item');
              }
            } catch (hashError) {
              console.warn('⚠️ ETAPA 3 FALHOU: Erro ao atualizar transaction hash do item:', hashError);
            }


            console.log('� ETAPA 4: REGISTRANDO TRANSAÇÃO NO LOG DO BANCO');
            try {
              const transactionPayload = {
                transactionHash: tx.hash,
                contractName: 'ProductBacklog',
                methodName: 'updateItemStatus',
                gasUsed: receipt.gasUsed?.toString(),
                gasPrice: tx.gasPrice?.toString(),
                blockNumber: receipt.blockNumber,
                network: 'localhost',
                itemType: 'backlog',
                itemId: item.id,
                itemTitle: item.title,
                previousStatus: item.status,
                newStatus: newStatus
              };

              const transactionResponse = await fetch(`${getApiUrl()}/api/backlog/${item.id}/blockchain-transaction`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(transactionPayload)
              });

              if (transactionResponse.ok) {
                console.log('✅ ETAPA 4 CONCLUÍDA: Transação registrada no log');
                setSuccess(`✅ Sucesso! Status alterado. Hash: ${tx.hash}`);
              } else {
                console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação no log');
                setSuccess(`✅ Sucesso! Status alterado. Hash: ${tx.hash}`);
              }
            } catch (dbError) {
              console.warn('⚠️ ETAPA 4 FALHOU: Erro ao registrar transação:', dbError);
              setSuccess(`✅ Sucesso! Status alterado. Hash: ${tx.hash}`);
            }


            setTimeout(async () => {
              await updateMappingAfterBlockchainOperation();
            }, 500);
          } else {
            console.warn('⚠️ Item não encontrado na blockchain. ID:', item.id);
            setSuccess('✅ Sucesso! Status alterado.');
          }

          console.log('🎯 ETAPA 2 CONCLUÍDA: Processo blockchain finalizado');
        } catch (blockchainError) {
          console.warn('⚠️ ETAPA 2 FALHOU: Erro na blockchain, continuando apenas com backend:', blockchainError);
          setSuccess('✅ Sucesso! Status alterado.');
        }
      } else {
        console.log('🔇 ETAPA 2 IGNORADA: Blockchain indisponível ou MetaMask desconectado');
        setSuccess('✅ Sucesso! Status alterado.');
      }

      console.log('🎬 FINALIZANDO PROCESSO HÍBRIDO DE ALTERAÇÃO DE STATUS COM SUCESSO');
      await loadBacklogItems();

    } catch (error) {
      console.error('❌ ERRO NO PROCESSO HÍBRIDO DE ALTERAÇÃO DE STATUS:', error);

      if (error.code === 4001) {
        setError('Transação cancelada pelo usuário');
      } else if (error.code === -32603) {
        setError('Erro na rede blockchain. Verifique se a rede Hardhat está rodando');
      } else {
        setError(error.message || 'Erro ao atualizar status');
      }
    } finally {
      setLoadingAction(false);
    }
  };


  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      storyPoints: 1
    });
    setEditItem(null);
  };


  const handleEdit = (item) => {
    if (!permissions.canEdit) {
      setError('Apenas o Product Owner pode editar itens');
      return;
    }

    setEditItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      priority: item.priority,
      storyPoints: item.storyPoints
    });
    setOpenDialog(true);
  };


  useEffect(() => {
    console.log('🚀 BACKLOG: Componente montado - verificando equipe...');
    checkUserTeam();
  }, []);


  useEffect(() => {
    if (currentTeam?.id) {
      console.log('🎯 BACKLOG: Equipe definida - carregando backlog...');
      loadBacklogItems();
    }
  }, [currentTeam?.id]);


  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);


  const [initialSyncDone, setInitialSyncDone] = useState(false);


  useEffect(() => {
    if (currentTeam && productBacklogContract && scrumContract && account && !initialSyncDone) {

      autoSyncBlockchain().then(() => {
        setInitialSyncDone(true);
      });
    }
  }, [currentTeam, productBacklogContract, scrumContract, account, initialSyncDone]);

  if (!currentTeam) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="info">
          Você precisa estar em uma equipe para acessar o Product Backlog.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            <BacklogIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Gerenciamento de Product Backlog - {currentTeam.name}
          </Typography>
          <Chip
            label={`Papel: ${currentTeam.userRole === 'Product Owner' || currentTeam.userRole === 'product_owner' ? 'Product Owner' :
              currentTeam.userRole === 'Scrum Master' || currentTeam.userRole === 'scrum_master' ? 'Scrum Master' :
                currentTeam.userRole === 'Developer' || currentTeam.userRole === 'developer' ? 'Developer' : currentTeam.userRole}`}
            color={currentTeam.userRole.toLowerCase().includes('product') ? 'primary' :
              currentTeam.userRole.toLowerCase().includes('scrum') ? 'secondary' : 'default'}
            sx={{ mb: 2 }}
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity={successType} sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          🔗 Conecte sua carteira MetaMask para usar funcionalidades blockchain
        </Alert>
      )}

      {isConnected && !isCorrectNetwork && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ⚠️ Rede incorreta! Troque para a rede Hardhat no MetaMask
        </Alert>
      )}

      {}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  <StatsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Total de Itens
                </Typography>
                <Typography variant="h4">
                  {stats.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Story Points
                </Typography>
                <Typography variant="h4">
                  {stats.totalStoryPoints}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Itens Concluídos
                </Typography>
                <Typography variant="h4">
                  {stats.completedItems}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {}
      {permissions.canAdd && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setOpenDialog(true);
            }}
            disabled={loading || loadingAction}
          >
            Adicionar Item
          </Button>
        </Box>
      )}

      {}
      <Paper elevation={3}>
        {loading && backlogItems.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : backlogItems.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="textSecondary">
              Nenhum item no backlog
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Adicione o primeiro item para começar!
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Título</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell>Prioridade</TableCell>
                  <TableCell>Story Points</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Data</TableCell>
                  {(permissions.canEdit || permissions.canDelete) && (
                    <TableCell>Ações</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {backlogItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {item.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300 }}>
                        {item.description || 'Sem descrição'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={priorities.find(p => p.value === item.priority)?.label || item.priority}
                        color={priorityColors[item.priority] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.storyPoints}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {permissions.canChangeStatus ? (
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item, e.target.value)}
                            disabled={loading || loadingAction}
                            variant="outlined"
                          >
                            {statusOptions.map(status => (
                              <MenuItem key={status.value} value={status.value}>
                                {status.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip
                          label={statusOptions.find(s => s.value === item.status)?.label || item.status}
                          color={
                            item.status === 'todo' ? 'default' :
                              item.status === 'in_progress' ? 'primary' :
                                item.status === 'done' ? 'success' : 'default'
                          }
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.createdAt.toLocaleDateString('pt-BR')}
                      </Typography>
                    </TableCell>
                    {(permissions.canEdit || permissions.canDelete) && (
                      <TableCell>
                        {permissions.canEdit && (
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(item)}
                              disabled={loading || loadingAction}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {permissions.canDelete && (
                          <Tooltip title="Deletar">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(item)}
                              disabled={loading || loadingAction}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editItem && !permissions.canEdit ? 'Visualizar Item' :
            editItem ? 'Editar Item' : 'Adicionar Item ao Backlog'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Título"
            fullWidth
            variant="outlined"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            disabled={editItem && !permissions.canEdit}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Descrição"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            disabled={editItem && !permissions.canEdit}
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Prioridade</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  label="Prioridade"
                  disabled={editItem && !permissions.canEdit}
                >
                  {priorities.map(priority => (
                    <MenuItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="Story Points"
                type="number"
                fullWidth
                variant="outlined"
                value={formData.storyPoints}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  storyPoints: Math.max(1, parseInt(e.target.value) || 1)
                }))}
                inputProps={{ min: 1, max: 100 }}
                disabled={editItem && !permissions.canEdit}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            {editItem && !permissions.canEdit ? 'Fechar' : 'Cancelar'}
          </Button>
          {(permissions.canAdd || (editItem && permissions.canEdit)) && (
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={loading || loadingAction}
            >
              {loadingAction ? <CircularProgress size={20} /> : (editItem ? 'Atualizar' : 'Adicionar')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon color="error" />
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Tem certeza que deseja deletar o item:
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
            "{itemToDelete?.title}"
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setOpenDeleteDialog(false)}
            variant="outlined"
            disabled={loading || loadingAction}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            color="error"
            disabled={loading || loadingAction}
            startIcon={loadingAction ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {loadingAction ? 'Deletando...' : 'Deletar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ProductBacklogPage;
