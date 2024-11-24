# Analyse du Projet
Dossier racine: C:/Users/Pierre/Desktop/App/GestLoc/backend


## Structure du Projet
```

### 📄 Server.js
```
const express = require('express');
const cors = require('cors');
const {sequelize} = require('./config'); // Importer la config Sequelize
const {setupAssociations} = require('./models/associations'); // Importer les associations
const { initializeRent } = require('./models/Rent');
const propertiesRoutes = require(require('path').join(__dirname, 'routes', 'properties')); 
const roomsRoutes = require('./routes/rooms');
const tenantsRoutes = require('./routes/tenants');
const rentsRoutes = require('./routes/rents');
const paymentsRoutes = require('./routes/payments');
const receiptsRoutes = require('./routes/receipts');
const { resetSequence } = require('./utils/dbUtils');
const verificationRoutes = require('./routes/verification');
const documentsRoutes = require('./routes/documents');

async function initializeDatabase() {
  try {
    // Connexion à la base de données
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie avec succès.');

    // Configuration des associations
    setupAssociations();

    // Synchronisation des modèles
    await sequelize.sync({ alter: true });
    console.log('✅ Modèles synchronisés avec la base de données.');

    // Réinitialisation des séquences si nécessaire
    await resetSequence('tenants');
    console.log('✅ Séquences réinitialisées.');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
}

// Initialisation de l'application Express
const app = express();

// Configuration CORS
app.use(cors({
  origin: [
    "https://gest-loc-frontend.vercel.app",
    "https://gest-loc-frontend-2at6zij43-madofly35s-projects.vercel.app",
    "https://gest-loc-frontend-acyev48su-madofly35s-projects.vercel.app",
    /\.vercel\.app$/ // Pour accepter tous les sous-domaines Vercel
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 
}));

// Middleware pour parser le JSON
app.use(express.json());


// Routes
app.use('/api/properties', propertiesRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/rents', rentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api', receiptsRoutes);
app.use('/api', verificationRoutes);
app.use('/api', documentsRoutes);
app.options('*', cors());


// Ajouter après vos autres routes
app.get('/api/test', async (req, res) => {
  try {
    // Test de la connexion
    await sequelize.authenticate();
    
    // Récupérer quelques statistiques basiques
    const stats = await Promise.all([
      sequelize.models.Property.count(),
      sequelize.models.Room.count(),
      sequelize.models.Tenant.count(),
      sequelize.models.Rent.count()
    ]);

    res.json({
      status: 'success',
      message: 'Connexion à la base de données établie',
      statistics: {
        properties: stats[0],
        rooms: stats[1],
        tenants: stats[2],
        rents: stats[3]
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur de connexion à la base de données',
      error: error.message
    });
  }
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur', error: err.message });
});

const PORT = process.env.PORT || 3000;

// Démarrage du serveur avec initialisation de la base de données
async function startServer() {
  try {
    // Initialiser la base de données avec les permissions
    await initializeDatabase();

    // Démarrer le serveur Express
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
}
startServer();

module.exports = app;
```


### 📄 config.js
```
// config.js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const { createClient } = require('@supabase/supabase-js');

console.log('📊 Configuration de connexion:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

// Configuration Sequelize avec options SASL
const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    keepAlive: true,
    clientMinMessages: 'error',
    application_name: 'gestloc_app'
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 60000,
    idle: 10000,
    evict: 1000
  },
  retry: {
    max: 3,
    backoffBase: 1000,
    backoffExponent: 1.5,
  },
  logging: console.log,
  define: {
    timestamps: false,
    underscored: true
  }
});

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Vérifier et modifier les permissions
    await sequelize.query(`
      DO $$ 
      BEGIN 
        ALTER TABLE IF EXISTS receipts DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
        
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${process.env.DB_USER};
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${process.env.DB_USER};
      EXCEPTION
        WHEN others THEN
          RAISE NOTICE 'Error setting up permissions: %', SQLERRM;
      END $$;
    `);

    console.log('✅ Database permissions configured');
    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  supabase: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY),
  initializeDatabase
};
```


### ⚙️ package.json
```
[Fichier de configuration du projet: package.json]
```


### 📄 models\Document.js
```
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

