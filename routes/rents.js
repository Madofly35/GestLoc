const express = require('express');
const router = express.Router();
const {Rent} = require('../models/Rent');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const { Op } = require('sequelize');
const sequelize = require('../config');

// Créer une nouvelle location
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Vérifier si la chambre n'est pas déjà louée sur cette période
    const overlappingRent = await Rent.findOne({
      where: {
        id_room: req.body.id_room,
        [Op.or]: [
          {
            [Op.and]: {
              date_entrance: { [Op.lte]: req.body.date_entrance },
              [Op.or]: [
                { end_date: { [Op.gte]: req.body.date_entrance } },
                { end_date: null }
              ]
            }
          },
          {
            [Op.and]: {
              date_entrance: { [Op.lte]: req.body.end_date || '9999-12-31' },
              [Op.or]: [
                { end_date: { [Op.gte]: req.body.end_date || '9999-12-31' } },
                { end_date: null }
              ]
            }
          }
        ]
      },
      transaction
    });

    if (overlappingRent) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Cette chambre est déjà louée pendant cette période' 
      });
    }

    // Formater les données avant création
    const rentData = {
      id_tenant: parseInt(req.body.id_tenant),
      id_room: parseInt(req.body.id_room),
      date_entrance: req.body.date_entrance,
      rent_value: parseFloat(req.body.rent_value),
      charges: parseFloat(req.body.charges || 0),
      ...(req.body.end_date && { end_date: req.body.end_date })
    };

    const rent = await Rent.create(rentData, { transaction });
    await transaction.commit();
    
    // Récupérer la location créée avec ses relations
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
    await transaction.rollback();
    console.error('Erreur création location:', error);
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