const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

const Room = sequelize.define('Room', {
  room_nb: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  id_property: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  surface: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  tv: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  shower: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'rooms',
  timestamps: false,
  underscored: true
});

module.exports = Room;