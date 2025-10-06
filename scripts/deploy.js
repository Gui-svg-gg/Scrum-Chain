const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const { updateContractAddresses } = require('./update-contract-addresses');

async function main() {
  console.log("🚀 Deploying Scrum-Chain contracts...");
  console.log("📋 These contracts mirror the PostgreSQL database structure\n");

  // 🧹 LIMPEZA AUTOMÁTICA: Deletar arquivos antigos do frontend
  console.log("🧹 Cleaning old contract files...");
  const frontendContractsPath = path.join(__dirname, '../frontend/src/contracts');
  
  // Criar diretório se não existir
  if (!fs.existsSync(frontendContractsPath)) {
    fs.mkdirSync(frontendContractsPath, { recursive: true });
    console.log("📁 Created contracts directory");
  }
  
  // Lista de arquivos para deletar sempre
  const filesToClean = [
    'contract-addresses.json',
    'config.json',
    'ScrumTeam.json',
    'ProductBacklog.json',
    'SprintManagement.json',
    'TaskManagement.json'
  ];

  filesToClean.forEach(file => {
    const filePath = path.join(frontendContractsPath, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`   🗑️ Deleted: ${file}`);
    }
  });

  console.log("✅ Old files cleaned successfully!");
  console.log("");

  // 1. Deploy ScrumTeam primeiro (base para outros contratos)
  console.log("📋 Deploying ScrumTeam...");
  const ScrumTeam = await ethers.getContractFactory("ScrumTeam");
  const scrumTeam = await ScrumTeam.deploy();
  await scrumTeam.waitForDeployment();
  console.log("✅ ScrumTeam deployed to:", await scrumTeam.getAddress());

  // 2. Deploy ProductBacklog
  console.log("📋 Deploying ProductBacklog...");
  const ProductBacklog = await ethers.getContractFactory("ProductBacklog");
  const productBacklog = await ProductBacklog.deploy(await scrumTeam.getAddress());
  await productBacklog.waitForDeployment();
  console.log("✅ ProductBacklog deployed to:", await productBacklog.getAddress());

  // 3. Deploy SprintManagement
  console.log("📋 Deploying SprintManagement...");
  const SprintManagement = await ethers.getContractFactory("SprintManagement");
  const sprintManagement = await SprintManagement.deploy(await scrumTeam.getAddress());
  await sprintManagement.waitForDeployment();
  console.log("✅ SprintManagement deployed to:", await sprintManagement.getAddress());

  // 4. Deploy TaskManagement
  console.log("📋 Deploying TaskManagement...");
  const TaskManagement = await ethers.getContractFactory("TaskManagement");
  const taskManagement = await TaskManagement.deploy(
    await scrumTeam.getAddress(), 
    await sprintManagement.getAddress()
  );
  await taskManagement.waitForDeployment();
  console.log("✅ TaskManagement deployed to:", await taskManagement.getAddress());

  // Salvar endereços dos contratos
  const contractAddresses = {
    ScrumTeam: await scrumTeam.getAddress(),
    ProductBacklog: await productBacklog.getAddress(),
    SprintManagement: await sprintManagement.getAddress(),
    TaskManagement: await taskManagement.getAddress()
  };

  // Salvar no frontend
  const frontendPath = path.join(__dirname, '../frontend/src/contracts/contract-addresses.json');
  fs.writeFileSync(frontendPath, JSON.stringify(contractAddresses, null, 2));
  console.log("📝 Contract addresses saved to frontend");

  // Copiar ABIs para o frontend
  const contracts = [
    'ScrumTeam',
    'ProductBacklog',
    'SprintManagement',
    'TaskManagement'
  ];
  
  for (const contractName of contracts) {
    const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
    const frontendAbiPath = path.join(__dirname, `../frontend/src/contracts/${contractName}.json`);
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      fs.writeFileSync(frontendAbiPath, JSON.stringify(artifact, null, 2));
      console.log(`📋 ${contractName} ABI copied to frontend`);
    }
  }

  console.log("\n🎉 All contracts deployed successfully!");
  console.log("\n📊 Contract Summary:");
  console.log("├── ScrumTeam:", await scrumTeam.getAddress());
  console.log("├── ProductBacklog:", await productBacklog.getAddress());
  console.log("├── SprintManagement:", await sprintManagement.getAddress());
  console.log("└── TaskManagement:", await taskManagement.getAddress());
  
  console.log("\n📌 Contract Features:");
  console.log("1. ✅ Mirror PostgreSQL database structure");
  console.log("2. ✅ Store only essential blockchain data (IDs, hashes, timestamps)");
  console.log("3. ✅ Full data stored in PostgreSQL database");
  console.log("4. ✅ Events for database synchronization");
  
  console.log("\n🧹 Auto-cleanup feature: ENABLED");
  console.log("   → Old contract files are always deleted before deploy");
  console.log("   → Frontend configs are always fresh and updated");

  // Criar arquivo de configuração para o frontend
  const config = {
    networkId: 31337,
    networkName: "Hardhat Local",
    contracts: contractAddresses,
    features: {
      teamManagement: true,
      productBacklog: true,
      sprintManagement: true,
      taskManagement: true,
      databaseSync: true
    },
    version: "3.0.0",
    deployedAt: new Date().toISOString(),
    description: "Contracts that mirror PostgreSQL structure"
  };
  
  const configPath = path.join(__dirname, '../frontend/src/contracts/config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("⚙️ Configuration file created for frontend");

  console.log("\n🧪 Testing basic contract functionality...");
  
  // Test ScrumTeam contract
  try {
    const [owner] = await ethers.getSigners();
    
    // Create a test team
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("Test team data"));
    const tx = await scrumTeam.registerTeam(dataHash);
    await tx.wait();
    
    console.log("✅ Test team registered successfully");
    
    // Get team info
    const teamInfo = await scrumTeam.getTeamInfo(1);
    console.log("✅ Team info retrieved, creator:", teamInfo[0]);
    
    // Test ProductBacklog
    const itemDataHash = ethers.keccak256(ethers.toUtf8Bytes("Test backlog item"));
    const itemTx = await productBacklog.registerBacklogItem(1, 1, itemDataHash); // Medium priority
    await itemTx.wait();
    console.log("✅ Test backlog item registered");
    
    // Test SprintManagement
    const sprintDataHash = ethers.keccak256(ethers.toUtf8Bytes("Test sprint"));
    const sprintTx = await sprintManagement.registerSprint(
      1, // teamId
      Math.floor(Date.now() / 1000) + 86400, // tomorrow
      Math.floor(Date.now() / 1000) + (14 * 86400), // 14 days from now
      sprintDataHash
    );
    await sprintTx.wait();
    console.log("✅ Test sprint registered");
    
    // Test TaskManagement
    const taskDataHash = ethers.keccak256(ethers.toUtf8Bytes("Test task"));
    const taskTx = await taskManagement.registerTask(
      1, // sprintId
      owner.address, // assignedTo
      480, // estimatedHours (8 hours in minutes)
      taskDataHash
    );
    await taskTx.wait();
    console.log("✅ Test task registered");
    
    console.log("🎉 All contract functionality verified!");
    
  } catch (error) {
    console.log("⚠️ Basic test failed:", error.message);
  }

  // 🔧 AUTO-UPDATE CONTRACT ADDRESSES IN FRONTEND FILES
  console.log("\n🔧 Auto-updating contract addresses in frontend files...");
  updateContractAddresses(contractAddresses);

  console.log("🎯 Next Steps:");
  console.log("1. Update backend to integrate with these contracts");
  console.log("2. Add blockchain event listeners to sync with PostgreSQL");
  console.log("3. Frontend contract addresses automatically updated!");
  console.log("4. Implement hash generation for data integrity");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
