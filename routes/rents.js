const express = require('express');
const router = express.Router();
const { Sequelize, Op } = require('sequelize');
const {Rent} = require('../models/Rent');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const {sequelize} = require('../config');

// Créer une nouvelle location
router.post('/', async (req, res) => {
  let transaction = null;  // Initialisation explicite à null
  
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

    // Début de la transaction
    transaction = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    // Vérification de l'existence du locataire et de la chambre
    const [tenant, room] = await Promise.all([
      Tenant.findByPk(rentData.id_tenant, { transaction }),
      Room.findByPk(rentData.id_room, { transaction })
    ]);

    if (!tenant || !room) {
      await transaction.rollback();
      return res.status(400).json({
        message: !tenant ? 'Locataire non trouvé' : 'Chambre non trouvée',
        id_tenant: rentData.id_tenant,
        id_room: rentData.id_room
      });
    }

    // Vérification des chevauchements
    const overlapping = await Rent.findOne({
      where: {
        id_room: rentData.id_room,
        id: { [Op.ne]: rentData.id || 0 }, // Exclure la location en cours de modification
        [Op.or]: [
          // Cas 1: nouvelle date_entrance est pendant une location existante
          {
            [Op.and]: [
              { date_entrance: { [Op.lte]: rentData.date_entrance } },
              { 
                [Op.or]: [
                  { end_date: null },
                  { end_date: { [Op.gte]: rentData.date_entrance } }
                ]
              }
            ]
          },
          // Cas 2: nouvelle end_date est pendant une location existante
          {
            [Op.and]: [
              { date_entrance: { [Op.lte]: rentData.end_date || '9999-12-31' } },
              {
                [Op.or]: [
                  { end_date: null },
                  { end_date: { [Op.gte]: rentData.date_entrance } }
                ]
              }
            ]
          }
        ]
      },
      transaction
    });
    
    if (overlapping) {
      console.log('Chevauchement trouvé:', overlapping.toJSON());
      await transaction.rollback();
      return res.status(400).json({
        message: 'Cette période chevauche une location existante',
        details: {
          conflictingRent: {
            id: overlapping.id,
            date_entrance: overlapping.date_entrance,
            end_date: overlapping.end_date
          }
        }
      });
    }


    console.log('Vérification des dates:', {
      date_entrance: rentData.date_entrance,
      end_date: rentData.end_date,
      formatted_end_date: rentData.end_date || '9999-12-31'
    });

    
    // Création de la location
    let rent;
    try {
      rent = await Rent.create(rentData, {
        transaction,
        validate: false
      });
    } catch (createError) {
      await transaction.rollback();
      throw createError;
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
    // S'assurer que la transaction est annulée en cas d'erreur
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    console.error('Erreur détaillée:', {
      message: error.message,
      name: error.name,
      errors: error.errors
    });

    res.status(500).json({
      message: 'Erreur lors de la création de la location',
      error: error.message
    });
  }
});

// Récupérer toutes les locations
router.get('/', async (req, res) => {
  try {
    const rents = await Rent.findAll({ // Utiliser 'rent' pour le modèle
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
      ],
      order: [['date_entrance', 'DESC']]
    });

    res.json(rents);
  } catch (error) {
    console.error('Erreur récupération locations:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des locations',
      error: error.message 
    });
  }
});

// Mettre à jour une location par ID
router.put('/:id', async (req, res) => {
  console.log('\n🔵 PUT /rents/:id - Début de la requête');
  console.log('ID:', req.params.id);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const transaction = await sequelize.transaction();

  try {
    const rentId = req.params.id;
    
    // 1. Récupérer l'ancienne location pour comparaison
    const oldRent = await Rent.findByPk(rentId);
    if (!oldRent) {
      throw new Error('Location non trouvée');
    }
    console.log('🔍 Ancienne location:', JSON.stringify(oldRent.toJSON(), null, 2));

    // 2. Utiliser une requête SQL brute pour la mise à jour de la location
    await sequelize.query(
      `UPDATE rents 
       SET date_entrance = :date_entrance,
           end_date = :end_date,
           rent_value = :rent_value,
           charges = :charges,
           id_tenant = :id_tenant,
           id_room = :id_room
       WHERE id = :rentId`,
      {
        replacements: {
          rentId: rentId,
          date_entrance: req.body.date_entrance,
          end_date: req.body.end_date,
          rent_value: req.body.rent_value,
          charges: req.body.charges,
          id_tenant: req.body.id_tenant,
          id_room: req.body.id_room
        },
        transaction
      }
    );

    // 3. Vérifier si le trigger a bien mis à jour les paiements
    const payments = await Payment.findAll({
      where: { rent_id: rentId },
      transaction
    });

    console.log('✅ Paiements après mise à jour:', JSON.stringify(payments.map(p => p.toJSON()), null, 2));

    await transaction.commit();

    // 4. Récupérer la location mise à jour avec ses paiements
    const updatedRent = await Rent.findByPk(rentId, {
      include: [{
        model: Payment,
        as: 'payments'
      }]
    });

    console.log('✅ Location mise à jour:', JSON.stringify(updatedRent.toJSON(), null, 2));
    res.json(updatedRent);

  } catch (error) {
    await transaction.rollback();
    console.error('🔴 Erreur globale:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour de la location',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer une location par ID
router.delete('/:id', async (req, res) => {
  try {
    const rent = await Rent.findByPk(req.params.id);
    if (!rent) {
      return res.status(404).json({ message: 'Location non trouvée' });
    }
    await Rent.destroy();
    res.json({ message: 'Location supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression location:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la location',
      error: error.message 
    });
  }
});

module.exports = router;