const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

// Configuration du bailleur
const OWNER_INFO = {
  name: 'PARDOUX Pierre',
  company: '',
  address: '30 avenue Esprit Brondino',
  postalCode: '13290',
  city: 'AIX EN PROVENCE'
};

function ensureDirectoryExistsSync(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function addDigitalSignature(pdfBuffer) {
  try {
    // Charger le certificat P12
    const p12Path = path.join(__dirname, '..', 'certificates', 'signature.p12');
    if (!fs.existsSync(p12Path)) {
      console.warn('⚠️ Certificate not found, skipping signature');
      return pdfBuffer;
    }

    const p12Der = fs.readFileSync(p12Path, 'binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, 'BBnn,,1122');

    // Créer la signature
    const md = forge.md.sha256.create();
    md.update(pdfBuffer.toString('binary'));

    // Obtenir la clé privée
    const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    const privateKey = keyBag.key;

    // Signer
    const signature = privateKey.sign(md);

    // Ajouter les métadonnées de signature
    const signedPdfBuffer = Buffer.concat([
      pdfBuffer,
      Buffer.from('\n%Signed by: ' + OWNER_INFO.name + '\n'),
      Buffer.from('%Signature date: ' + new Date().toISOString() + '\n'),
      Buffer.from(signature)
    ]);

    return signedPdfBuffer;
  } catch (error) {
    console.error('⚠️ Signature error:', error);
    return pdfBuffer;
  }
}

async function generateReceipt(payment, rent) {
  return new Promise((resolve, reject) => {
    try {
      if (!payment || !rent || !rent.tenant || !rent.room || !rent.room.property) {
        throw new Error('Données manquantes pour la génération de la quittance');
      }

      const totalAmount = parseFloat(rent.rent_value) || 0;
      const chargesAmount = parseFloat(rent.charges) || 0;
      const rentAmount = totalAmount - chargesAmount;

      const storageDir = path.resolve(__dirname, '..', 'storage');
      const receiptsDir = path.join(storageDir, 'receipts');
      const date = new Date(payment.payment_date);
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const year = date.getFullYear();
      const yearDir = path.join(receiptsDir, year.toString());
      const monthDir = path.join(yearDir, month);

      [storageDir, receiptsDir, yearDir, monthDir].forEach(ensureDirectoryExistsSync);

      const filename = `quittance_${payment.id}.pdf`;
      const absoluteFilePath = path.join(monthDir, filename);
      const relativeFilePath = path.join('storage', 'receipts', year.toString(), month, filename)
        .split(path.sep)
        .join('/');

      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        const signedPdfBuffer = addDigitalSignature(pdfBuffer);
        fs.writeFileSync(absoluteFilePath, signedPdfBuffer);
        resolve(relativeFilePath);
      });

      // PDF Content
      doc.fontSize(20)
         .text('QUITTANCE DE LOYER', { align: 'center' })
         .moveDown();

      doc.fontSize(14)
         .text(`${month} ${year}`, { align: 'center' })
         .moveDown()
         .moveDown();

      doc.fontSize(12)
         .text(OWNER_INFO.name, { underline: true })
         .moveDown()
         .text(OWNER_INFO.company)
         .text(OWNER_INFO.address)
         .text(`${OWNER_INFO.postalCode} ${OWNER_INFO.city}`)
         .moveDown()
         .moveDown();

      doc.text('LOCATAIRE :', { underline: true })
         .moveDown()
         .text(`${rent.tenant.first_name} ${rent.tenant.last_name}`)
         .text(`${rent.room.property.name} - Chambre ${rent.room.room_nb}`)
         .text(`${rent.room.property.address}`)
         .text(`${rent.room.property.postalcode} ${rent.room.property.city}`)
         .moveDown()
         .moveDown();

      doc.text('DÉTAILS DU PAIEMENT', { underline: true })
         .moveDown()
         .text(`Loyer : ${rentAmount.toFixed(2)} €`)
         .text(`Charges : ${chargesAmount.toFixed(2)} €`)
         .text(`Total : ${totalAmount.toFixed(2)} €`)
         .moveDown()
         .moveDown();

      doc.text(
        `Je soussigné ${OWNER_INFO.name}, bailleur, donne quittance à ${rent.tenant.first_name} ${rent.tenant.last_name} ` +
        `pour la somme de ${totalAmount.toFixed(2)} euros, ` +
        `au titre du loyer et des charges du logement désigné ci-dessus ` +
        `pour la période du 1er au dernier jour du mois de ${month} ${year}.`
      )
      .moveDown()
      .moveDown();

      const currentDate = new Date().toLocaleDateString('fr-FR');
      doc.text(`Fait à ${OWNER_INFO.city}, le ${currentDate}`)
         .moveDown()
         .moveDown()
         .text('Signature du bailleur :')
         .moveDown()
         .moveDown();

      doc.fontSize(8)
         .text(
           'Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du montant ci-dessus.',
           { align: 'center' }
         );

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateReceipt,
  ensureDirectoryExistsSync
};