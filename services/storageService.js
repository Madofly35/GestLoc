// backend/services/storageService.js

const { supabase } = require('../config');

class StorageService {
  constructor() {
    // Noms des buckets
    this.buckets = {
      receipts: 'receipts',
      contracts: 'contracts',
      documents: 'documents',
      tickets: 'maintenance-tickets'
    };
  }

  async initializeBuckets() {
    for (const bucketName of Object.values(this.buckets)) {
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: false, // Bucket privé
        fileSizeLimit: 52428800 // 50MB max
      });
      
      if (error && !error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  async uploadFile(file, bucketName, path = '') {
    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = path ? `${path}/${fileName}` : fileName;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // Créer URL signée valide 1 heure
    const { data: { signedUrl } } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);

    return {
      path: data.path,
      url: signedUrl
    };
  }

  async deleteFile(bucketName, filePath) {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) throw error;
    return true;
  }

  async getFileUrl(bucketName, filePath) {
    const { data: { signedUrl }, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);

    if (error) throw error;
    return signedUrl;
  }

  // Gestion des dossiers pour les quittances
  getReceiptPath(date, tenantId) {
    const year = date.getFullYear();
    const month = date.toLocaleString('fr-FR', { month: 'long' });
    return `${year}/${month}/tenant_${tenantId}`;
  }
}

module.exports = new StorageService();
