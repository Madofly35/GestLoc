const express = require('express');
const router = express.Router();
const { Sequelize, Op } = require('sequelize');
const { Rent, Room, Tenant, Payment } = require('../models');
const { sequelize } = require('../config');

/**
 * Crée les paiements mensuels associés à une location
 */
async function createPayments(rent, transaction) {
  const payments = [];
  let currentDate = new Date(rent.date_entrance);
  const endDate = rent.end_date ? new Date(rent.end_date) : null;

  while (!endDate || currentDate <= endDate) {
    payments.push({
      rent_id: rent.id,
      due_date: new Date(currentDate),
      amount: rent.rent_value + rent.charges,
      status: 'PENDING'
    });

    currentDate.setMonth(currentDate.getMonth() + 1);
    if (!endDate && payments.length >= 24) break; // Limite de 24 mois si pas de date de fin
  }

  if (payments.length > 0) {
    await Payment.bulkCreate(payments, { transaction });
  }
}

// Route POST simplifiée
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // 1. Validation et formatage des données
    const rentData = {
      id_tenant: parseInt(req.body.id_tenant),
      id_room: parseInt(req.body.id_room),
      date_entrance: new Date(req.body.date_entrance).toISOString().split('T')[0],
      rent_value: parseFloat(req.body.rent_value),
      charges: parseFloat(req.body.charges || 0),
      end_date: req.body.end_date ? 
        new Date(req.body.end_date).toISOString().split('T')[0] : null
    };

    // 2. Vérifications préliminaires
    const [tenant, room] = await Promise.all([
      Tenant.findByPk(rentData.id_tenant, { transaction }),
      Room.findByPk(rentData.id_room, { transaction })
    ]);

    if (!tenant || !room) {
      await transaction.rollback();
      return res.status(404).json({
        message: !tenant ? 'Locataire non trouvé' : 'Chambre non trouvée'
      });
    }

    // 3. Création de la location
    const rent = await Rent.create(rentData, { transaction });

    // 4. Création des paiements associés
    await createPayments(rent, transaction);

    // 5. Commit de la transaction
    await transaction.commit();

    // 6. Récupération des données complètes
    const newRent = await Rent.findByPk(rent.id, {
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
          attributes: ['first_name', 'last_name', 'mail']
        },
        {
          model: Payment,
          as: 'payments',
          attributes: ['due_date', 'amount', 'status']
        }
      ]
    });

    res.status(201).json(newRent);

  } catch (error) {
    await transaction.rollback();
    
    console.error('Erreur création location:', error);
    
    res.status(500).json({
      message: 'Erreur lors de la création de la location',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

module.exports = router;