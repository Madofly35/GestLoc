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
    application_name: 'gestloc_app',
    role: process.env.DB_ROLE || 'postgres'
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
    underscored: true,
    schema: 'public'
  }
});

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Vérifier et créer les rôles et permissions nécessaires
    await sequelize.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT FROM pg_catalog.pg_roles WHERE rolname = current_user
        ) THEN
          CREATE ROLE ${process.env.DB_ROLE || 'postgres'};
        END IF;
        
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${process.env.DB_ROLE || 'postgres'};
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${process.env.DB_ROLE || 'postgres'};
      EXCEPTION
        WHEN others THEN
          RAISE NOTICE 'Error setting up permissions: %', SQLERRM;
      END $$;
    `);
    
    console.log('✅ Database permissions configured');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

module.exports = {
  sequelize,
  supabase: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY),
  testConnection,
  testConnectionWithPg
};