// backend/models/Document.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['contracts', 'documents', 'tickets']]
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  storage_path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  storage_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mime_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'documents',
  timestamps: false,
  underscored: true
});

module.exports = Document;
