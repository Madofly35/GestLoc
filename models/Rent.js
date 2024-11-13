const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

const Rent = sequelize.define('Rent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_tenant: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  id_room: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'rooms',
      key: 'id'
    }
  },
  date_entrance: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  rent_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  charges: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  }
}, {
  tableName: 'rents',
  timestamps: false
});

// Fonction simplifiée pour réinitialiser la séquence
async function resetRentSequence() {
  try {
    await sequelize.query(`
      SELECT setval('rents_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM rents), false);
    `);
    console.log('✅ Séquence rents_id_seq réinitialisée avec succès');
  } catch (error) {
    console.error('🔴 Erreur lors de la réinitialisation de la séquence:', error);
    throw error;
  }
}

// Fonction d'initialisation
async function initializeRent() {
  try {
    await Rent.sync();
    await resetRentSequence();
    console.log('✅ Modèle Rent initialisé avec succès');
  } catch (error) {
    console.error('🔴 Erreur lors de l\'initialisation du modèle Rent:', error);
    throw error;
  }
}

module.exports = { 
  Rent, 
  initializeRent,
  resetRentSequence 
};