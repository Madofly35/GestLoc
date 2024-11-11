# Analyse du Projet
Dossier racine: C:/Users/Pierre/Desktop/App/GestLoc/backend


## Structure du Projet
```

### 📄 Server.js
```
const express = require('express');
const cors = require('cors');
const sequelize = require('./config'); // Importer la config Sequelize
const {setupAssociations} = require('./models/associations'); // Importer les associations
const { initializeRent } = require('./models/Rent');
const propertiesRoutes = require('./routes/Properties'); 
const roomsRoutes = require('./routes/rooms');
const tenantsRoutes = require('./routes/tenants');
const rentsRoutes = require('./routes/rents');
const paymentsRoutes = require('./routes/payments');
const receiptsRoutes = require('./routes/receipts');
const { resetSequence } = require('./utils/dbUtils');

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie avec succès.');

    setupAssociations();
    console.log('✅ Associations des modèles configurées.');

    await initializeRent();
    console.log('✅ Modèle Rent initialisé');

    await sequelize.sync();
    console.log('✅ Modèles synchronisés avec la base de données.');

    // Réinitialiser les séquences
    await resetSequence('tenants');
    console.log('✅ Séquences réinitialisées.');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    process.exit(1);
  }
}

// Initialisation de l'application Express
const app = express();

// Configuration CORS
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware pour parser le JSON
app.use(express.json());

// Initialisation de la base de données
async function initializeDatabase() {
  try {
    // Test de la connexion
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie avec succès.');

    // Configuration des associations
    setupAssociations();
    console.log('✅ Associations des modèles configurées.');

    // Synchronisation des modèles avec la base de données
    await sequelize.sync();
    console.log('✅ Modèles synchronisés avec la base de données.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    process.exit(1); // Arrêter le serveur en cas d'erreur critique
  }
}

// Routes
app.use('/api/properties', propertiesRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/rents', rentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api', receiptsRoutes);

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur', error: err.message });
});

const PORT = process.env.PORT || 3000;

// Démarrage du serveur avec initialisation de la base de données
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`✅ Serveur en cours d'exécution sur le port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
  }
}

startServer();

module.exports = app;
```


### 📄 config.js
```
// backend/config.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('postgres', 'postgres', 'BBnn,,11', {
  host: 'localhost',
  dialect: 'postgres',
  logging: console.log, // Pour voir les requêtes SQL
  define: {
    timestamps: false,
    underscored: true
  }
});

module.exports = sequelize;

```


### ⚙️ package.json
```
[Fichier de configuration du projet: package.json]
```


### 📄 models\Payment.js
```
const { DataTypes } = require('sequelize');
const sequelize = require('../config');

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
```


### 📄 models\Property.js
```
// backend/models/property.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config');
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

```


### 📄 models\Receipt.js
```
const { DataTypes } = require('sequelize');
const sequelize = require('../config');

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
```


### 📄 models\Rent.js
```
const { DataTypes } = require('sequelize');
const sequelize = require('../config');

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
```


### 📄 models\Room.js
```
const { DataTypes } = require('sequelize');
const sequelize = require('../config');

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
```


### 📄 models\Tenant.js
```
// backend/models/tenant.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config');

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

```

```


### 📄 models\associations.js
```
const Property = require('./Property');
const Room = require('./Room');
const Tenant = require('./Tenant');
const { Rent } = require('./Rent');
const Payment = require('./Payment');
const Receipt = require('./Receipt');

let associationsInitialized = false;

function setupAssociations() {
  // Éviter la double initialisation
  if (associationsInitialized) {
    console.log('⚠️ Associations already initialized, skipping...');
    return;
  }

  try {
    console.log('🔄 Setting up model associations...');

    // Nettoyer les associations existantes si elles existent
    [Property, Room, Tenant, Rent, Payment, Receipt].forEach(model => {
      if (model.associations) {
        model.associations = {};
      }
    });

    // 1. Associations Property-Room
    Property.hasMany(Room, {
      foreignKey: 'id_property',
      as: 'propertyRooms',
      onDelete: 'CASCADE'
    });
    Room.belongsTo(Property, {
      foreignKey: 'id_property',
      as: 'property'
    });

    // 2. Associations Room-Rent
    Room.hasMany(Rent, {
      foreignKey: 'id_room',
      as: 'roomRents',
      onDelete: 'CASCADE'
    });
    Rent.belongsTo(Room, {
      foreignKey: 'id_room',
      as: 'room'
    });

    // 3. Associations Tenant-Rent
    Tenant.hasMany(Rent, {
      foreignKey: 'id_tenant',
      as: 'tenantRents',
      onDelete: 'CASCADE'
    });
    Rent.belongsTo(Tenant, {
      foreignKey: 'id_tenant',
      as: 'tenant'
    });

    // 4. Associations Rent-Payment
    Rent.hasMany(Payment, {
      foreignKey: 'rent_id',
      as: 'rentPayments',
      onDelete: 'CASCADE'
    });
    Payment.belongsTo(Rent, {
      foreignKey: 'rent_id',
      as: 'rent'
    });

    // 5. Associations Payment-Receipt
    Payment.hasOne(Receipt, {
      foreignKey: 'payment_id',
      as: 'paymentReceipt',
      onDelete: 'CASCADE'
    });
    Receipt.belongsTo(Payment, {
      foreignKey: 'payment_id',
      as: 'payment'
    });

    associationsInitialized = true;
    console.log('✅ Model associations setup complete');

    // Log des associations pour vérification
    console.log('📊 Association check:');
    console.log('Property:', Object.keys(Property.associations));
    console.log('Room:', Object.keys(Room.associations));
    console.log('Tenant:', Object.keys(Tenant.associations));
    console.log('Rent:', Object.keys(Rent.associations));
    console.log('Payment:', Object.keys(Payment.associations));
    console.log('Receipt:', Object.keys(Receipt.associations));

  } catch (error) {
    console.error('🔴 Error setting up associations:', error);
    throw error;
  }
}

