import crypto from 'crypto';

// Use environment encryption key (required)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required. Please set it in Replit secrets.');
}
const ALGORITHM = 'aes-256-gcm'; // Use GCM for authenticated encryption

/**
 * Encrypt a string using AES-256-GCM (authenticated encryption)
 */
export function encrypt(text: string): string {
  try {
    // Generate a random salt for each encryption
    const salt = crypto.randomBytes(32);
    
    // Derive key using PBKDF2 with the random salt
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
    
    // Generate a random IV for each encryption
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag for integrity verification
    const authTag = cipher.getAuthTag();
    
    // Return salt:iv:authTag:encrypted (all in hex)
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  try {
    // Split salt, IV, authTag and encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format - expected 4 parts');
    }
    
    const [saltHex, ivHex, authTagHex, encrypted] = parts;
    
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Derive the same key using the stored salt
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // Only log if it's not a common authentication failure (legacy data)
    if (!(error instanceof Error && error.message.includes('unable to authenticate data'))) {
      console.error('Decryption error:', error);
    }
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string appears to be encrypted (contains salt:iv:authTag:encrypted pattern)
 */
export function isEncrypted(data: string): boolean {
  // New format: salt:iv:authTag:encrypted (4 parts)
  const parts = data.split(':');
  if (parts.length === 4) {
    return parts.every(part => /^[a-f0-9]+$/i.test(part));
  }
  
  // Legacy format support: iv:encrypted (2 parts) - for existing data
  if (parts.length === 2) {
    return parts.every(part => /^[a-f0-9]+$/i.test(part));
  }
  
  return false;
}

/**
 * Legacy decryption function for old 2-part format
 */
function decryptLegacy(encryptedData: string): string {
  const crypto = require('crypto');
  
  try {
    // Use same key derivation as before
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'campus-for-wisdom-copy-trading-key-32', 'salt', 32);
    
    // Split IV and encrypted data (old format)
    const [ivHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid legacy encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Legacy decryption error:', error);
    throw new Error('Failed to decrypt legacy data');
  }
}

/**
 * Safely decrypt data - returns original if not encrypted, handles both new and legacy formats
 */
export function safeDecrypt(data: string): string {
  if (!data || !isEncrypted(data)) {
    return data; // Return as-is if not encrypted
  }
  
  try {
    const parts = data.split(':');
    
    // Try new format first (4 parts: salt:iv:authTag:encrypted)
    if (parts.length === 4) {
      return decrypt(data);
    }
    
    // Try legacy format (2 parts: iv:encrypted)
    if (parts.length === 2) {
      console.log('🔄 Decrypting legacy format data');
      return decryptLegacy(data);
    }
    
    // Unknown format
    throw new Error(`Unknown encrypted data format: ${parts.length} parts`);
    
  } catch (error) {
    // Only log warnings for unexpected errors, not common legacy data issues
    if (!(error instanceof Error && (error.message.includes('Failed to decrypt data') || 
                                     error.message.includes('unable to authenticate data')))) {
      console.warn('Failed to decrypt data, returning original:', error);
    }
    return data; // Fallback to original if decryption fails
  }
}