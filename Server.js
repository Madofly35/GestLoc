const express = require('express');
const cors = require('cors');
const { sequelize, initializeDatabase } = require('./config');
const { setupAssociations } = require('./models/associations');
const propertiesRoutes = require('./routes/properties');
const roomsRoutes = require('./routes/rooms');
const tenantsRoutes = require('./routes/tenants');
const rentsRoutes = require('./routes/rents');
const paymentsRoutes = require('./routes/payments');
const receiptsRoutes = require('./routes/receipts');
const { resetSequence } = require('./utils/dbUtils');

const app = express();

// Configuration CORS
app.use(cors({
  origin: [
    "https://gest-loc-frontend.vercel.app",
    "https://gest-loc-frontend-gvdsg7woa-madofly35s-projects.vercel.app",
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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

// Route de test
app.get('/api/test', async (req, res) => {
  try {
    await sequelize.authenticate();
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

// Démarrage du serveur
async function startServer() {
  try {
    // Initialiser la base de données
    await initializeDatabase();
    
    // Configuration des associations
    setupAssociations();
    console.log('✅ Model associations configured');

    // Synchroniser les modèles
    await sequelize.sync();
    console.log('✅ Models synchronized with database');

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