// Export des modèles et de la fonction setupAssociations
module.exports = {
  setupAssociations,
  Property,
  Room,
  Tenant,
  Rent,
  Payment,
  Receipt
};
```


### 📄 routes\payments.js
```
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../config');
const path = require('path');
const fs = require('fs');
const { Payment, Receipt, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');

// Vérifier/créer le dossier de stockage des quittances
const ensureStorageExists = () => {
  const storageDir = path.join(__dirname, '..', 'storage', 'receipts');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
    console.log('📁 Created storage directory:', storageDir);
  }
  return storageDir;
};

// GET /payments/:month/:year
router.get('/:month/:year', async (req, res) => {
  try {
    const { month, year } = req.params;
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    console.log('Fetching payments for period:', { startDate, endDate });

    const payments = await Payment.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: Receipt,
          as: 'paymentReceipt',
          required: false
        },
        {
          model: Rent,
          as: 'rent',
          include: [
            {
              model: Tenant,
              as: 'tenant',
              attributes: ['first_name', 'last_name']
            },
            {
              model: Room,
              as: 'room',
              include: [{
                model: Property,
                as: 'property',
                attributes: ['name']
              }]
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Calculer les statistiques
    const statistics = {
      expected_amount: 0,
      received_amount: 0,
      pending_amount: 0,
      late_payments: 0
    };

    const formattedPayments = payments.map(payment => {
      const amount = parseFloat(payment.amount) || 0;
      
      // Mise à jour des statistiques
      statistics.expected_amount += amount;
      if (payment.status === 'paid') {
        statistics.received_amount += amount;
      } else {
        statistics.pending_amount += amount;
      }

      return {
        id: payment.id,
        amount: amount,
        status: payment.status,
        payment_date: payment.payment_date,
        tenant_name: payment.rent?.tenant 
          ? `${payment.rent.tenant.first_name} ${payment.rent.tenant.last_name}`
          : 'Inconnu',
        property_name: payment.rent?.room?.property?.name || 'Inconnue',
        room_number: payment.rent?.room?.room_nb || 'Inconnue',
        has_receipt: !!payment.paymentReceipt
      };
    });

    res.json({
      payments: formattedPayments,
      statistics
    });

  } catch (error) {
    console.error('Error in GET /payments/:month/:year:', error);
    res.status(500).json({ 
      message: 'Error fetching payments',
      error: error.message 
    });
  }
});

// PUT /payments/:id/mark-paid
router.put('/:id/mark-paid', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🟦 Marking payment as paid:', req.params.id);

    // Trouver le paiement avec ses relations
    const payment = await Payment.findOne({
      where: { id: req.params.id },
      include: [{
        model: Rent,
        as: 'rent',
        include: [
          {
            model: Tenant,
            as: 'tenant',
            attributes: ['first_name', 'last_name']
          },
          {
            model: Room,
            as: 'room',
            include: [{
              model: Property,
              as: 'property'
            }]
          }
        ]
      }],
      transaction
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Paiement non trouvé' 
      });
    }

    // Mettre à jour le paiement
    const paymentDate = new Date();
    await payment.update({
      status: 'paid',
      payment_date: paymentDate
    }, { transaction });

    console.log('✅ Payment updated successfully');

    // Générer et enregistrer la quittance
    try {
      ensureStorageExists();
      const filePath = await generateReceipt(payment, payment.rent);
      
      await Receipt.create({
        payment_id: payment.id,
        file_path: filePath,
        generated_at: paymentDate
      }, { transaction });

      console.log('✅ Receipt created successfully');
    } catch (receiptError) {
      console.error('⚠️ Error generating receipt:', receiptError);
    }

    await transaction.commit();

    res.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        payment_date: payment.payment_date,
        rent: payment.rent ? {
          id: payment.rent.id,
          tenant: {
            first_name: payment.rent.tenant.first_name,
            last_name: payment.rent.tenant.last_name
          },
          room: payment.rent.room ? {
            room_nb: payment.rent.room.room_nb,
            property: payment.rent.room.property ? {
              name: payment.rent.room.property.name
            } : null
          } : null
        } : null
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('🔴 Error in mark-paid:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du paiement',
      error: error.message
    });
  }
});

