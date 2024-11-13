const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rent_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'rents',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'paid']]
    }
  },
  payment_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'payments',
  timestamps: false,
  underscored: true
});

module.exports = Payment;