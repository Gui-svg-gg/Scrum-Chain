const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SprintService = require('./SprintService');
const BlockchainTransactionService = require('./BlockchainTransactionService');

class SprintBlockchainService {
  constructor() {
    this.provider = null;
    this.sprintContract = null;
    this.signer = null;
    this.initialized = false;
  }


  async initialize() {
    try {
      this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545');
      
      const privateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      this.signer = new ethers.Wallet(privateKey, this.provider);
      

      const contractAddressesPath = path.join(__dirname, '../../frontend/src/contracts/contract-addresses.json');
      const contractAddresses = JSON.parse(fs.readFileSync(contractAddressesPath, 'utf8'));
      

      const sprintAbiPath = path.join(__dirname, '../../frontend/src/contracts/SprintManagement.json');
      const sprintAbi = JSON.parse(fs.readFileSync(sprintAbiPath, 'utf8')).abi;
      

      this.sprintContract = new ethers.Contract(
        contractAddresses.SprintManagement,
        sprintAbi,
        this.signer
      );
      
      this.initialized = true;
      console.log('✅ SprintBlockchainService inicializado com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar SprintBlockchainService:', error);
      throw error;
    }
  }


  generateDataHash(sprintData) {
    const dataString = JSON.stringify({
      name: sprintData.name,
      description: sprintData.description,
      startDate: sprintData.startDate,
      endDate: sprintData.endDate
    });
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
  }


