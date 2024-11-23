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