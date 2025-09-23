import crypto from 'crypto';

// Use a secret key from environment or a default for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'campus-for-wisdom-copy-trading-key-32'; // 32 characters
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a string using AES-256-CBC
 */
export function encrypt(text: string): string {
  try {
    // Ensure the key is exactly 32 bytes
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16); // Initialization vector
    
    const cipher = crypto.createCipher(ALGORITHM, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (both in hex)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string using AES-256-CBC
 */
export function decrypt(encryptedData: string): string {
  try {
    // Ensure the key is exactly 32 bytes
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    // Split IV and encrypted data
    const [ivHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(ALGORITHM, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string appears to be encrypted (contains hex:hex pattern)
 */
export function isEncrypted(data: string): boolean {
  return data.includes(':') && /^[a-f0-9]+:[a-f0-9]+$/i.test(data);
}

/**
 * Safely decrypt data - returns original if not encrypted
 */
export function safeDecrypt(data: string): string {
  if (!data || !isEncrypted(data)) {
    return data; // Return as-is if not encrypted
  }
  
  try {
    return decrypt(data);
  } catch (error) {
    console.warn('Failed to decrypt data, returning original:', error);
    return data; // Fallback to original if decryption fails
  }
}