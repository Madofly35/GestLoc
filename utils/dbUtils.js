// backend/utils/dbUtils.js
const sequelize = require('../config');

async function resetSequence(tableName) {
  try {
    await sequelize.query(`
      SELECT setval('${tableName}_id_seq', 
        (SELECT COALESCE(MAX(id), 0) FROM ${tableName})
      );
    `);
    console.log(`✅ Séquence réinitialisée pour la table ${tableName}`);
  } catch (error) {
    console.error(`❌ Erreur lors de la réinitialisation de la séquence pour ${tableName}:`, error);
    throw error;
  }
}

module.exports = {
  resetSequence
};