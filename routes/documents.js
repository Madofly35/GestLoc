// backend/routes/documents.js

const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const { Receipt, Payment, Rent, Tenant } = require('../models/associations');
const multer = require('multer');

// Configuration de multer pour la gestion des fichiers
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

const ensureBucketExists = async () => {
  try {
    const { data: buckets } = await storageService.supabase.storage.listBuckets();
    const bucketExists = buckets.some(b => b.name === 'tenant-receipts');
    
    if (!bucketExists) {
      const { error } = await storageService.supabase.storage.createBucket('tenant-receipts', {
        public: true // Rend le bucket public
      });
      if (error) throw error;
    }
  } catch (error) {
    console.error('Bucket creation error:', error);
    throw error;
  }
};


// Route de téléchargement des quittances
router.get('/receipts/:id/download', async (req, res) => {
  try {
    const receipt = await Receipt.findOne({
      where: { id: req.params.id },
      include: [{
        model: Payment,
        as: 'payment',
        include: [{
          model: Rent,
          as: 'rent',
          include: [{
            model: Tenant,
            as: 'tenant'
          }]
        }]
      }]
    });

    if (!receipt) {
      return res.status(404).json({ message: 'Quittance non trouvée' });
    }

    // Vérification des permissions
    // Si l'utilisateur est locataire, vérifier que la quittance lui appartient
    if (req.user.role === 'tenant' && 
        receipt.payment.rent.tenant.id !== req.user.tenant_id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Générer une nouvelle URL signée (les anciennes expirent après 1h)
    const signedUrl = await storageService.getFileUrl(
      storageService.buckets.receipts,
      receipt.storage_path
    );

    // Mettre à jour la date de téléchargement
    await receipt.update({
      downloaded_at: new Date()
    });

    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Erreur téléchargement quittance:', error);
    res.status(500).json({ 
      message: 'Erreur lors du téléchargement',
      error: error.message 
    });
  }
});

// Route générique pour télécharger un document
router.get('/documents/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ['contracts', 'documents', 'tickets'];
  
  try {
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Type de document invalide' });
    }

    // Récupérer les métadonnées du document depuis la base de données
    // (à adapter selon votre modèle de données)
    const document = await Document.findOne({
      where: { id },
      include: [{
        model: Tenant,
        as: 'tenant'
      }]
    });

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    // Vérification des permissions
    if (req.user.role === 'tenant' && 
        document.tenant.id !== req.user.tenant_id) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Générer une URL signée
    const signedUrl = await storageService.getFileUrl(
      storageService.buckets[type],
      document.storage_path
    );

    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Erreur téléchargement document:', error);
    res.status(500).json({ 
      message: 'Erreur lors du téléchargement',
      error: error.message 
    });
  }
});

// Route pour l'upload de documents
router.post('/documents/:type', upload.single('file'), async (req, res) => {
  const { type } = req.params;
  const validTypes = ['contracts', 'documents', 'tickets'];

  try {
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Type de document invalide' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Upload vers Supabase
    const storagePath = `${req.user.tenant_id}/${Date.now()}_${req.file.originalname}`;
    const storageFile = await storageService.uploadFile(
      req.file,
      storageService.buckets[type],
      storagePath
    );

    // Sauvegarder les métadonnées dans la base de données
    const document = await Document.create({
      tenant_id: req.user.tenant_id,
      type,
      name: req.file.originalname,
      storage_path: storageFile.path,
      storage_url: storageFile.url,
      mime_type: req.file.mimetype,
      size: req.file.size
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Erreur upload document:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload',
      error: error.message 
    });
  }
});

// Route pour supprimer un document
router.delete('/documents/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ['contracts', 'documents', 'tickets'];

  try {
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Type de document invalide' });
    }

    const document = await Document.findOne({
      where: { id },
      include: [{
        model: Tenant,
        as: 'tenant'
      }]
    });

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    // Vérification des permissions (seul le propriétaire peut supprimer)
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Action non autorisée' });
    }

    // Supprimer de Supabase
    await storageService.deleteFile(
      storageService.buckets[type],
      document.storage_path
    );

    // Supprimer de la base de données
    await document.destroy();

    res.json({ message: 'Document supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression document:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: error.message 
    });
  }
});

module.exports = router;