// PUT /payments/:id/mark-unpaid
router.put('/:id/mark-unpaid', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🟦 Marking payment as unpaid:', req.params.id);
    
    const payment = await Payment.findOne({
      where: { id: req.params.id },
      include: [{
        model: Receipt,
        as: 'paymentReceipt'
      }],
      transaction
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Paiement non trouvé' 
      });
    }

    // Supprimer la quittance associée si elle existe
    if (payment.paymentReceipt) {
      try {
        if (fs.existsSync(payment.paymentReceipt.file_path)) {
          fs.unlinkSync(payment.paymentReceipt.file_path);
        }
        await payment.paymentReceipt.destroy({ transaction });
      } catch (error) {
        console.error('Error deleting receipt:', error);
      }
    }

    await payment.update({
      status: 'pending',
      payment_date: null
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      payment: {
        id: payment.id,
        status: 'pending',
        amount: payment.amount,
        payment_date: null
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('🔴 Error in mark-unpaid:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du paiement',
      error: error.message
    });
  }
});

module.exports = router;
```


### 📄 routes\properties.js
```
const express = require('express');
const router = express.Router();
const property = require('../models/Property');

// Obtenir toutes les propriétés
router.get('/', async (req, res) => {
  try {
    const Properties = await property.findAll();
    res.json(Properties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ajouter une nouvelle propriété
router.post('/', async (req, res) => {
  try {
    const newProperty = await property.create(req.body);
    res.status(201).json(newProperty);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Ajouter d'autres routes comme Modifier et Supprimer...

module.exports = router;

```


### 📄 routes\receipts.js
```
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Receipt, Payment, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');

// GET /api/tenants/:tenantId/receipts
router.get('/tenants/:tenantId/receipts', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log('🟦 Fetching receipts for tenant:', tenantId);
    
    // Récupérer toutes les locations du locataire
    const rents = await Rent.findAll({
      where: { id_tenant: tenantId },
      include: [
        {
          model: Room,
          as: 'room',
          include: [{
            model: Property,
            as: 'property'
          }]
        }
      ],
      order: [['date_entrance', 'DESC']]
    });

    if (!rents || rents.length === 0) {
      console.log('❌ No rents found for tenant:', tenantId);
      return res.status(404).json({ message: 'Aucune location trouvée pour ce locataire' });
    }

    console.log('✅ Found rents:', rents.map(rent => ({
      id: rent.id,
      entrance: rent.date_entrance,
      end: rent.end_date
    })));

    // Récupérer tous les paiements associés à ces locations
    const rentIds = rents.map(rent => rent.id);
    const payments = await Payment.findAll({
      where: {
        rent_id: rentIds,
        status: 'paid'
      },
      include: [
        {
          model: Receipt,
          as: 'paymentReceipt',
          required: false
        },
        {
          model: Rent,
          as: 'rent',
          where: { id_tenant: tenantId },
          include: [
            {
              model: Tenant,
              as: 'tenant'
            },
            {
              model: Room,
              as: 'room',
              include: [{
                model: Property,
                as: 'property'
              }]
            }
          ]
        }
      ],
      order: [['payment_date', 'DESC']]
    });

    console.log('✅ Found payments:', payments.map(payment => ({
      id: payment.id,
      date: payment.payment_date,
      tenant: payment.rent?.tenant?.first_name + ' ' + payment.rent?.tenant?.last_name,
      amount: payment.amount
    })));

    const formattedPayments = payments.map(payment => {
      // Vérification de l'existence des données nécessaires
      if (!payment.rent?.tenant || !payment.rent?.room?.property) {
        console.warn('⚠️ Missing data for payment:', payment.id);
        return null;
      }

      const rent = payment.rent;
      const paymentDate = new Date(payment.payment_date);
      
      return {
        id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        month: paymentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        receipt_generated: !!payment.paymentReceipt,
        tenant_name: `${rent.tenant.first_name} ${rent.tenant.last_name}`,
        property_name: rent.room.property.name,
        property_address: rent.room.property.address,
        room_number: rent.room.room_nb,
        // Ajouter des informations sur la location
        rent_period: {
          start: rent.date_entrance,
          end: rent.end_date || 'En cours'
        }
      };
    }).filter(Boolean); // Filtrer les paiements avec données manquantes

    console.log('✅ Formatted payments:', formattedPayments);
    res.json(formattedPayments);

  } catch (error) {
    console.error('❌ Error fetching receipts:', error);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});


// GET /api/receipts/:paymentId/download
router.get('/receipts/:paymentId/download', async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log('🟦 Downloading receipt for payment:', paymentId);
    
    const payment = await Payment.findOne({
      where: { id: paymentId },
      include: [
        {
          model: Receipt,
          as: 'paymentReceipt',
          required: false
        },
        {
          model: Rent,
          as: 'rent',
          include: [
            {
              model: Tenant,
              as: 'tenant'
            },
            {
              model: Room,
              as: 'room',
              include: [{
                model: Property,
                as: 'property'
              }]
            }
          ]
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ message: "Paiement non trouvé" });
    }

    if (!payment.rent || !payment.rent.tenant || !payment.rent.room || !payment.rent.room.property) {
      return res.status(400).json({ message: "Données incomplètes pour générer la quittance" });
    }

    try {
      console.log('🟦 Payment data:', {
        id: payment.id,
        amount: payment.amount,
        tenant: payment.rent.tenant.first_name + ' ' + payment.rent.tenant.last_name
      });

      let receipt = payment.paymentReceipt;
      let filePath;

      // Toujours utiliser generateReceipt du module receiptGenerator
      if (!receipt) {
        console.log('🟦 No receipt found, generating new one with receiptGenerator...');
        filePath = await generateReceipt(payment, payment.rent);
        
        receipt = await Receipt.create({
          payment_id: payment.id,
          file_path: filePath,
          generated_at: new Date()
        });

        console.log('✅ New receipt created:', receipt.id);
      } else {
        filePath = receipt.file_path;
      }

      // Vérifier si le fichier existe physiquement
      const absoluteFilePath = path.resolve(__dirname, '..', filePath);
      if (!fs.existsSync(absoluteFilePath)) {
        console.log('🟦 Physical file not found, regenerating with receiptGenerator...');
        filePath = await generateReceipt(payment, payment.rent);
        await receipt.update({ file_path: filePath });
        
        const newAbsoluteFilePath = path.resolve(__dirname, '..', filePath);
        if (!fs.existsSync(newAbsoluteFilePath)) {
          throw new Error('Impossible de générer la quittance');
        }
      }

      // Mettre à jour la date de téléchargement
      await receipt.update({ downloaded_at: new Date() });

      // Créer le nom du fichier pour le téléchargement
      const date = new Date(payment.payment_date);
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const year = date.getFullYear();
      const fileName = `quittance_${month}_${year}_${payment.id}.pdf`;

      console.log('🟦 Sending file:', {
        path: absoluteFilePath,
        filename: fileName
      });

      // Envoyer le fichier
      res.download(absoluteFilePath, fileName, (err) => {
        if (err) {
          console.error('🔴 Error sending file:', err);
          throw new Error('Erreur lors de l\'envoi du fichier');
        }
      });

    } catch (genError) {
      console.error('🔴 Error generating/sending receipt:', genError);
      res.status(500).json({ 
        message: 'Erreur lors de la génération/envoi de la quittance',
        error: genError.message 
      });
    }

  } catch (error) {
    console.error('🔴 Error in download route:', error);
    res.status(500).json({ 
      message: 'Erreur lors du téléchargement de la quittance',
      error: error.message 
    });
  }
});


module.exports = router;
```


### 📄 routes\rents.js
```
const express = require('express');
const router = express.Router();
const {Rent} = require('../models/Rent');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const { Op } = require('sequelize');
const sequelize = require('../config');

// Créer une nouvelle location
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Vérifier si la chambre n'est pas déjà louée sur cette période
    const overlappingRent = await Rent.findOne({
      where: {
        id_room: req.body.id_room,
        [Op.or]: [
          {
            [Op.and]: {
              date_entrance: { [Op.lte]: req.body.date_entrance },
              [Op.or]: [
                { end_date: { [Op.gte]: req.body.date_entrance } },
                { end_date: null }
              ]
            }
          },
          {
            [Op.and]: {
              date_entrance: { [Op.lte]: req.body.end_date || '9999-12-31' },
              [Op.or]: [
                { end_date: { [Op.gte]: req.body.end_date || '9999-12-31' } },
                { end_date: null }
              ]
            }
          }
        ]
      },
      transaction
    });

    if (overlappingRent) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Cette chambre est déjà louée pendant cette période' 
      });
    }

    // Formater les données avant création
    const rentData = {
      id_tenant: parseInt(req.body.id_tenant),
      id_room: parseInt(req.body.id_room),
      date_entrance: req.body.date_entrance,
      rent_value: parseFloat(req.body.rent_value),
      charges: parseFloat(req.body.charges || 0),
      ...(req.body.end_date && { end_date: req.body.end_date })
    };

    const rent = await Rent.create(rentData, { transaction });
    await transaction.commit();
    
    // Récupérer la location créée avec ses relations
    const newRent = await Rent.findByPk(rent.id, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb']
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        }
      ]
    });

    res.status(201).json(newRent);
  } catch (error) {
    await transaction.rollback();
    console.error('Erreur création location:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création de la location',
      error: error.message 
    });
  }
});

