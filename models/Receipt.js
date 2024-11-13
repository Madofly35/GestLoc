const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

const Receipt = sequelize.define('Receipt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  generated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  downloaded_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'receipts',
  timestamps: false,
  underscored: true
});

module.exports = Receipt;