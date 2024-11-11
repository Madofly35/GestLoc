// test-db.js
require('dotenv').config();
const { testConnection, testConnectionWithPg } = require('./config');

async function runTests() {
  console.log('🔍 Test de connexion avec Sequelize...');
  const sequelizeResult = await testConnection();
  
  console.log('\n🔍 Test de connexion avec pg...');
  const pgResult = await testConnectionWithPg();

  if (!sequelizeResult && !pgResult) {
    console.error('\n❌ Les deux tests ont échoué. Vérifiez vos identifiants et votre connexion.');
    process.exit(1);
  }
}

runTests();