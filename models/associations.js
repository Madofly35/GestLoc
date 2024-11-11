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