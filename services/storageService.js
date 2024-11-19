const { createClient } = require('@supabase/supabase-js');

class StorageService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // Alignement avec la structure Supabase
    this.buckets = {
      documents: 'tenant-documents',
      contracts: 'tenant-contracts',
      receipts: 'tenant-receipts',
      pictures: 'proprieties-pictures'
    };
  }

  getReceiptPath(payment, tenant) {
    const date = new Date(payment.payment_date);
    const year = date.getFullYear();
    const month = date.toLocaleDateString('fr-FR', { month: 'long' });
    
    // Format: tenant-receipts/tenant_[ID]/[YEAR]/[MONTH]/receipt_[PAYMENT_ID].pdf
    return `tenant_${tenant.id}/${year}/${month}/receipt_${payment.id}.pdf`;
  }

  async uploadFile(file, bucketName, filePath) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer || file, {
        contentType: file.mimetype || 'application/pdf',
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = await this.supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600); // URL valide 1h

    return {
      path: filePath,
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
}

module.exports = new StorageService();