  async registerSprintOnBlockchain(sprint, groupId, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('⛓️ Registrando sprint existente na blockchain...');
      
      const dataHash = this.generateDataHash({
        name: sprint.name,
        description: sprint.description,
        startDate: sprint.start_date,
        endDate: sprint.end_date
      });
      
      const startTimestamp = Math.floor(new Date(sprint.start_date).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(sprint.end_date).getTime() / 1000);
      

      console.log('📝 Chamando contrato registerSprint...');
      const tx = await this.sprintContract.registerSprint(
        groupId,
        startTimestamp,
        endTimestamp,
        dataHash
      );


      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'sprint_create',
        contractName: 'SprintManagement',
        methodName: 'registerSprint',
        description: `Registro blockchain do sprint: ${sprint.name}`,
        userAddress: userAddress,
        userId: userId,
        teamId: groupId,
        itemId: sprint.id,
        network: 'localhost',
        status: 'pending'
      });

      console.log('⏳ Aguardando confirmação da transação...');
      const receipt = await tx.wait();


      await BlockchainTransactionService.updateStatus(
        tx.hash,
        'confirmed',
        receipt.blockNumber,
        receipt.gasUsed.toString()
      );


      const event = receipt.logs.find(log => {
        try {
          const parsedLog = this.sprintContract.interface.parseLog(log);
          return parsedLog.name === 'SprintRegistered';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedLog = this.sprintContract.interface.parseLog(event);
        const blockchainSprintId = parsedLog.args.sprintId.toString();
        
        await SprintService.updateSprint(sprint.id, {
          blockchain_address: blockchainSprintId
        });

        console.log('✅ Sprint registrado na blockchain - PostgreSQL ID:', sprint.id, 'Blockchain ID:', blockchainSprintId);
      }

      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error('❌ Erro ao registrar sprint na blockchain:', error);
      throw error;
    }
  }

  async createSprint(groupId, sprintData, createdBy, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🚀 Criando sprint - PostgreSQL + Blockchain');
      
      const dbSprint = await SprintService.createSprint(groupId, sprintData, createdBy);
      console.log('✅ Sprint criado no PostgreSQL:', dbSprint.id);

      const dataHash = this.generateDataHash(sprintData);
      
      const startTimestamp = Math.floor(new Date(sprintData.startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(sprintData.endDate).getTime() / 1000);
      
      console.log('📝 Registrando sprint na blockchain...');
      const tx = await this.sprintContract.registerSprint(
        groupId,
        startTimestamp,
        endTimestamp,
        dataHash
      );

      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'sprint_create',
        contractName: 'SprintManagement',
        methodName: 'registerSprint',
        description: `Criação do sprint: ${sprintData.name}`,
        userAddress: userAddress,
        userId: createdBy,
        teamId: groupId,
        itemId: dbSprint.id,
        network: 'localhost',
        status: 'pending'
      });

      console.log('⏳ Aguardando confirmação da transação...');
      const receipt = await tx.wait();

      await BlockchainTransactionService.updateStatus(
        tx.hash,
        'confirmed',
        receipt.blockNumber,
        receipt.gasUsed.toString()
      );

      const event = receipt.logs.find(log => {
        try {
          const parsedLog = this.sprintContract.interface.parseLog(log);
          return parsedLog.name === 'SprintRegistered';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedLog = this.sprintContract.interface.parseLog(event);
        const blockchainSprintId = parsedLog.args.sprintId.toString();
        
        await SprintService.updateSprint(dbSprint.id, {
          blockchain_address: blockchainSprintId
        });

        console.log('✅ Sprint sincronizado - PostgreSQL ID:', dbSprint.id, 'Blockchain ID:', blockchainSprintId);
      }

      return {
        ...dbSprint,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao criar sprint:', error);
      throw error;
    }
  }


  async updateSprintStatus(sprintId, newStatus, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🔄 Atualizando status do sprint:', sprintId, 'para:', newStatus);

      const dbSprint = await SprintService.getSprintById(sprintId);
      if (!dbSprint || !dbSprint.blockchain_address) {
        throw new Error('Sprint não encontrado ou não sincronizado com blockchain');
      }

      const statusMap = {
        'planning': 0,
        'active': 1,
        'completed': 2,
        'cancelled': 3
      };

      const blockchainStatus = statusMap[newStatus];
      if (blockchainStatus === undefined) {
        throw new Error('Status inválido');
      }

      console.log('📝 Atualizando status na blockchain...');
      const tx = await this.sprintContract.updateSprintStatus(
        dbSprint.blockchain_address,
        blockchainStatus
      );

      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'sprint_status_update',
        contractName: 'SprintManagement',
        methodName: 'updateSprintStatus',
        description: `Alteração de status do sprint para: ${newStatus}`,
        userAddress: userAddress,
        userId: userId,
        teamId: dbSprint.group_id,
        itemId: sprintId,
        network: 'localhost',
        status: 'pending'
      });

      console.log('⏳ Aguardando confirmação da transação...');
      const receipt = await tx.wait();

      await BlockchainTransactionService.updateStatus(
        tx.hash,
        'confirmed',
        receipt.blockNumber,
        receipt.gasUsed.toString()
      );

      const updatedSprint = await SprintService.updateSprint(sprintId, { status: newStatus });

      console.log('✅ Status do sprint atualizado com sucesso');
      
      return {
        ...updatedSprint,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao atualizar status do sprint:', error);
      throw error;
    }
  }


  async updateSprint(sprintId, sprintData, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('✏️ Editando sprint:', sprintId);

      const dbSprint = await SprintService.getSprintById(sprintId);
      if (!dbSprint || !dbSprint.blockchain_address) {
        throw new Error('Sprint não encontrado ou não sincronizado com blockchain');
      }

      const updatedSprint = await SprintService.updateSprint(sprintId, sprintData);

      const newDataHash = this.generateDataHash({
        name: updatedSprint.name,
        description: updatedSprint.description,
        startDate: updatedSprint.start_date,
        endDate: updatedSprint.end_date
      });

      console.log('📝 Atualizando hash dos dados na blockchain...');
      const tx = await this.sprintContract.updateSprintDataHash(
        dbSprint.blockchain_address,
        newDataHash
      );

      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'sprint_edit',
        contractName: 'SprintManagement',
        methodName: 'updateSprintDataHash',
        description: `Edição do sprint: ${updatedSprint.name}`,
        userAddress: userAddress,
        userId: userId,
        teamId: updatedSprint.group_id,
        itemId: sprintId,
        network: 'localhost',
        status: 'pending'
      });

      console.log('⏳ Aguardando confirmação da transação...');
      const receipt = await tx.wait();

      await BlockchainTransactionService.updateStatus(
        tx.hash,
        'confirmed',
        receipt.blockNumber,
        receipt.gasUsed.toString()
      );

      console.log('✅ Sprint editado com sucesso');

      return {
        ...updatedSprint,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao editar sprint:', error);
      throw error;
    }
  }


  async deleteSprint(sprintId, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🗑️ Removendo sprint:', sprintId);

      const dbSprint = await SprintService.getSprintById(sprintId);
      if (!dbSprint || !dbSprint.blockchain_address) {
        throw new Error('Sprint não encontrado ou não sincronizado com blockchain');
      }

      console.log('📝 Removendo sprint da blockchain...');
      const tx = await this.sprintContract.removeSprint(dbSprint.blockchain_address);

      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'sprint_delete',
        contractName: 'SprintManagement',
        methodName: 'removeSprint',
        description: `Remoção do sprint: ${dbSprint.name}`,
        userAddress: userAddress,
        userId: userId,
        teamId: dbSprint.group_id,
        itemId: sprintId,
        network: 'localhost',
        status: 'pending'
      });

      console.log('⏳ Aguardando confirmação da transação...');
      const receipt = await tx.wait();

      await BlockchainTransactionService.updateStatus(
        tx.hash,
        'confirmed',
        receipt.blockNumber,
        receipt.gasUsed.toString()
      );

      const deletedSprint = await SprintService.deleteSprint(sprintId);

      console.log('✅ Sprint removido com sucesso');

      return {
        ...deletedSprint,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao remover sprint:', error);
      throw error;
    }
  }


  async syncExistingSprint(sprintId, groupId, userAddress, userId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🔄 Sincronizando sprint existente com blockchain:', sprintId);

      const dbSprint = await SprintService.getSprintById(sprintId);
      if (!dbSprint) {
        throw new Error('Sprint não encontrado');
      }

      if (dbSprint.blockchain_address) {
        console.log('⚠️ Sprint já está sincronizado com blockchain');
        return dbSprint;
      }

      const dataHash = this.generateDataHash(dbSprint);
      const startTimestamp = Math.floor(new Date(dbSprint.start_date).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(dbSprint.end_date).getTime() / 1000);

      const tx = await this.sprintContract.registerSprint(
        groupId,
        startTimestamp,
        endTimestamp,
        dataHash
      );

      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          const parsedLog = this.sprintContract.interface.parseLog(log);
          return parsedLog.name === 'SprintRegistered';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedLog = this.sprintContract.interface.parseLog(event);
        const blockchainSprintId = parsedLog.args.sprintId.toString();

        const updatedSprint = await SprintService.updateSprint(sprintId, {
          blockchain_address: blockchainSprintId
        });

        console.log('✅ Sprint sincronizado com sucesso');
        return updatedSprint;
      }

      throw new Error('Evento de registro não encontrado');

    } catch (error) {
      console.error('❌ Erro ao sincronizar sprint:', error);
      throw error;
    }
  }
}

module.exports = new SprintBlockchainService();