```


### 📄 models\Payment.js
```
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
```


### 📄 models\Property.js
```
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

```


### 📄 models\Receipt.js
```
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
  },
  storage_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  storage_url: {
    type: DataTypes.STRING,
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
const { DataTypes ,Op } = require('sequelize');
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

});

module.exports = { Rent };
```


### 📄 models\Room.js
```

```
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
```


### 📄 models\Tenant.js
```
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


### 📄 routes\Properties.js
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


### 📄 routes\applications.js
```
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // TODO: Sauvegarder la candidature
    // TODO: Envoyer un email de confirmation
    res.status(201).json({ message: 'Candidature enregistrée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```


### 📄 routes\documents.js
```
// backend/routes/documents.js

const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const { Receipt, Payment, Rent, Tenant } = require('../models/associations');
const multer = require('multer');

// Configuration de multer pour la gestion des fichiers
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// Route de téléchargement des quittances
router.get('/receipts/:id/download', async (req, res) => {
  try {
    const receipt = await Receipt.findOne({
      where: { id: req.params.id },
      include: [{
        model: Payment,
        as: 'payment',
        include: [{
          model: Rent,
          as: 'rent',
          include: [{
            model: Tenant,
            as: 'tenant'
          }]
        }]
      }]
    });

    if (!receipt) {
      return res.status(404).json({ message: 'Quittance non trouvée' });
    }

    // Vérification des permissions
    // Si l'utilisateur est locataire, vérifier que la quittance lui appartient
    if (req.user.role === 'tenant' && 
        receipt.payment.rent.tenant.id !== req.user.tenant_id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Générer une nouvelle URL signée (les anciennes expirent après 1h)
    const signedUrl = await storageService.getFileUrl(
      storageService.buckets.receipts,
      receipt.storage_path
    );

    // Mettre à jour la date de téléchargement
    await receipt.update({
      downloaded_at: new Date()
    });

    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Erreur téléchargement quittance:', error);
    res.status(500).json({ 
      message: 'Erreur lors du téléchargement',
      error: error.message 
    });
  }
});

// Route générique pour télécharger un document
router.get('/documents/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ['contracts', 'documents', 'tickets'];
  
  try {
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Type de document invalide' });
    }

    // Récupérer les métadonnées du document depuis la base de données
    // (à adapter selon votre modèle de données)
    const document = await Document.findOne({
      where: { id },
      include: [{
        model: Tenant,
        as: 'tenant'
      }]
    });

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    // Vérification des permissions
    if (req.user.role === 'tenant' && 
        document.tenant.id !== req.user.tenant_id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Générer une URL signée
    const signedUrl = await storageService.getFileUrl(
      storageService.buckets[type],
      document.storage_path
    );

    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Erreur téléchargement document:', error);
    res.status(500).json({ 
      message: 'Erreur lors du téléchargement',
      error: error.message 
    });
  }
});

// Route pour l'upload de documents
router.post('/documents/:type', upload.single('file'), async (req, res) => {
  const { type } = req.params;
  const validTypes = ['contracts', 'documents', 'tickets'];

  try {
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Type de document invalide' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Upload vers Supabase
    const storagePath = `${req.user.tenant_id}/${Date.now()}_${req.file.originalname}`;
    const storageFile = await storageService.uploadFile(
      req.file,
      storageService.buckets[type],
      storagePath
    );

    // Sauvegarder les métadonnées dans la base de données
    const document = await Document.create({
      tenant_id: req.user.tenant_id,
      type,
      name: req.file.originalname,
      storage_path: storageFile.path,
      storage_url: storageFile.url,
      mime_type: req.file.mimetype,
      size: req.file.size
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Erreur upload document:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload',
      error: error.message 
    });
  }
});

// Route pour supprimer un document
router.delete('/documents/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ['contracts', 'documents', 'tickets'];

  try {
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Type de document invalide' });
    }

    const document = await Document.findOne({
      where: { id },
      include: [{
        model: Tenant,
        as: 'tenant'
      }]
    });

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    // Vérification des permissions (seul le propriétaire peut supprimer)
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Action non autorisée' });
    }

    // Supprimer de Supabase
    await storageService.deleteFile(
      storageService.buckets[type],
      document.storage_path
    );

    // Supprimer de la base de données
    await document.destroy();

    res.json({ message: 'Document supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression document:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: error.message 
    });
  }
});

module.exports = router;

```


### 📄 routes\payments.js
```
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const {sequelize} = require('../config');
const path = require('path');
const fs = require('fs');
const { Payment, Receipt, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');

// Fonctions de formatage des dates
const formatDateForDB = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

const formatDateFromDB = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

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

    const startDate = new Date(yearNum, monthNum -1, 1);
    const endDate = new Date(yearNum, monthNum, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log('Fetching payments for period:', { 
      startDate: formatDateFromDB(startDate), 
      endDate: formatDateFromDB(endDate)
    });

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

    const statistics = {
      expected_amount: 0,
      received_amount: 0,
      pending_amount: 0,
      late_payments: 0
    };

    const formattedPayments = payments.map(payment => {
      const amount = parseFloat(payment.amount) || 0;
      
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
        payment_date: formatDateFromDB(payment.payment_date),
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

    const paymentDate = new Date();
    await payment.update({
      status: 'paid',
      payment_date: formatDateForDB(paymentDate)
    }, { transaction });

    console.log('✅ Payment updated successfully');

    try {
      ensureStorageExists();
      const filePath = await generateReceipt(payment, payment.rent);
      
      await Receipt.create({
        payment_id: payment.id,
        file_path: filePath,
        generated_at: formatDateForDB(paymentDate)
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
        payment_date: formatDateFromDB(payment.payment_date),
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


### 📄 routes\receipts.js
```
const express = require('express');
const router = express.Router();
const { Receipt, Payment, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');
const storageService = require('../services/storageService');

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

    const formattedPayments = await Promise.all(payments.map(async payment => {
      if (!payment.rent?.tenant || !payment.rent?.room?.property) {
        console.warn('⚠️ Missing data for payment:', payment.id);
        return null;
      }

      const rent = payment.rent;
      const paymentDate = new Date(payment.payment_date);
      const fileData = {
        id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        month: paymentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        receipt_generated: !!payment.paymentReceipt,
        tenant_name: `${rent.tenant.first_name} ${rent.tenant.last_name}`,
        property_name: rent.room.property.name,
        property_address: rent.room.property.address,
        room_number: rent.room.room_nb,
        rent_period: {
          start: rent.date_entrance,
          end: rent.end_date || 'En cours'
        }
      };

      // Ajouter l'URL Supabase si la quittance existe
      if (payment.paymentReceipt) {
        try {
          const filePath = `tenant_${tenantId}/${paymentDate.getFullYear()}/${paymentDate.toLocaleDateString('fr-FR', { month: 'long' })}/receipt_${payment.id}.pdf`;
          fileData.receipt_url = await storageService.getFileUrl(storageService.buckets.receipts, filePath);
        } catch (error) {
          console.warn('⚠️ Error getting receipt URL:', error);
        }
      }

      return fileData;
    }));

    const validPayments = formattedPayments.filter(Boolean);
    console.log('✅ Formatted payments:', validPayments);
    res.json(validPayments);

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

    if (!payment.rent?.tenant || !payment.rent?.room?.property) {
      return res.status(400).json({ message: "Données incomplètes pour générer la quittance" });
    }

    try {
      console.log('🟦 Payment data:', {
        id: payment.id,
        amount: payment.amount,
        tenant: payment.rent.tenant.first_name + ' ' + payment.rent.tenant.last_name
      });

      let receipt = payment.paymentReceipt;
      let fileUrl;

      if (!receipt) {
        console.log('🟦 No receipt found, generating new one...');
        const result = await generateReceipt(payment, payment.rent);
        
        receipt = await Receipt.create({
          payment_id: payment.id,
          storage_path: result.path,
          storage_url: result.url,
          generated_at: new Date()
        });

        fileUrl = result.url;
        console.log('✅ New receipt created:', receipt.id);
      } else {
        try {
          fileUrl = await storageService.getFileUrl(
            storageService.buckets.receipts, 
            receipt.storage_path
          );
        } catch (error) {
          console.log('🟦 Error getting existing receipt, regenerating...');
          const result = await generateReceipt(payment, payment.rent);
          await receipt.update({ 
            storage_path: result.path,
            storage_url: result.url 
          });
          fileUrl = result.url;
        }
      }

      // Mettre à jour la date de téléchargement
      await receipt.update({ downloaded_at: new Date() });

      res.json({ url: fileUrl });

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
const { Sequelize, Op } = require('sequelize');
const {Rent} = require('../models/Rent');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const {sequelize} = require('../config');

// Fonction utilitaire pour réinitialiser la séquence si nécessaire
async function resetRentSequence(transaction) {
  try {
    await sequelize.query(
      `SELECT setval(pg_get_serial_sequence('rents', 'id'), (SELECT MAX(id) FROM rents));`,
      { transaction }
    );
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la séquence:', error);
    throw error;
  }
}

// Créer une nouvelle location
router.post('/', async (req, res) => {
  let transaction = null;
  
  try {
    console.log('Données reçues:', req.body);

    // Validation préliminaire des données
    if (!req.body.id_tenant || !req.body.id_room || !req.body.date_entrance || !req.body.rent_value) {
      return res.status(400).json({
        message: 'Données manquantes',
        required: ['id_tenant', 'id_room', 'date_entrance', 'rent_value'],
        received: req.body
      });
    }

    // Formatage des données
    const rentData = {
      id_tenant: parseInt(req.body.id_tenant),
      id_room: parseInt(req.body.id_room),
      date_entrance: new Date(req.body.date_entrance).toISOString().split('T')[0],
      rent_value: parseFloat(req.body.rent_value),
      charges: parseFloat(req.body.charges || 0),
      end_date: req.body.end_date ? 
        new Date(req.body.end_date).toISOString().split('T')[0] : null
    };

    console.log('Données formatées:', rentData);

    // Démarrer la transaction avec un niveau d'isolation approprié
    transaction = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    // Réinitialiser la séquence avant l'insertion
    await resetRentSequence(transaction);

    // Vérification de l'existence du locataire et de la chambre
    const [tenant, room] = await Promise.all([
      Tenant.findByPk(rentData.id_tenant, { transaction }),
      Room.findByPk(rentData.id_room, { transaction })
    ]);

    if (!tenant || !room) {
      throw new Error(!tenant ? 'Locataire non trouvé' : 'Chambre non trouvée');
    }

    // Création de la location avec gestion des erreurs de séquence
    let rent;
    try {
      rent = await Rent.create(rentData, { 
        transaction,
        retry: {
          max: 0
        }
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        await resetRentSequence(transaction);
        rent = await Rent.create(rentData, { transaction });
      } else {
        throw error;
      }
    }

    // Commit de la transaction
    await transaction.commit();

    // Récupération des données complètes
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
    console.error('Erreur lors de la création:', error);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    if (error.message.includes('trouvé')) {
      return res.status(404).json({
        message: error.message
      });
    }

    res.status(500).json({
      message: 'Erreur lors de la création de la location',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name,
        sql: error.sql,
        parameters: error.parameters
      } : error.message
    });
  }
});

// Récupérer toutes les locations
router.get('/', async (req, res) => {
  try {
    const rents = await Rent.findAll({
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb'],
          include: [{
            model: Property,
            as: 'property',
            attributes: ['name', 'address']
          }]
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
});

// Récupérer une location par ID
router.get('/:id', async (req, res) => {
  try {
    const rent = await Rent.findByPk(req.params.id, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb'],
          include: [{
            model: Property,
            as: 'property',
            attributes: ['name', 'address']
          }]
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        },
        {
          model: Payment,
          as: 'payments'
        }
      ]
    });

    if (!rent) {
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    res.json(rent);
  } catch (error) {
    console.error('Erreur récupération location:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération de la location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
});

// Mettre à jour une location
router.put('/:id', async (req, res) => {
  let transaction = null;

  try {
    transaction = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    // Vérifier l'existence de la location
    const rent = await Rent.findByPk(req.params.id, { transaction });
    if (!rent) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    // Vérifier l'existence du locataire et de la chambre si modifiés
    if (req.body.id_tenant) {
      const tenant = await Tenant.findByPk(req.body.id_tenant, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Locataire non trouvé' });
      }
    }

    if (req.body.id_room) {
      const room = await Room.findByPk(req.body.id_room, { transaction });
      if (!room) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Chambre non trouvée' });
      }
    }

    // Préparation des données de mise à jour
    const updateData = {
      id_tenant: req.body.id_tenant || rent.id_tenant,
      id_room: req.body.id_room || rent.id_room,
      date_entrance: req.body.date_entrance ? 
        new Date(req.body.date_entrance).toISOString().split('T')[0] : 
        rent.date_entrance,
      end_date: req.body.end_date ? 
        new Date(req.body.end_date).toISOString().split('T')[0] : 
        rent.end_date,
      rent_value: req.body.rent_value || rent.rent_value,
      charges: req.body.charges !== undefined ? req.body.charges : rent.charges
    };

    // Mise à jour de la location
    await rent.update(updateData, { transaction });

    await transaction.commit();

    // Récupération des données mises à jour
    const updatedRent = await Rent.findByPk(req.params.id, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb'],
          include: [{
            model: Property,
            as: 'property',
            attributes: ['name', 'address']
          }]
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        },
        {
          model: Payment,
          as: 'payments'
        }
      ]
    });

    res.json(updatedRent);

  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    res.status(500).json({
      message: 'Erreur lors de la mise à jour de la location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
});

// Supprimer une location
router.delete('/:id', async (req, res) => {
  let transaction = null;

  try {
    transaction = await sequelize.transaction();

    const rent = await Rent.findByPk(req.params.id, { transaction });
    
    if (!rent) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    await rent.destroy({ transaction });
    await transaction.commit();
    
    res.json({ message: 'Location supprimée avec succès' });

  } catch (error) {
    console.error('Erreur suppression location:', error);
    
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
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
const {sequelize} = require('../config');

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


### 📄 routes\verification.js
```
// backend/routes/verification.js
const express = require('express');
const router = express.Router();
const { verifyReceipt } = require('../utils/receiptGenerator');

router.get('/verify/:hash', async (req, res) => {
  try {
    const receipt = await verifyReceipt(req.params.hash);
    if (!receipt) {
      return res.status(404).json({
        status: 'error',
        message: 'Document non trouvé'
      });
    }

    res.json({
      status: 'success',
      data: {
        isValid: true,
        documentInfo: {
          type: 'Quittance de loyer',
          date: receipt.generated_at,
          tenant: `${receipt.Payment.Rent.Tenant.first_name} ${receipt.Payment.Rent.Tenant.last_name}`,
          property: receipt.Payment.Rent.Room.Property.name,
          amount: receipt.Payment.amount
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;

```


### 📄 scripts\certificateGenerator.js
```
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

function generateCertificate() {
  const certDir = path.join(__dirname, '..', 'certificates');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
  }

  // Générer une paire de clés
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // Créer le certificat
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{
    name: 'commonName',
    value: 'Pierre PARDOUX'
  }, {
    name: 'countryName',
    value: 'FR'
  }, {
    shortName: 'ST',
    value: 'Rhone'
  }, {
    name: 'localityName',
    value: 'AIX EN PROVENCE'
  }, {
    name: 'organizationName',
    value: 'Pierre PARDOUX'
  }, {
    name: 'emailAddress',
    value: 'p.pardoux@gmail.com'
  }];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  // Exporter les fichiers
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey, 
    cert, 
    'BBnn,,1122',
    { generateLocalKeyId: true }
  );

  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Path = path.join(certDir, 'signature.p12');
  
  fs.writeFileSync(p12Path, Buffer.from(p12Der, 'binary'));
  console.log('✅ Certificate generated successfully');
}

generateCertificate();

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


### 📄 services\storageService.js
```
const { createClient } = require('@supabase/supabase-js');

class StorageService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // Alignement avec la structure Supabase
    this.buckets = {
      documents: 'tenant-documents',
      contracts: 'tenant-contracts',
      receipts: 'tenant-receipts',
      pictures: 'proprieties-pictures'
    };
  }

  getReceiptPath(payment, tenant) {
    const date = new Date(payment.payment_date);
    const year = date.getFullYear();
    const month = date.toLocaleDateString('fr-FR', { month: 'long' });
    
    // Format: tenant-receipts/tenant_[ID]/[YEAR]/[MONTH]/receipt_[PAYMENT_ID].pdf
    return `tenant_${tenant.id}/${year}/${month}/receipt_${payment.id}.pdf`;
  }

  async uploadFile(file, bucketName, filePath) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer || file, {
        contentType: file.mimetype || 'application/pdf',
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = await this.supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600); // URL valide 1h

    return {
      path: filePath,
      url: urlData.signedUrl
    };
  }

  async getFileUrl(bucketName, filePath) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  }

  async deleteFile(bucketName, filePath) {
    const { error } = await this.supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) throw error;
    return true;
  }
}

module.exports = new StorageService();
```


### 📄 utils\dbUtils.js
```
// backend/utils/dbUtils.js
const {sequelize} = require('../config');

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
const forge = require('node-forge');
const storageService = require('../services/storageService');

// Configuration du bailleur
const OWNER_INFO = {
  name: 'PARDOUX Pierre',
  company: '',
  address: '30 avenue Esprit Brondino',
  postalCode: '13290',
  city: 'AIX EN PROVENCE'
};

function addDigitalSignature(pdfBuffer) {
  try {
    // Créer une signature
    const md = forge.md.sha256.create();
    md.update(pdfBuffer.toString('binary'));

    // Créer les attributs du signataire
    const attrs = [{
      name: 'commonName',
      value: OWNER_INFO.name
    }, {
      name: 'countryName',
      value: 'FR'
    }, {
      shortName: 'ST',
      value: 'PACA'
    }, {
      name: 'localityName',
      value: OWNER_INFO.city
    }];

    // Générer une paire de clés
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);

    // Signer
    const signature = keys.privateKey.sign(md);

    // Ajouter les métadonnées de signature
    const signedPdfBuffer = Buffer.concat([
      pdfBuffer,
      Buffer.from('\n%Signed by: ' + OWNER_INFO.name + '\n'),
      Buffer.from('%Signature date: ' + new Date().toISOString() + '\n'),
      Buffer.from('%Digital Signature: ' + signature.toString('base64') + '\n'),
      Buffer.from('%Certificate: ' + forge.pki.certificateToPem(cert))
    ]);

    return signedPdfBuffer;
  } catch (error) {
    console.error('⚠️ Signature error:', error);
    return pdfBuffer;
  }
}

async function generateReceipt(payment, rent) {
  return new Promise((resolve, reject) => {
    try {
      if (!payment || !rent || !rent.tenant || !rent.room || !rent.room.property) {
        throw new Error('Données manquantes pour la génération de la quittance');
      }

      const totalAmount = parseFloat(rent.rent_value) || 0;
      const chargesAmount = parseFloat(rent.charges) || 0;
      const rentAmount = totalAmount - chargesAmount;

      const buffers = [];
      const doc = new PDFDocument();
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          const signedPdfBuffer = addDigitalSignature(pdfBuffer);

          const date = new Date(payment.payment_date);
          const filePath = `tenant_${rent.tenant.id}/${date.getFullYear()}/${date.toLocaleDateString('fr-FR', { month: 'long' })}/receipt_${payment.id}.pdf`;

          const result = await storageService.uploadFile(
            { 
              buffer: signedPdfBuffer,
              mimetype: 'application/pdf'
            },
            storageService.buckets.receipts,
            filePath
          );

          resolve({
            path: filePath,
            url: result.url
          });
        } catch (error) {
          reject(error);
        }
      });

      // Contenu du PDF
      doc.fontSize(20)
         .text('QUITTANCE DE LOYER', { align: 'center' })
         .moveDown();

      const date = new Date(payment.payment_date);
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const year = date.getFullYear();

      doc.fontSize(14)
         .text(`${month} ${year}`, { align: 'center' })
         .moveDown()
         .moveDown();

      doc.fontSize(12)
         .text(OWNER_INFO.name, { underline: true })
         .moveDown()
         .text(OWNER_INFO.company)
         .text(OWNER_INFO.address)
         .text(`${OWNER_INFO.postalCode} ${OWNER_INFO.city}`)
         .moveDown()
         .moveDown();

      doc.text('LOCATAIRE :', { underline: true })
         .moveDown()
         .text(`${rent.tenant.first_name} ${rent.tenant.last_name}`)
         .text(`${rent.room.property.name} - Chambre ${rent.room.room_nb}`)
         .text(`${rent.room.property.address}`)
         .text(`${rent.room.property.postalcode} ${rent.room.property.city}`)
         .moveDown()
         .moveDown();

      doc.text('DÉTAILS DU PAIEMENT', { underline: true })
         .moveDown()
         .text(`Loyer : ${rentAmount.toFixed(2)} €`)
         .text(`Charges : ${chargesAmount.toFixed(2)} €`)
         .text(`Total : ${totalAmount.toFixed(2)} €`)
         .moveDown()
         .moveDown();

      doc.text(
        `Je soussigné ${OWNER_INFO.name}, bailleur, donne quittance à ${rent.tenant.first_name} ${rent.tenant.last_name} ` +
        `pour la somme de ${totalAmount.toFixed(2)} euros, ` +
        `au titre du loyer et des charges du logement désigné ci-dessus ` +
        `pour la période du 1er au dernier jour du mois de ${month} ${year}.`
      )
      .moveDown()
      .moveDown();

      const currentDate = new Date().toLocaleDateString('fr-FR');
      doc.text(`Fait à ${OWNER_INFO.city}, le ${currentDate}`)
         .moveDown()
         .moveDown()
         .text('Signature du bailleur :')
         .moveDown()
         .moveDown();

      doc.fontSize(8)
         .text(
           'Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du montant ci-dessus.',
           { align: 'center' }
         )
         .moveDown()
         .text('Document signé électroniquement', { align: 'center' });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

async function verifyReceipt(filePath) {
  try {
    const url = await storageService.getFileUrl(
      storageService.buckets.receipts,
      filePath
    );

    return {
      isValid: true,
      url: url
    };
  } catch (error) {
    console.error('Error verifying receipt:', error);
    throw error;
  }
}

module.exports = {
  generateReceipt,
  verifyReceipt
};
```

📁 backend/
  📄 Server.js
  📄 config.js
  ⚙️ package.json
  📁 certificates/
  📁 models/
    📄 Document.js
    📄 Payment.js
    📄 Property.js
    📄 Receipt.js
    📄 Rent.js
    📄 Room.js
    📄 Tenant.js
    📄 associations.js
  📁 routes/
    📄 Properties.js
    📄 applications.js
    📄 documents.js
    📄 payments.js
    📄 receipts.js
    📄 rents.js
    📄 rooms.js
    📄 tenants.js
    📄 verification.js
  📁 scripts/
    📄 certificateGenerator.js
    📄 syncReceipts.js
  📁 services/
    📄 storageService.js
  📁 templates/
  📁 utils/
    📄 dbUtils.js
    📄 receiptGenerator.js