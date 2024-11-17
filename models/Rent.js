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
    validate: {
      isInt: {
        msg: "L'ID du locataire doit être un nombre entier"
      },
      notNull: {
        msg: "L'ID du locataire est requis"
      }
    },
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  id_room: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isInt: {
        msg: "L'ID de la chambre doit être un nombre entier"
      },
      notNull: {
        msg: "L'ID de la chambre est requis"
      }
    },
    references: {
      model: 'rooms',
      key: 'id'
    }
  },
  date_entrance: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: {
        msg: 'Date d\'entrée invalide'
      },
      notNull: {
        msg: 'La date d\'entrée est requise'
      }
    }
  },
  rent_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'Le montant du loyer doit être un nombre décimal'
      },
      min: {
        args: [0],
        msg: 'Le montant du loyer doit être positif'
      },
      notNull: {
        msg: 'Le montant du loyer est requis'
      }
    }
  },
  charges: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      isDecimal: {
        msg: 'Le montant des charges doit être un nombre décimal'
      },
      min: {
        args: [0],
        msg: 'Le montant des charges doit être positif'
      }
    }
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Date de fin invalide'
      },
      laterThanStartDate(value) {
        if (value && value <= this.date_entrance) {
          throw new Error('La date de fin doit être postérieure à la date d\'entrée');
        }
      }
    }
  }
}, {
  tableName: 'rents',
  timestamps: false,
  validate: {
    async checkOverlappingRents() {
      const overlapping = await Rent.findOne({
        where: {
          id_room: this.id_room,
          [Op.and]: [
            { date_entrance: { [Op.lte]: this.end_date || '9999-12-31' } },
            { 
              [Op.or]: [
                { end_date: null },
                { end_date: { [Op.gte]: this.date_entrance } }
              ]
            }
          ],
          id: { [Op.ne]: this.id } // Exclure la location actuelle en cas de mise à jour
        }
      });

      if (overlapping) {
        throw new Error('Cette période chevauche une location existante');
      }
    }
  }
});

module.exports = { Rent };