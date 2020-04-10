import crypto from 'crypto';

export function randomKey() {
    return crypto.randomBytes(16).toString('hex');
}