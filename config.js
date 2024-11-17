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
    // Options spécifiques pour SCRAM-SHA-256
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
    max: 0,
    backoffBase: 1000,
    backoffExponent: 1.5,
  },
  logging: console.log,
  define: {
    timestamps: false,
    underscored: true
  }
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie avec succès.');
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    if (error.message.includes('SASL')) {
      console.error('⚠️ Erreur d\'authentification SASL. Vérifiez vos identifiants.');
    }
    return false;
  }
};

// Créer un script de test de connexion séparé pour le débogage
const testConnectionWithPg = async () => {
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Test de connexion PG réussi');
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Test de connexion PG échoué:', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  supabase: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY),
  testConnection,
  testConnectionWithPg
};