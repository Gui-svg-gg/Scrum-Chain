// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ScrumTeam.sol";
import "./SprintManagement.sol";

/**
 * @title TaskManagement
 * @dev Contrato para registro de tarefas na blockchain
 * @notice Espelha a tabela 'tasks' do PostgreSQL
 */
contract TaskManagement {
    
    // Enums (iguais ao sistema atual)
    enum Status { Todo, InProgress, Review, Done, Removed }
    
    // Struct para registro de tarefa na blockchain
    struct TaskRecord {
        uint256 taskId;           // ID que corresponde ao PostgreSQL
        uint256 sprintId;         // ID do sprint
        uint256 teamId;           // ID da equipe
        address createdBy;        // Criador da tarefa
        address assignedTo;       // Pessoa atribuída à tarefa
        Status status;            // Status atual
        uint256 estimatedHours;   // Horas estimadas (em minutos para precisão)
        uint256 createdAt;        // Timestamp de criação
        uint256 updatedAt;        // Timestamp da última atualização
        bytes32 dataHash;         // Hash dos dados no PostgreSQL
    }
    
    // State Variables
    mapping(uint256 => TaskRecord) public tasks;                // taskId => TaskRecord
    mapping(uint256 => uint256[]) public sprintTasks;           // sprintId => taskIds
    mapping(uint256 => uint256[]) public teamTasks;             // teamId => taskIds
    mapping(address => uint256[]) public userTasks;             // user => taskIds
    mapping(uint256 => mapping(Status => uint256)) public sprintStatusCount; // sprintId => status => count
    mapping(uint256 => mapping(Status => uint256)) public teamStatusCount;   // teamId => status => count
    
    uint256 public nextTaskId;
    
    ScrumTeam public scrumTeamContract;
    SprintManagement public sprintManagementContract;
    
    // Events (espelham as operações do PostgreSQL)
    event TaskRegistered(
        uint256 indexed taskId,
        uint256 indexed sprintId,
        uint256 indexed teamId,
        address createdBy,
        address assignedTo,
        uint256 estimatedHours,
        bytes32 dataHash,
        uint256 timestamp
    );
    
    event TaskStatusChanged(
        uint256 indexed taskId,
        Status oldStatus,
        Status newStatus,
        address changedBy,
        uint256 timestamp
    );
    
    event TaskAssigned(
        uint256 indexed taskId,
        address oldAssignee,
        address newAssignee,
        address changedBy,
        uint256 timestamp
    );
    
    event TaskDataUpdated(
        uint256 indexed taskId,
        bytes32 oldHash,
        bytes32 newHash,
        uint256 timestamp
    );
    
    event TaskRemoved(
        uint256 indexed taskId,
        uint256 timestamp
    );
    
    // Modifiers
    modifier taskExists(uint256 _taskId) {
        require(_taskId > 0 && _taskId < nextTaskId, "Task does not exist");
        require(tasks[_taskId].status != Status.Removed, "Task is removed");
        _;
    }
    
    modifier onlyTeamMember(uint256 _teamId) {
        require(
            scrumTeamContract.isMember(_teamId, msg.sender),
            "Only team members can perform this action"
        );
        _;
    }
    
    modifier onlyTaskCreatorOrAssignee(uint256 _taskId) {
        TaskRecord memory task = tasks[_taskId];
        require(
            task.createdBy == msg.sender || 
            task.assignedTo == msg.sender ||
            scrumTeamContract.isMember(task.teamId, msg.sender),
            "Only task creator, assignee or team member can perform this action"
        );
        _;
    }

    modifier onlyScrumMasterOrProductOwner(uint256 _teamId) {
        // Verifica se é membro da equipe
        require(
            scrumTeamContract.isMember(_teamId, msg.sender),
            "Only team members can perform this action"
        );
        
        // Obtém o papel do membro
        (ScrumTeam.Role role,,,) = scrumTeamContract.getMemberInfo(_teamId, msg.sender);
        
        // Permite apenas Scrum Master ou Product Owner
        require(
            role == ScrumTeam.Role.ScrumMaster || role == ScrumTeam.Role.ProductOwner,
            "Only Scrum Master or Product Owner can perform this action"
        );
        _;
    }
    
    // Constructor
    constructor(address _scrumTeamContract, address _sprintManagementContract) {
        scrumTeamContract = ScrumTeam(_scrumTeamContract);
        sprintManagementContract = SprintManagement(_sprintManagementContract);
        nextTaskId = 1;
    }
    
    /**
     * @dev Registra uma nova tarefa na blockchain
     * @param _sprintId ID do sprint
     * @param _assignedTo Endereço da pessoa atribuída
     * @param _estimatedHours Horas estimadas (em minutos)
     * @param _dataHash Hash dos dados da tarefa no PostgreSQL
     * @return taskId ID da tarefa registrada
     */
    function registerTask(
        uint256 _sprintId,
        address _assignedTo,
        uint256 _estimatedHours,
        bytes32 _dataHash
    )
        external
        returns (uint256)
    {
        require(_dataHash != bytes32(0), "Data hash cannot be empty");
        require(sprintManagementContract.isSprintActive(_sprintId), "Sprint is not active");
        
        // Obter informações do sprint
        (uint256 teamId,,,,,,, ) = sprintManagementContract.getSprintInfo(_sprintId);
        
        // Verificar se o usuário é membro da equipe
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can create tasks"
        );
        
        // Se atribuído a alguém, verificar se é membro da equipe
        if (_assignedTo != address(0)) {
            require(
                scrumTeamContract.isMember(teamId, _assignedTo),
                "Can only assign tasks to team members"
            );
        }
        
        uint256 taskId = nextTaskId;
        
        tasks[taskId] = TaskRecord({
            taskId: taskId,
            sprintId: _sprintId,
            teamId: teamId,
            createdBy: msg.sender,
            assignedTo: _assignedTo,
            status: Status.Todo,
            estimatedHours: _estimatedHours,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            dataHash: _dataHash
        });
        
        // Adicionar às listas
        sprintTasks[_sprintId].push(taskId);
        teamTasks[teamId].push(taskId);
        
        if (_assignedTo != address(0)) {
            userTasks[_assignedTo].push(taskId);
        }
        
        // Atualizar contadores
        sprintStatusCount[_sprintId][Status.Todo]++;
        teamStatusCount[teamId][Status.Todo]++;
        
        nextTaskId++;
        
        emit TaskRegistered(taskId, _sprintId, teamId, msg.sender, _assignedTo, _estimatedHours, _dataHash, block.timestamp);
        
        return taskId;
    }
    
    /**
     * @dev Atualiza o status de uma tarefa
     * @param _taskId ID da tarefa
     * @param _newStatus Novo status
     */
    function updateTaskStatus(
        uint256 _taskId,
        Status _newStatus
    )
        external
        taskExists(_taskId)
    {
        TaskRecord storage task = tasks[_taskId];
        
        // Verificar permissões - qualquer membro da equipe pode alterar status
        require(
            scrumTeamContract.isMember(task.teamId, msg.sender),
            "Only team members can change task status"
        );
        
        Status oldStatus = task.status;
        
        require(oldStatus != _newStatus, "Status is already set to this value");
        
        // Validações básicas de transição - simplificadas
        if (_newStatus == Status.InProgress) {
            require(oldStatus == Status.Todo || oldStatus == Status.Review, 
                   "Can start tasks from Todo or Review status");
        }
        
        if (_newStatus == Status.Done) {
            require(oldStatus == Status.InProgress || oldStatus == Status.Review, 
                   "Can complete tasks from InProgress or Review status");
        }
        
        // Atualizar contadores
        sprintStatusCount[task.sprintId][oldStatus]--;
        sprintStatusCount[task.sprintId][_newStatus]++;
        teamStatusCount[task.teamId][oldStatus]--;
        teamStatusCount[task.teamId][_newStatus]++;
        
        task.status = _newStatus;
        task.updatedAt = block.timestamp;
        
        emit TaskStatusChanged(_taskId, oldStatus, _newStatus, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Atribui uma tarefa a um membro da equipe
     * @param _taskId ID da tarefa
     * @param _newAssignee Novo responsável pela tarefa
     */
    function assignTask(
        uint256 _taskId,
        address _newAssignee
    )
        external
        taskExists(_taskId)
    {
        TaskRecord storage task = tasks[_taskId];
        
        // Verificar se é membro da equipe - qualquer membro pode atribuir
        uint256 teamId = task.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can assign tasks"
        );
        
        // Verificar se o novo atribuído é membro da equipe
        if (_newAssignee != address(0)) {
            require(
                scrumTeamContract.isMember(teamId, _newAssignee),
                "Can only assign tasks to team members"
            );
        }
        
        address oldAssignee = task.assignedTo;
        
        // Remover da lista do antigo atribuído
        if (oldAssignee != address(0)) {
            _removeFromUserTasks(oldAssignee, _taskId);
        }
        
        // Adicionar à lista do novo atribuído
        if (_newAssignee != address(0)) {
            userTasks[_newAssignee].push(_taskId);
        }
        
        task.assignedTo = _newAssignee;
        task.updatedAt = block.timestamp;
        
        emit TaskAssigned(_taskId, oldAssignee, _newAssignee, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Atualiza o hash dos dados de uma tarefa
     * @param _taskId ID da tarefa
     * @param _newDataHash Novo hash dos dados
     */
    function updateTaskDataHash(
        uint256 _taskId,
        bytes32 _newDataHash
    )
        external
        taskExists(_taskId)
    {
        require(_newDataHash != bytes32(0), "Data hash cannot be empty");
        
        TaskRecord storage task = tasks[_taskId];
        
        // Verificar se é membro da equipe
        require(
            scrumTeamContract.isMember(task.teamId, msg.sender),
            "Only team members can update task data"
        );
        
        bytes32 oldHash = task.dataHash;
        
        task.dataHash = _newDataHash;
        task.updatedAt = block.timestamp;
        
        emit TaskDataUpdated(_taskId, oldHash, _newDataHash, block.timestamp);
    }
    
    /**
     * @dev Remove (marca como removida) uma tarefa
     * @param _taskId ID da tarefa
     */
    function removeTask(uint256 _taskId)
        external
        taskExists(_taskId)
    {
        TaskRecord storage task = tasks[_taskId];
        
        // Verificar se é membro da equipe - qualquer membro pode remover
        uint256 teamId = task.teamId;
        require(
            scrumTeamContract.isMember(teamId, msg.sender),
            "Only team members can remove tasks"
        );
        
        Status oldStatus = task.status;
        
        // Atualizar contadores
        sprintStatusCount[task.sprintId][oldStatus]--;
        teamStatusCount[task.teamId][oldStatus]--;
        
        // Remover da lista do usuário atribuído
        if (task.assignedTo != address(0)) {
            _removeFromUserTasks(task.assignedTo, _taskId);
        }
        
        task.status = Status.Removed;
        task.updatedAt = block.timestamp;
        
        emit TaskRemoved(_taskId, block.timestamp);
    }
    
    /**
     * @dev Remove uma tarefa da lista de um usuário
     * @param _user Usuário
     * @param _taskId ID da tarefa
     */
    function _removeFromUserTasks(address _user, uint256 _taskId) internal {
        uint256[] storage userTaskList = userTasks[_user];
        for (uint256 i = 0; i < userTaskList.length; i++) {
            if (userTaskList[i] == _taskId) {
                userTaskList[i] = userTaskList[userTaskList.length - 1];
                userTaskList.pop();
                break;
            }
        }
    }
    
    // View Functions
    
    /**
     * @dev Retorna informações de uma tarefa
     * @param _taskId ID da tarefa
     */
    function getTaskInfo(uint256 _taskId)
        external
        view
        returns (
            uint256 sprintId,
            uint256 teamId,
            address createdBy,
            address assignedTo,
            Status status,
            uint256 estimatedHours,
            uint256 createdAt,
            uint256 updatedAt,
            bytes32 dataHash
        )
    {
        require(_taskId > 0 && _taskId < nextTaskId, "Task does not exist");
        
        TaskRecord memory task = tasks[_taskId];
        return (
            task.sprintId,
            task.teamId,
            task.createdBy,
            task.assignedTo,
            task.status,
            task.estimatedHours,
            task.createdAt,
            task.updatedAt,
            task.dataHash
        );
    }
    
    /**
     * @dev Retorna todas as tarefas de um sprint
     * @param _sprintId ID do sprint
     */
    function getSprintTasks(uint256 _sprintId)
        external
        view
        returns (uint256[] memory)
    {
        return sprintTasks[_sprintId];
    }
    
    /**
     * @dev Retorna todas as tarefas de uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamTasks(uint256 _teamId)
        external
        view
        returns (uint256[] memory)
    {
        return teamTasks[_teamId];
    }
    
    /**
     * @dev Retorna todas as tarefas de um usuário
     * @param _user Endereço do usuário
     */
    function getUserTasks(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return userTasks[_user];
    }
    
    /**
     * @dev Retorna contadores de status para um sprint
     * @param _sprintId ID do sprint
     */
    function getSprintStatusCounts(uint256 _sprintId)
        external
        view
        returns (
            uint256 todoCount,
            uint256 inProgressCount,
            uint256 reviewCount,
            uint256 doneCount,
            uint256 removedCount
        )
    {
        return (
            sprintStatusCount[_sprintId][Status.Todo],
            sprintStatusCount[_sprintId][Status.InProgress],
            sprintStatusCount[_sprintId][Status.Review],
            sprintStatusCount[_sprintId][Status.Done],
            sprintStatusCount[_sprintId][Status.Removed]
        );
    }
    
    /**
     * @dev Retorna contadores de status para uma equipe
     * @param _teamId ID da equipe
     */
    function getTeamStatusCounts(uint256 _teamId)
        external
        view
        returns (
            uint256 todoCount,
            uint256 inProgressCount,
            uint256 reviewCount,
            uint256 doneCount,
            uint256 removedCount
        )
    {
        return (
            teamStatusCount[_teamId][Status.Todo],
            teamStatusCount[_teamId][Status.InProgress],
            teamStatusCount[_teamId][Status.Review],
            teamStatusCount[_teamId][Status.Done],
            teamStatusCount[_teamId][Status.Removed]
        );
    }
    
    /**
     * @dev Retorna tarefas por status em um sprint
     * @param _sprintId ID do sprint
     * @param _status Status desejado
     */
    function getTasksByStatus(uint256 _sprintId, Status _status)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory allTasks = sprintTasks[_sprintId];
        uint256[] memory filteredTasks = new uint256[](sprintStatusCount[_sprintId][_status]);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allTasks.length; i++) {
            if (tasks[allTasks[i]].status == _status) {
                filteredTasks[index] = allTasks[i];
                index++;
            }
        }
        
        return filteredTasks;
    }
    
    /**
     * @dev Verifica se uma tarefa existe e está ativa
     * @param _taskId ID da tarefa
     */
    function isTaskActive(uint256 _taskId)
        external
        view
        returns (bool)
    {
        return _taskId > 0 && _taskId < nextTaskId && tasks[_taskId].status != Status.Removed;
    }
    
    /**
     * @dev Retorna o número total de tarefas de um sprint
     * @param _sprintId ID do sprint
     */
    function getSprintTaskCount(uint256 _sprintId)
        external
        view
        returns (uint256)
    {
        return sprintTasks[_sprintId].length;
    }
}