// Récupérer toutes les locations
router.get('/', async (req, res) => {
  try {
    const rents = await Rent.findAll({ // Utiliser 'rent' pour le modèle
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb']
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        }
      ],
      order: [['date_entrance', 'DESC']]
    });

    res.json(rents);
  } catch (error) {
    console.error('Erreur récupération locations:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des locations',
      error: error.message 
    });
  }
});

// Mettre à jour une location par ID
router.put('/:id', async (req, res) => {
  console.log('\n🔵 PUT /rents/:id - Début de la requête');
  console.log('ID:', req.params.id);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const transaction = await sequelize.transaction();

  try {
    const rentId = req.params.id;
    
    // 1. Récupérer l'ancienne location pour comparaison
    const oldRent = await Rent.findByPk(rentId);
    if (!oldRent) {
      throw new Error('Location non trouvée');
    }
    console.log('🔍 Ancienne location:', JSON.stringify(oldRent.toJSON(), null, 2));

    // 2. Utiliser une requête SQL brute pour la mise à jour de la location
    await sequelize.query(
      `UPDATE rents 
       SET date_entrance = :date_entrance,
           end_date = :end_date,
           rent_value = :rent_value,
           charges = :charges,
           id_tenant = :id_tenant,
           id_room = :id_room
       WHERE id = :rentId`,
      {
        replacements: {
          rentId: rentId,
          date_entrance: req.body.date_entrance,
          end_date: req.body.end_date,
          rent_value: req.body.rent_value,
          charges: req.body.charges,
          id_tenant: req.body.id_tenant,
          id_room: req.body.id_room
        },
        transaction
      }
    );

    // 3. Vérifier si le trigger a bien mis à jour les paiements
    const payments = await Payment.findAll({
      where: { rent_id: rentId },
      transaction
    });

    console.log('✅ Paiements après mise à jour:', JSON.stringify(payments.map(p => p.toJSON()), null, 2));

    await transaction.commit();

    // 4. Récupérer la location mise à jour avec ses paiements
    const updatedRent = await Rent.findByPk(rentId, {
      include: [{
        model: Payment,
        as: 'payments'
      }]
    });

    console.log('✅ Location mise à jour:', JSON.stringify(updatedRent.toJSON(), null, 2));
    res.json(updatedRent);

  } catch (error) {
    await transaction.rollback();
    console.error('🔴 Erreur globale:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour de la location',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer une location par ID
router.delete('/:id', async (req, res) => {
  try {
    const rent = await Rent.findByPk(req.params.id);
    if (!rent) {
      return res.status(404).json({ message: 'Location non trouvée' });
    }
    await Rent.destroy();
    res.json({ message: 'Location supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression location:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la location',
      error: error.message 
    });
  }
});

module.exports = router;
```


### 📄 routes\rooms.js
```
const express = require('express');
const router = express.Router();
const room = require('../models/Room');
const property = require('../models/Property');

// Middleware de logging
const logRequest = (req, res, next) => {
  next();
};

router.use(logRequest);

// GET tous les chambres



router.get('/', async (req, res) => {
  try {
    // Retirer temporairement l'inclusion de property
    const rooms = await room.findAll();
    res.json(rooms);
  } catch (error) {
    console.error('Erreur détaillée:', error);
    res.status(500).json({ 
      message: "Erreur lors de la récupération des chambres",
      error: error.message 
    });
  }
});

// GET une chambre par ID
router.get('/:id', async (req, res) => {
  try {
    const roomRecord = await room.findByPk(req.params.id, {
      include: [{
        model: property,
        attributes: ['name']
      }]
    });
    if (!roomRecord) {
      return res.status(404).json({ message: "Chambre non trouvée" });
    }
    res.json(roomRecord);
  } catch (error) {
    console.error('Erreur GET /rooms/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST nouvelle chambre
router.post('/', async (req, res) => {
  try {
    const room = await room.create(req.body);
    res.status(201).json(room);
  } catch (error) {
    console.error('Erreur POST /rooms:', error);
    res.status(400).json({ 
      message: "Erreur lors de la création de la chambre",
      error: error.message 
    });
  }
});

// PUT mise à jour d'une chambre
router.put('/:id', async (req, res) => {
  try {
    const room = await room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Chambre non trouvée" });
    }
    await room.update(req.body);
    res.json(room);
  } catch (error) {
    console.error('Erreur PUT /rooms/:id:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE une chambre
router.delete('/:id', async (req, res) => {
  try {
    const room = await room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Chambre non trouvée" });
    }
    await room.destroy();
    res.json({ message: "Chambre supprimée avec succès" });
  } catch (error) {
    console.error('Erreur DELETE /rooms/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```


### 📄 routes\tenants.js
```
const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const { Op } = require('sequelize');
const sequelize = require('../config');

// Récupérer tous les locataires
router.get('/', async (req, res) => {
  try {
    const tenants = await Tenant.findAll();
    res.json(tenants);
  } catch (error) {
    console.error('🔴 Erreur dans GET /tenants:', error);
    res.status(500).json({ message: error.message });
  }
});

// Créer un nouveau locataire
router.post('/', async (req, res) => {
  try {
    console.log('📝 Tentative de création d\'un locataire:', req.body);

    // Exclure explicitement l'ID des données reçues
    const { id, ...tenantData } = req.body;

    // Vérifier si l'email existe déjà
    const existingTenant = await Tenant.findOne({
      where: { mail: tenantData.mail }
    });

    if (existingTenant) {
      return res.status(400).json({
        message: 'Un locataire avec cet email existe déjà'
      });
    }

    const tenant = await Tenant.create(tenantData);
    
    // Log pour debug
    console.log('✅ Locataire créé avec ID:', tenant.id);
    res.status(201).json(tenant);

  } catch (error) {
    console.error('🔴 Erreur dans POST /tenants:', error);
    // ... reste du code de gestion d'erreur
  }
});

// Mettre à jour un locataire
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    console.log(`📝 Tentative de mise à jour du locataire ${id}:`, req.body);

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ message: 'Locataire non trouvé' });
    }

    await tenant.update(req.body);
    console.log('✅ Locataire mis à jour:', tenant.toJSON());
    
    res.json(tenant);
  } catch (error) {
    console.error('🔴 Erreur dans PUT /tenants/:id:', error);
    next(error);
  }
});

// Supprimer un locataire
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    console.log(`🗑️ Tentative de suppression du locataire ${id}`);

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ message: 'Locataire non trouvé' });
    }

    await tenant.destroy();
    console.log('✅ Locataire supprimé');
    
    res.json({ message: 'Locataire supprimé avec succès' });
  } catch (error) {
    console.error('🔴 Erreur dans DELETE /tenants/:id:', error);
    next(error);
  }
});

// GET /api/tenants/:id - Récupérer un locataire par son ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching tenant with ID:', id);

    const tenant = await Tenant.findOne({
      where: { id: id },
      attributes: ['id', 'first_name', 'last_name', 'mail', 'phone']
    });

    if (!tenant) {
      return res.status(404).json({ 
        message: 'Locataire non trouvé' 
      });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération du locataire',
      error: error.message 
    });
  }
});


module.exports = router;
```


### 📄 scripts\createCertificate.js
```
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Créer le dossier certificates s'il n'existe pas
const certDir = path.join(__dirname, '..', 'certificates');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir);
}

// Générer un certificat auto-signé avec OpenSSL
const certPath = path.join(certDir, 'signature');
const config = {
  country: 'FR',
  state: 'Rhone',
  locality: 'AIX EN PROVENCE',
  organization: 'Pierre PARDOUX',
  commonName: 'Pierre PARDOUX Signing Certificate',
  emailAddress: 'p.pardoux@gmail.com.com'
};

try {
  // Générer la clé privée
  execSync(`openssl genrsa -out ${certPath}.key 2048`);

  // Générer la demande de certificat
  execSync(`openssl req -new -key ${certPath}.key -out ${certPath}.csr \
    -subj "/C=${config.country}/ST=${config.state}/L=${config.locality}/O=${config.organization}/CN=${config.commonName}/emailAddress=${config.emailAddress}"`);

  // Générer le certificat auto-signé
  execSync(`openssl x509 -req -days 365 -in ${certPath}.csr -signkey ${certPath}.key -out ${certPath}.crt`);

  // Convertir en format PKCS#12
  execSync(`openssl pkcs12 -export -out ${certPath}.p12 \
    -inkey ${certPath}.key \
    -in ${certPath}.crt \
    -passout pass:${certPassword}`);

  console.log('✅ Certificate generated successfully');

} catch (error) {
  console.error('🔴 Error generating certificate:', error);
}

```


### 📄 scripts\syncReceipts.js
```
const sequelize = require('../config');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Import des modèles après l'établissement des associations
const { Payment, Receipt, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');

// Vérification initiale
console.log('Checking associations...');
console.log('Payment associations:', Object.keys(Payment.associations));
console.log('Rent associations:', Object.keys(Rent.associations));

async function synchronizeReceipts() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🟦 Starting receipt synchronization...');

    // 1. Trouver tous les paiements payés qui n'ont pas de receipt
    const payments = await Payment.findAll({
      where: {
        status: 'paid',
        payment_date: {
          [Op.not]: null
        }
      },
      include: [{
        model: Receipt,
        as: 'receipt',
        required: false
      }]
    });

    const paymentsWithoutReceipt = payments.filter(p => !p.receipt);
    console.log(`Found ${paymentsWithoutReceipt.length} payments without receipts`);

    // 2. Pour chaque paiement, charger les données complètes
    for (const payment of paymentsWithoutReceipt) {
      try {
        // Charger les relations nécessaires pour ce paiement
        const fullPayment = await Payment.findByPk(payment.id, {
          include: [{
            model: Rent,
            as: 'rent',
            include: [
              { 
                model: Tenant,
                as: 'tenant'
              },
              {
                model: Room,
                as: 'room',
                include: [{
                  model: Property,
                  as: 'property'
                }]
              }
            ]
          }]
        });

        if (!fullPayment.rent) {
          console.log(`⚠️ Payment ${payment.id} has no associated rent, skipping...`);
          continue;
        }

        console.log(`Processing payment ${payment.id} for tenant ${fullPayment.rent.tenant.first_name} ${fullPayment.rent.tenant.last_name}`);

        // Générer le receipt
        const filePath = await generateReceipt(fullPayment, fullPayment.rent);

        // Créer l'entrée dans la base
        await Receipt.create({
          payment_id: payment.id,
          file_path: filePath,
          generated_at: new Date()
        }, { transaction });

        console.log(`✅ Created receipt for payment ${payment.id}`);
      } catch (error) {
        console.error(`Error processing payment ${payment.id}:`, error);
      }
    }

    await transaction.commit();
    console.log('✅ Synchronization completed successfully');

  } catch (error) {
    await transaction.rollback();
    console.error('🔴 Error during synchronization:', error);
    throw error;
  }
}

// Exécuter la synchronisation
synchronizeReceipts()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
```


### 📄 utils\dbUtils.js
```
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
```


### 📄 utils\receiptGenerator.js
```
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { SignPdf } = require('node-signpdf');
const signer = new SignPdf();

// Configuration du certificat
const CERTIFICATE_CONFIG = {
  p12Path: path.join(__dirname, '..', 'certificates', 'signature.p12'), // Chemin vers votre certificat P12
  certPassword: 'BBnn,,1122' // Mot de passe de votre certificat
};

async function signPDF(inputPath) {
  try {
    // Lire le PDF non signé
    const pdfBuffer = fs.readFileSync(inputPath);
    
    // Lire le certificat P12
    const p12Buffer = fs.readFileSync(CERTIFICATE_CONFIG.p12Path);

    // Signer le PDF
    const signedPdf = await signer.sign(pdfBuffer, p12Buffer, {
      passphrase: CERTIFICATE_CONFIG.certPassword,
      reason: 'Quittance de loyer',
      location: OWNER_INFO.city,
      signerName: OWNER_INFO.company,
      annotationAppearanceOptions: {
        signatureCoordinates: { left: 50, bottom: 100, right: 200, top: 150 },
        signatureDetails: [
          `Signé numériquement par: ${OWNER_INFO.company}`,
          `Date: ${new Date().toLocaleDateString('fr-FR')}`,
          'Raison: Quittance de loyer'
        ]
      }
    });

    // Écrire le PDF signé
    fs.writeFileSync(inputPath, signedPdf);
    console.log('✅ PDF successfully signed');

  } catch (error) {
    console.error('🔴 Error signing PDF:', error);
    throw error;
  }
}


function ensureDirectoryExistsSync(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log('✅ Directory created:', directoryPath);
  }
}

// Configuration du bailleur
const OWNER_INFO = {
  name: 'PARDOUX Pierre',           // Remplacez par le nom réel du bailleur
  company: '',          // Remplacez par le nom de la société
  address: '30 avenue Esprit Brondino',   // Remplacez par l'adresse réelle
  postalCode: '13290',         // Remplacez par le code postal réel
  city: 'AIX EN PROVENCE'         // Remplacez par la ville réelle
};

async function generateReceipt(payment, rent) {
  return new Promise((resolve, reject) => {
    try {
      console.log('🟦 Starting receipt generation for payment:', payment.id);
      
      // Vérification des données requises
      if (!payment || !rent || !rent.tenant || !rent.room || !rent.room.property) {
        throw new Error('Données manquantes pour la génération de la quittance');
      }

      // Convertir tous les montants en nombres et calculs
      const totalAmount = parseFloat(rent.rent_value) || 0;
      const chargesAmount = parseFloat(rent.charges) || 0;
      const rentAmount = totalAmount - chargesAmount; // Loyer hors charges

      console.log('🟦 Amounts calculated:', {
        total: totalAmount,
        charges: chargesAmount,
        rentOnly: rentAmount
      });

      // Création des chemins avec vérification
      const storageDir = path.resolve(__dirname, '..', 'storage');
      const receiptsDir = path.join(storageDir, 'receipts');
      const date = new Date(payment.payment_date);
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const year = date.getFullYear();
      const yearDir = path.join(receiptsDir, year.toString());
      const monthDir = path.join(yearDir, month);

      // Création des répertoires si nécessaire
      [storageDir, receiptsDir, yearDir, monthDir].forEach(dir => {
        ensureDirectoryExistsSync(dir);
      });

      const filename = `quittance_${payment.id}.pdf`;
      const absoluteFilePath = path.join(monthDir, filename);
      const relativeFilePath = path.join('storage', 'receipts', year.toString(), month, filename)
        .split(path.sep)
        .join('/');

      console.log('🟦 Generating receipt at:', absoluteFilePath);

      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(absoluteFilePath);

      writeStream.on('error', (error) => {
        console.error('🔴 Write Stream Error:', error);
        reject(error);
      });

      doc.pipe(writeStream);

      // En-tête
      doc.fontSize(20)
         .text('QUITTANCE DE LOYER', { align: 'center' })
         .moveDown();

      // Mois et année
      doc.fontSize(14)
         .text(`${month} ${year}`, { align: 'center' })
         .moveDown()
         .moveDown();

      // Informations du bailleur
      doc.fontSize(12)
         .text(OWNER_INFO.name, { underline: true })
         .moveDown()
         .text(OWNER_INFO.company)
         .text(OWNER_INFO.address)
         .text(`${OWNER_INFO.postalCode} ${OWNER_INFO.city}`)
         .moveDown()
         .moveDown();

      // Informations du locataire
      doc.text('LOCATAIRE :', { underline: true })
         .moveDown()
         .text(`${rent.tenant.first_name} ${rent.tenant.last_name}`)
         .text(`${rent.room.property.name} - Chambre ${rent.room.room_nb}`)
         .text(`${rent.room.property.address}`)
         .text(`${rent.room.property.postalcode} ${rent.room.property.city}`)
         .moveDown()
         .moveDown();

      // Détails du paiement
      doc.text('DÉTAILS DU PAIEMENT', { underline: true })
         .moveDown()
         .text(`Loyer : ${rentAmount.toFixed(2)} €`)
         .text(`Charges : ${chargesAmount.toFixed(2)} €`)
         .text(`Total : ${totalAmount.toFixed(2)} €`)
         .moveDown()
         .moveDown();

      // Texte de quittance
      doc.text(
        `Je soussigné ${OWNER_INFO.company}, bailleur, donne quittance à ${rent.tenant.first_name} ${rent.tenant.last_name} ` +
        `pour la somme de ${totalAmount.toFixed(2)} euros, ` +
        `au titre du loyer et des charges du logement désigné ci-dessus ` +
        `pour la période du 1er au dernier jour du mois de ${month} ${year}.`
      )
      .moveDown()
      .moveDown();

      // Date et signature
      const currentDate = new Date().toLocaleDateString('fr-FR');
      doc.text(`Fait à ${OWNER_INFO.city}, le ${currentDate}`)
         .moveDown()
         .moveDown()
         .text('Signature du bailleur :')
         .moveDown()
         .moveDown();

      // Pied de page
      doc.fontSize(8)
         .text(
           'Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du montant ci-dessus.',
           { align: 'center' }
         );

      //  on attend la signature
      writeStream.on('finish', async () => {
        try {
          // Signer le PDF après sa génération
          await signPDF(absoluteFilePath);
          console.log('✅ Receipt generated and signed successfully:', relativeFilePath);
          resolve(relativeFilePath);
        } catch (signError) {
          console.error('🔴 Error during signing:', signError);
          reject(signError);
        }
      });

      writeStream.on('error', (error) => {
        console.error('🔴 Write Stream Error:', error);
        reject(error);
      });

      // Finalisation du document
      doc.end();

    } catch (error) {
      console.error('🔴 Error in generateReceipt:', error);
      reject(error);
    }
  });
}

module.exports = {
  generateReceipt,
  ensureDirectoryExistsSync
};
```

📁 backend/
  📄 Server.js
  📄 config.js
  ⚙️ package.json
  📁 backup_postgresql/
  📁 certificates/
  📁 Data from excel/
  📁 models/
    📄 Payment.js
    📄 Property.js
    📄 Receipt.js
    📄 Rent.js
    📄 Room.js
    📄 Tenant.js
    📄 associations.js
  📁 routes/
    📄 payments.js
    📄 properties.js
    📄 receipts.js
    📄 rents.js
    📄 rooms.js
    📄 tenants.js
  📁 scripts/
    📄 createCertificate.js
    📄 syncReceipts.js
  📁 storage/
    📁 receipts/
      📁 2024/
        📁 août/
        📁 janvier/
        📁 novembre/
  📁 templates/
  📁 utils/
    📄 dbUtils.js
    📄 receiptGenerator.js