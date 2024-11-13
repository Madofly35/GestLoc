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