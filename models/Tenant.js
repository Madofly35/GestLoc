// backend/models/tenant.js
const { DataTypes } = require('sequelize');
const { sequelize }= require('../config');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
        // Forcer la création de la séquence
        defaultValue: sequelize.literal("nextval('tenants_id_seq')")
 
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Le prénom est requis' },
      len: {
        args: [2, 50],
        msg: 'Le prénom doit contenir entre 2 et 50 caractères'
      }
    }
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Le nom est requis' },
      len: {
        args: [2, 50],
        msg: 'Le nom doit contenir entre 2 et 50 caractères'
      }
    }
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: { msg: 'Format de date invalide' },
      isBefore: {
        args: new Date().toISOString(),
        msg: 'La date de naissance ne peut pas être dans le futur'
      }
    }
  },
  mail: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: {
      msg: 'Cette adresse email est déjà utilisée'
    },
    validate: {
      isEmail: { msg: 'Format d\'email invalide' }
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      is: {
        args: /^(\+\d{1,3}[- ]?)?\d{10}$/,
        msg: 'Format de numéro de téléphone invalide'
      }
    }
  }
}, {
  tableName: 'tenants',
  timestamps: false,
  underscored: true
});


async function initializeTenant() {
  try {
    // Créer la séquence si elle n'existe pas
    await sequelize.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'tenants_id_seq') THEN
          CREATE SEQUENCE tenants_id_seq;
          ALTER TABLE tenants ALTER COLUMN id SET DEFAULT nextval('tenants_id_seq');
          ALTER SEQUENCE tenants_id_seq OWNED BY tenants.id;
        END IF;
      END $$;
    `);
    
    // Synchroniser le modèle
    await Tenant.sync({ alter: true });
    
    console.log('✅ Modèle Tenant initialisé avec succès');
  } catch (error) {
    console.error('🔴 Erreur lors de l\'initialisation du modèle Tenant:', error);
  }
}

module.exports = Tenant;
