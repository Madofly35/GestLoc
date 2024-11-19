const { createClient } = require('@supabase/supabase-js');

class StorageService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    this.buckets = {
      receipts: 'tenant-receipts',
      contracts: 'tenant-contracts',
      documents: 'tenant-documents',
      tickets: 'maintenance-tickets'
    };
  }

  async uploadFile(file, bucketName, filePath) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer || file, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = await this.supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600); // URL valide 1h

    return {
      path: data.path,
      url: urlData.signedUrl
    };
  }

  async getFileUrl(bucketName, filePath) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  }

  async deleteFile(bucketName, filePath) {
    const { error } = await this.supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) throw error;
    return true;  
  }

  getReceiptPath(paymentId, date, tenantId) {
    const year = date.getFullYear();
    const month = date.toLocaleDateString('fr-FR', { month: 'long' });
    return `${year}/${month}/tenant_${tenantId}/quittance_${paymentId}.pdf`;
  }
}

module.exports = new StorageService();