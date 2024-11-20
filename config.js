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