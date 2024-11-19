const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

function generateCertificate() {
  const certDir = path.join(__dirname, '..', 'certificates');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
  }

  // Générer une paire de clés
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // Créer le certificat
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{
    name: 'commonName',
    value: 'Pierre PARDOUX'
  }, {
    name: 'countryName',
    value: 'FR'
  }, {
    shortName: 'ST',
    value: 'Rhone'
  }, {
    name: 'localityName',
    value: 'AIX EN PROVENCE'
  }, {
    name: 'organizationName',
    value: 'Pierre PARDOUX'
  }, {
    name: 'emailAddress',
    value: 'p.pardoux@gmail.com'
  }];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  // Exporter les fichiers
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey, 
    cert, 
    'BBnn,,1122',
    { generateLocalKeyId: true }
  );

  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Path = path.join(certDir, 'signature.p12');
  
  fs.writeFileSync(p12Path, Buffer.from(p12Der, 'binary'));
  console.log('✅ Certificate generated successfully');
}

generateCertificate();
