const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY       = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY, 'hex'); // 32 bytes

/**
 * Chiffre un texte — retourne "iv:contenuChiffré" en hex
 */
function encrypt(text) {
  if (!text) return text;
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Déchiffre une chaîne "iv:contenuChiffré" — retourne le texte original
 */
function decrypt(data) {
  if (!data || !data.includes(':')) return data; // déjà en clair (migration)
  const [ivHex, encryptedHex] = data.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
