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
  let transaction = null;
  
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

    // Commencer une transaction simple
    transaction = await sequelize.transaction();

    // Vérification de l'existence du locataire et de la chambre
    const tenant = await Tenant.findByPk(rentData.id_tenant, { transaction });
    const room = await Room.findByPk(rentData.id_room, { transaction });

    if (!tenant || !room) {
      throw new Error(!tenant ? 'Locataire non trouvé' : 'Chambre non trouvée');
    }

    // Vérification des chevauchements
    const overlapping = await Rent.findOne({
      where: {
        id_room: rentData.id_room,
        [Op.and]: {
          date_entrance: { [Op.lte]: rentData.end_date || '9999-12-31' },
          [Op.or]: [
            { end_date: null },
            { end_date: { [Op.gte]: rentData.date_entrance } }
          ]
        }
      },
      transaction
    });

    if (overlapping) {
      throw new Error('Cette période chevauche une location existante');
    }

    // Création de la location
    const rent = await Rent.create(rentData, { transaction });

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
    console.error('Erreur lors de la création:', error);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    // Envoyer une réponse d'erreur appropriée
    if (error.message.includes('chevauche') || 
        error.message.includes('trouvé')) {
      return res.status(400).json({
        message: error.message
      });
    }

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