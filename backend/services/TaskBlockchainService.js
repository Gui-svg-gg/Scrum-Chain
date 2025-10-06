const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const TaskService = require('./TaskService');
const BlockchainTransactionService = require('./BlockchainTransactionService');
const TimeUtils = require('../utils/TimeUtils');

class TaskBlockchainService {
  constructor() {
    this.provider = null;
    this.taskContract = null;
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


      const taskAbiPath = path.join(__dirname, '../../frontend/src/contracts/TaskManagement.json');
      const taskAbi = JSON.parse(fs.readFileSync(taskAbiPath, 'utf8')).abi;


      this.taskContract = new ethers.Contract(
        contractAddresses.TaskManagement,
        taskAbi,
        this.signer
      );

      this.initialized = true;
      console.log('✅ TaskBlockchainService inicializado com sucesso');

    } catch (error) {
      console.error('❌ Erro ao inicializar TaskBlockchainService:', error);
      throw error;
    }
  }


  generateDataHash(taskData) {
    const dataString = JSON.stringify({
      title: taskData.title,
      description: taskData.description,
      estimatedMinutes: taskData.estimatedMinutes || TimeUtils.normalizeToMinutes(taskData.estimatedHours)
    });
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
  }


  async createTask(taskData, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🚀 Criando tarefa - PostgreSQL + Blockchain');


      const createdTask = await TaskService.createTask(taskData);
      console.log('✅ Tarefa criada no PostgreSQL:', createdTask.id);


      const dataHash = this.generateDataHash(taskData);


      const blockchainSprintId = taskData.blockchainSprintId || taskData.sprintId;


      let assignedToAddress = ethers.ZeroAddress;
      if (taskData.assignedTo && taskData.assignedToAddress) {
        assignedToAddress = taskData.assignedToAddress;
      }


      const estimatedMinutes = taskData.estimatedHours ? Math.floor(taskData.estimatedHours * 60) : 0;


      console.log('📝 Registrando tarefa na blockchain...');
      const tx = await this.taskContract.registerTask(
        blockchainSprintId,
        assignedToAddress,
        estimatedMinutes,
        dataHash
      );


      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'task_create',
        contractName: 'TaskManagement',
        methodName: 'registerTask',
        description: `Criação da tarefa: ${taskData.title}`,
        userAddress: userAddress,
        userId: userId,
        teamId: taskData.groupId,
        itemId: createdTask.id,
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
          const parsedLog = this.taskContract.interface.parseLog(log);
          return parsedLog.name === 'TaskRegistered';
        } catch {
          return false;
        }
      });

      let blockchainTaskId = null;
      if (event) {
        const parsedLog = this.taskContract.interface.parseLog(event);
        blockchainTaskId = parsedLog.args.taskId.toString();


        await TaskService.updateTask(createdTask.id, {
          blockchain_address: blockchainTaskId
        });

        console.log('✅ Tarefa sincronizada - PostgreSQL ID:', createdTask.id, 'Blockchain ID:', blockchainTaskId);
      }

      return {
        id: createdTask.id,
        blockchainTaskId: blockchainTaskId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao criar tarefa:', error);
      throw error;
    }
  }


  async updateTaskStatus(taskId, newStatus, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🔄 Atualizando status da tarefa:', taskId, 'para:', newStatus);


      const dbTask = await TaskService.getTaskById(taskId);
      if (!dbTask || !dbTask.blockchain_address) {
        throw new Error('Tarefa não encontrada ou não sincronizada com blockchain');
      }


      try {
        const isMember = await this.scrumContract.isMember(dbTask.group_id, userAddress);
        if (!isMember) {
          console.warn('⚠️ Usuário não é membro da equipe na blockchain, registrando...');


          try {
            const groupHash = this.generateDataHash({
              name: `Group ${dbTask.group_id}`,
              description: 'Auto-registered group for task update',
              createdBy: userAddress
            });

            const registerTx = await this.scrumContract.registerTeam(groupHash);
            await registerTx.wait();
            console.log('✅ Usuário registrado na equipe da blockchain');
          } catch (registerError) {
            if (registerError.message && registerError.message.includes('User already belongs to a team')) {
              console.log('✅ Usuário já pertence a uma equipe');
            } else {
              console.warn('⚠️ Erro ao registrar usuário na equipe:', registerError.message);
              throw new Error('Usuário não tem permissão na blockchain para atualizar esta tarefa');
            }
          }
        }
      } catch (blockchainCheckError) {
        console.warn('⚠️ Erro ao verificar membro da equipe na blockchain:', blockchainCheckError.message);
        throw new Error('Erro ao verificar permissões na blockchain');
      }


      const statusMap = {
        'todo': 0,
        'in_progress': 1,
        'review': 2,
        'done': 3,
        'removed': 4
      };

      const blockchainStatus = statusMap[newStatus];
      if (blockchainStatus === undefined) {
        throw new Error('Status inválido');
      }


      console.log('📝 Atualizando status na blockchain...');
      const tx = await this.taskContract.updateTaskStatus(
        dbTask.blockchain_address,
        blockchainStatus
      );


      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'task_status_update',
        contractName: 'TaskManagement',
        methodName: 'updateTaskStatus',
        description: `Alteração de status da tarefa para: ${newStatus}`,
        userAddress: userAddress,
        userId: userId,
        teamId: dbTask.group_id,
        itemId: taskId,
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


      const updatedTask = await TaskService.updateTaskStatus(taskId, newStatus);

      console.log('✅ Status da tarefa atualizado com sucesso');

      return {
        ...updatedTask,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao atualizar status da tarefa:', error);
      throw error;
    }
  }


  async updateTask(taskId, taskData, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('✏️ Editando tarefa:', taskId);


      const dbTask = await TaskService.getTaskById(taskId);
      if (!dbTask || !dbTask.blockchain_address) {
        throw new Error('Tarefa não encontrada ou não sincronizada com blockchain');
      }


      try {
        const isMember = await this.scrumContract.isMember(dbTask.group_id, userAddress);
        if (!isMember) {
          console.warn('⚠️ Usuário não é membro da equipe na blockchain, registrando...');


          try {
            const groupHash = this.generateDataHash({
              name: `Group ${dbTask.group_id}`,
              description: 'Auto-registered group for task update',
              createdBy: userAddress
            });

            const registerTx = await this.scrumContract.registerTeam(groupHash);
            await registerTx.wait();
            console.log('✅ Usuário registrado na equipe da blockchain');
          } catch (registerError) {
            if (registerError.message && registerError.message.includes('User already belongs to a team')) {
              console.log('✅ Usuário já pertence a uma equipe');
            } else {
              console.warn('⚠️ Erro ao registrar usuário na equipe:', registerError.message);
              throw new Error('Usuário não tem permissão na blockchain para editar esta tarefa');
            }
          }
        }
      } catch (blockchainCheckError) {
        console.warn('⚠️ Erro ao verificar membro da equipe na blockchain:', blockchainCheckError.message);
        throw new Error('Erro ao verificar permissões na blockchain');
      }


      const updatedTask = await TaskService.updateTask(taskId, taskData);


      const newDataHash = this.generateDataHash({
        title: updatedTask.title,
        description: updatedTask.description,
        estimatedMinutes: updatedTask.estimated_minutes
      });


      console.log('📝 Atualizando hash dos dados na blockchain...');
      const tx = await this.taskContract.updateTaskDataHash(
        dbTask.blockchain_address,
        newDataHash
      );


      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'task_edit',
        contractName: 'TaskManagement',
        methodName: 'updateTaskDataHash',
        description: `Edição da tarefa: ${updatedTask.title}`,
        userAddress: userAddress,
        userId: userId,
        teamId: updatedTask.group_id,
        itemId: taskId,
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

      console.log('✅ Tarefa editada com sucesso');

      return {
        ...updatedTask,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao editar tarefa:', error);
      throw error;
    }
  }

  async assignTask(taskId, assignedToUserId, assignedToAddress, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('👤 Atribuindo tarefa:', taskId, 'para:', assignedToUserId);


      const dbTask = await TaskService.getTaskById(taskId);
      if (!dbTask || !dbTask.blockchain_address) {
        throw new Error('Tarefa não encontrada ou não sincronizada com blockchain');
      }


      console.log('📝 Atualizando atribuição na blockchain...');
      const newAssigneeAddress = assignedToAddress || ethers.ZeroAddress;
      const tx = await this.taskContract.assignTask(
        dbTask.blockchain_address,
        newAssigneeAddress
      );


      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'task_assign',
        contractName: 'TaskManagement',
        methodName: 'assignTask',
        description: `Atribuição de tarefa`,
        userAddress: userAddress,
        userId: userId,
        teamId: dbTask.group_id,
        itemId: taskId,
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


      const updatedTask = await TaskService.updateTask(taskId, {
        assigned_to: assignedToUserId
      });

      console.log('✅ Tarefa atribuída com sucesso');

      return {
        ...updatedTask,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao atribuir tarefa:', error);
      throw error;
    }
  }


  async deleteTask(taskId, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🗑️ Removendo tarefa:', taskId);


      const dbTask = await TaskService.getTaskById(taskId);
      if (!dbTask || !dbTask.blockchain_address) {
        throw new Error('Tarefa não encontrada ou não sincronizada com blockchain');
      }


      try {
        const isMember = await this.scrumContract.isMember(dbTask.group_id, userAddress);
        if (!isMember) {
          console.warn('⚠️ Usuário não é membro da equipe na blockchain, registrando...');


          try {
            const groupHash = this.generateDataHash({
              name: `Group ${dbTask.group_id}`,
              description: 'Auto-registered group for task deletion',
              createdBy: userAddress
            });

            const registerTx = await this.scrumContract.registerTeam(groupHash);
            await registerTx.wait();
            console.log('✅ Usuário registrado na equipe da blockchain');
          } catch (registerError) {
            if (registerError.message && registerError.message.includes('User already belongs to a team')) {
              console.log('✅ Usuário já pertence a uma equipe');
            } else {
              console.warn('⚠️ Erro ao registrar usuário na equipe:', registerError.message);
              throw new Error('Usuário não tem permissão na blockchain para deletar esta tarefa');
            }
          }
        }
      } catch (blockchainCheckError) {
        console.warn('⚠️ Erro ao verificar membro da equipe na blockchain:', blockchainCheckError.message);
        throw new Error('Erro ao verificar permissões na blockchain');
      }


      console.log('📝 Removendo tarefa da blockchain...');
      const tx = await this.taskContract.removeTask(dbTask.blockchain_address);


      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'task_delete',
        contractName: 'TaskManagement',
        methodName: 'removeTask',
        description: `Remoção da tarefa: ${dbTask.title}`,
        userAddress: userAddress,
        userId: userId,
        teamId: dbTask.group_id,
        itemId: taskId,
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


      const deletedTask = await TaskService.deleteTask(taskId);

      console.log('✅ Tarefa removida com sucesso');

      return {
        ...deletedTask,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('❌ Erro ao remover tarefa:', error);
      throw error;
    }
  }


  async startTask(taskId, userId, userAddress) {
    return this.updateTaskStatus(taskId, 'in_progress', userId, userAddress);
  }


  async completeTask(taskId, userId, userAddress) {
    return this.updateTaskStatus(taskId, 'done', userId, userAddress);
  }


  async syncExistingTask(taskId, sprintBlockchainId, userAddress, userId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🔄 Sincronizando tarefa existente com blockchain:', taskId);


      const dbTask = await TaskService.getTaskById(taskId);
      if (!dbTask) {
        throw new Error('Tarefa não encontrada');
      }


      if (dbTask.blockchain_address) {
        console.log('⚠️ Tarefa já está sincronizada com blockchain');
        return dbTask;
      }


      const dataHash = this.generateDataHash(dbTask);
      const assignedToAddress = ethers.ZeroAddress;
      const estimatedMinutes = dbTask.estimated_minutes || 0;

      const tx = await this.taskContract.registerTask(
        sprintBlockchainId,
        assignedToAddress,
        estimatedMinutes,
        dataHash
      );

      const receipt = await tx.wait();


      const event = receipt.logs.find(log => {
        try {
          const parsedLog = this.taskContract.interface.parseLog(log);
          return parsedLog.name === 'TaskRegistered';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedLog = this.taskContract.interface.parseLog(event);
        const blockchainTaskId = parsedLog.args.taskId.toString();


        const updatedTask = await TaskService.updateTask(taskId, {
          blockchain_address: blockchainTaskId
        });

        console.log('✅ Tarefa sincronizada com sucesso');
        return updatedTask;
      }

      throw new Error('Evento de registro não encontrado');

    } catch (error) {
      console.error('❌ Erro ao sincronizar tarefa:', error);
      throw error;
    }
  }


  async registerTask(task, userId, userAddress) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('📝 Registrando tarefa na blockchain:', task.id);


      if (task.blockchain_address) {
        console.log('⚠️ Tarefa já está registrada na blockchain');
        return task;
      }


      const dataHash = this.generateDataHash({
        title: task.title,
        description: task.description,
        estimatedMinutes: task.estimated_minutes
      });



      const blockchainSprintId = task.sprint_blockchain_id || 1;


      let assignedToAddress = ethers.ZeroAddress;


      const estimatedMinutes = task.estimated_minutes || 0;


      console.log('📝 Registrando tarefa na blockchain...');
      const tx = await this.taskContract.registerTask(
        blockchainSprintId,
        assignedToAddress,
        estimatedMinutes,
        dataHash
      );


      await BlockchainTransactionService.create({
        transactionHash: tx.hash,
        transactionType: 'task_create',
        contractName: 'TaskManagement',
        methodName: 'registerTask',
        description: `Registro da tarefa: ${task.title}`,
        userAddress: userAddress,
        userId: userId,
        teamId: task.group_id,
        itemId: task.id,
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
          const parsedLog = this.taskContract.interface.parseLog(log);
          return parsedLog.name === 'TaskRegistered';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedLog = this.taskContract.interface.parseLog(event);
        const blockchainTaskId = parsedLog.args.taskId.toString();


        const updatedTask = await TaskService.updateTask(task.id, {
          blockchain_address: blockchainTaskId
        });

        console.log('✅ Tarefa registrada na blockchain - PostgreSQL ID:', task.id, 'Blockchain ID:', blockchainTaskId);
        return updatedTask;
      }

      console.log('✅ Tarefa registrada na blockchain');
      return task;

    } catch (error) {
      console.error('❌ Erro ao registrar tarefa na blockchain:', error);
      throw error;
    }
  }
}

module.exports = new TaskBlockchainService();
