import BlockchainService from './BlockchainService';

class EnhancedBlockchainService extends BlockchainService {
  constructor() {
    super();
    this.syncCallbacks = {
      before: null,
      after: null
    };
  }


  setSyncCallbacks(beforeSync, afterSync) {
    this.syncCallbacks.before = beforeSync;
    this.syncCallbacks.after = afterSync;
  }


  async executeWithSync(transactionType, operation) {
    try {

      if (this.syncCallbacks.before) {
        console.log(`🔄 Sincronizando antes da transação: ${transactionType}`);
        await this.syncCallbacks.before(transactionType);
      }


      const result = await operation();


      if (result.success && this.syncCallbacks.after) {
        console.log(`🔄 Sincronizando após transação: ${transactionType}`);
        await this.syncCallbacks.after(transactionType);
      }

      return result;
    } catch (error) {
      console.error(`Erro na transação ${transactionType}:`, error);
      throw error;
    }
  }


  async registerSprint(teamId, sprintData) {
    return this.executeWithSync('sprints', () => super.registerSprint(teamId, sprintData));
  }

  async updateSprintStatus(sprintId, status) {
    return this.executeWithSync('sprints', () => super.updateSprintStatus(sprintId, status));
  }

  async updateSprintData(sprintId, sprintData) {
    return this.executeWithSync('sprints', () => super.updateSprintData(sprintId, sprintData));
  }

  async deleteSprint(sprintId) {
    return this.executeWithSync('sprints', () => super.deleteSprint(sprintId));
  }


  async registerTask(sprintId, taskData) {
    return this.executeWithSync('tarefas', () => super.registerTask(sprintId, taskData));
  }

  async updateTaskStatus(taskId, status) {
    return this.executeWithSync('tarefas', () => super.updateTaskStatus(taskId, status));
  }

  async updateTaskData(taskId, taskData) {
    return this.executeWithSync('tarefas', () => super.updateTaskData(taskId, taskData));
  }

  async deleteTask(taskId) {
    return this.executeWithSync('tarefas', () => super.deleteTask(taskId));
  }

  async assignTask(taskId, assignedTo) {
    return this.executeWithSync('tarefas', () => super.assignTask(taskId, assignedTo));
  }


  async registerTeam(teamData) {
    return this.executeWithSync('equipe', () => super.registerTeam?.(teamData) || Promise.resolve({ success: false, message: 'Método não implementado' }));
  }

  async updateTeam(teamId, teamData) {
    return this.executeWithSync('equipe', () => super.updateTeam?.(teamId, teamData) || Promise.resolve({ success: false, message: 'Método não implementado' }));
  }


  async registerBacklogItem(itemData) {
    return this.executeWithSync('backlog', () => super.registerBacklogItem?.(itemData) || Promise.resolve({ success: false, message: 'Método não implementado' }));
  }

  async updateBacklogItem(itemId, itemData) {
    return this.executeWithSync('backlog', () => super.updateBacklogItem?.(itemId, itemData) || Promise.resolve({ success: false, message: 'Método não implementado' }));
  }

  async deleteBacklogItem(itemId) {
    return this.executeWithSync('backlog', () => super.deleteBacklogItem?.(itemId) || Promise.resolve({ success: false, message: 'Método não implementado' }));
  }
}

export default EnhancedBlockchainService;