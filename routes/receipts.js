const express = require('express');
const router = express.Router();
const { Receipt, Payment, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');
const storageService = require('../services/storageService');

// GET /api/tenants/:tenantId/receipts
router.get('/tenants/:tenantId/receipts', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log('🟦 Fetching receipts for tenant:', tenantId);
    
    const rents = await Rent.findAll({
      where: { id_tenant: tenantId },
      include: [
        {
          model: Room,
          as: 'room',
          include: [{
            model: Property,
            as: 'property'
          }]
        }
      ],
      order: [['date_entrance', 'DESC']]
    });

    if (!rents || rents.length === 0) {
      console.log('❌ No rents found for tenant:', tenantId);
      return res.status(404).json({ message: 'Aucune location trouvée pour ce locataire' });
    }

    console.log('✅ Found rents:', rents.map(rent => ({
      id: rent.id,
      entrance: rent.date_entrance,
      end: rent.end_date
    })));

    const rentIds = rents.map(rent => rent.id);
    const payments = await Payment.findAll({
      where: {
        rent_id: rentIds,
        status: 'paid'
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
          where: { id_tenant: tenantId },
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
        }
      ],
      order: [['payment_date', 'DESC']]
    });

    const formattedPayments = await Promise.all(payments.map(async payment => {
      if (!payment.rent?.tenant || !payment.rent?.room?.property) {
        console.warn('⚠️ Missing data for payment:', payment.id);
        return null;
      }

      const rent = payment.rent;
      const paymentDate = new Date(payment.payment_date);
      const fileData = {
        id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        month: paymentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        receipt_generated: !!payment.paymentReceipt,
        tenant_name: `${rent.tenant.first_name} ${rent.tenant.last_name}`,
        property_name: rent.room.property.name,
        property_address: rent.room.property.address,
        room_number: rent.room.room_nb,
        rent_period: {
          start: rent.date_entrance,
          end: rent.end_date || 'En cours'
        }
      };

      if (payment.paymentReceipt) {
        try {
          const filePath = payment.paymentReceipt.storage_path;
          if (filePath) {
            const { data: { publicUrl } } = await storageService.supabase
              .storage
              .from(storageService.buckets.receipts)
              .getPublicUrl(filePath);
            fileData.receipt_url = publicUrl;
          }
        } catch (error) {
          console.warn('⚠️ Error getting receipt URL:', error);
        }
      }

      return fileData;
    }));

    const validPayments = formattedPayments.filter(Boolean);
    console.log('✅ Formatted payments:', validPayments);
    res.json(validPayments);

  } catch (error) {
    console.error('❌ Error fetching receipts:', error);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});

// GET /api/receipts/:paymentId/download
router.get('/receipts/:paymentId/download', async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log('🟦 Downloading receipt for payment:', paymentId);
    
    const payment = await Payment.findOne({
      where: { id: paymentId },
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
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ message: "Paiement non trouvé" });
    }

    if (!payment.rent?.tenant || !payment.rent?.room?.property) {
      return res.status(400).json({ message: "Données incomplètes pour générer la quittance" });
    }

    try {
      let receipt = payment.paymentReceipt;
      let pdfBuffer;

      // Génération ou récupération de la quittance
      if (!receipt) {
        console.log('🟦 No receipt found, generating new one...');
        const result = await generateReceipt(payment, payment.rent);
        
        receipt = await Receipt.create({
          payment_id: payment.id,
          storage_path: result.path,
          generated_at: new Date()
        });

        // Récupérer le buffer du fichier nouvellement créé
        const { data, error } = await storageService.supabase
          .storage
          .from(storageService.buckets.receipts)
          .download(result.path);

        if (error) throw error;
        pdfBuffer = Buffer.from(await data.arrayBuffer());

      } else {
        // Récupérer le fichier existant
        const { data, error } = await storageService.supabase
          .storage
          .from(storageService.buckets.receipts)
          .download(receipt.storage_path);

        if (error) {
          console.log('🟦 Error getting existing receipt, regenerating...');
          const result = await generateReceipt(payment, payment.rent);
          await receipt.update({ 
            storage_path: result.path
          });

          const { data: newData, error: newError } = await storageService.supabase
            .storage
            .from(storageService.buckets.receipts)
            .download(result.path);

          if (newError) throw newError;
          pdfBuffer = Buffer.from(await newData.arrayBuffer());
        } else {
          pdfBuffer = Buffer.from(await data.arrayBuffer());
        }
      }

      // Mettre à jour la date de téléchargement
      await receipt.update({ downloaded_at: new Date() });

      // Envoyer le fichier
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="quittance_${
          payment.rent.tenant.last_name.toLowerCase()
        }_${new Date(payment.payment_date).toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric'
        }).replace(' ', '_')}.pdf"`
      );
      res.send(pdfBuffer);

    } catch (genError) {
      console.error('🔴 Error generating/sending receipt:', genError);
      res.status(500).json({ 
        message: 'Erreur lors de la génération/envoi de la quittance',
        error: genError.message 
      });
    }

  } catch (error) {
    console.error('🔴 Error in download route:', error);
    res.status(500).json({ 
      message: 'Erreur lors du téléchargement de la quittance',
      error: error.message 
    });
  }
});

module.exports = router;