// backend/models/property.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');
const Property = sequelize.define('Property', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    }
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  postalcode: { 
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  surface: {
    type: DataTypes.FLOAT,
    allowNull: false,
  }
}, {
  tableName: 'properties',
  timestamps: false,
  underscored: true
});

module.exports = Property;
