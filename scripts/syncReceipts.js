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