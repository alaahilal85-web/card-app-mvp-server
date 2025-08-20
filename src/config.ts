import dotenv from 'dotenv';
dotenv.config();

export const PORT = parseInt(process.env.PORT || '4000', 10);
export const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const OTP_BYPASS = process.env.OTP_BYPASS || '0000';
