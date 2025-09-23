import { eq, and, gt, lt } from 'drizzle-orm';
import { db } from '../db';
import { otpVerifications } from '@shared/schema';
import { generateOTP, getOTPExpiry, sendOTPEmail } from './email';
import type { InsertOtpVerification, VerifyOtp, SendOtp } from '@shared/schema';

/**
 * Generate and send OTP to email
 */
export async function generateAndSendOTP({ email, purpose = 'application_submission' }: SendOtp): Promise<{ success: boolean; message: string; otpId?: string }> {
  try {
    // Check if there's already a recent OTP for this email (rate limiting)
    const recentOTP = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.purpose, purpose),
          gt(otpVerifications.createdAt, new Date(Date.now() - 2 * 60 * 1000)) // Within last 2 minutes
        )
      )
      .limit(1);

    if (recentOTP.length > 0) {
      return {
        success: false,
        message: 'Please wait 2 minutes before requesting another OTP',
      };
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry();

    // Clean up any existing OTPs for this email and purpose
    await db
      .delete(otpVerifications)
      .where(
        and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.purpose, purpose)
        )
      );

    // Insert new OTP
    const [otpRecord] = await db
      .insert(otpVerifications)
      .values({
        email,
        otp,
        purpose,
        expiresAt,
        attempts: 0,
        maxAttempts: 3,
        isVerified: false,
      })
      .returning();

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, purpose);

    if (!emailSent) {
      // Delete the OTP record if email sending failed
      await db
        .delete(otpVerifications)
        .where(eq(otpVerifications.id, otpRecord.id));

      return {
        success: false,
        message: 'Failed to send OTP email. Please check your email address and try again.',
      };
    }

    console.log(`🔐 OTP generated for ${email} (Purpose: ${purpose})`);

    return {
      success: true,
      message: 'OTP sent successfully to your email address',
      otpId: otpRecord.id,
    };

  } catch (error) {
    console.error('OTP generation error:', error);
    return {
      success: false,
      message: 'Failed to generate OTP. Please try again.',
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP({ email, otp, purpose = 'application_submission' }: VerifyOtp): Promise<{ success: boolean; message: string; verified?: boolean }> {
  try {
    // Find the OTP record
    const [otpRecord] = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.purpose, purpose),
          eq(otpVerifications.isVerified, false)
        )
      )
      .orderBy(otpVerifications.createdAt)
      .limit(1);

    if (!otpRecord) {
      return {
        success: false,
        message: 'No OTP found for this email. Please request a new OTP.',
      };
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      // Delete expired OTP
      await db
        .delete(otpVerifications)
        .where(eq(otpVerifications.id, otpRecord.id));

      return {
        success: false,
        message: 'OTP has expired. Please request a new one.',
      };
    }

    // Check if maximum attempts exceeded
    if ((otpRecord.attempts || 0) >= (otpRecord.maxAttempts || 3)) {
      // Delete OTP after max attempts
      await db
        .delete(otpVerifications)
        .where(eq(otpVerifications.id, otpRecord.id));

      return {
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      };
    }

    // Increment attempt count
    await db
      .update(otpVerifications)
      .set({
        attempts: (otpRecord.attempts || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(otpVerifications.id, otpRecord.id));

    // Verify OTP
    if (otpRecord.otp !== otp) {
      const remainingAttempts = (otpRecord.maxAttempts || 3) - ((otpRecord.attempts || 0) + 1);
      
      return {
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
      };
    }

    // OTP is correct - mark as verified
    await db
      .update(otpVerifications)
      .set({
        isVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(otpVerifications.id, otpRecord.id));

    console.log(`✅ OTP verified successfully for ${email} (Purpose: ${purpose})`);

    return {
      success: true,
      message: 'OTP verified successfully!',
      verified: true,
    };

  } catch (error) {
    console.error('OTP verification error:', error);
    return {
      success: false,
      message: 'Failed to verify OTP. Please try again.',
    };
  }
}

/**
 * Check if email has a verified OTP for a specific purpose
 */
export async function isEmailVerified(email: string, purpose: string = 'application_submission'): Promise<boolean> {
  try {
    const [verifiedOTP] = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.purpose, purpose),
          eq(otpVerifications.isVerified, true),
          gt(otpVerifications.expiresAt, new Date()) // Still within expiry
        )
      )
      .limit(1);

    return !!verifiedOTP;
  } catch (error) {
    console.error('Email verification check error:', error);
    return false;
  }
}

/**
 * Clean up expired OTPs (run periodically)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  try {
    const result = await db
      .delete(otpVerifications)
      .where(lt(otpVerifications.expiresAt, new Date()));

    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} expired OTP records`);
    }

    return deletedCount;
  } catch (error) {
    console.error('OTP cleanup error:', error);
    return 0;
  }
}

/**
 * Get OTP statistics for monitoring
 */
export async function getOTPStats(): Promise<{
  total: number;
  active: number;
  expired: number;
  verified: number;
}> {
  try {
    const now = new Date();
    
    const [stats] = await db
      .select({
        total: db.$count(otpVerifications),
        active: db.$count(otpVerifications, and(
          eq(otpVerifications.isVerified, false),
          gt(otpVerifications.expiresAt, now)
        )),
        expired: db.$count(otpVerifications, lt(otpVerifications.expiresAt, now)),
        verified: db.$count(otpVerifications, eq(otpVerifications.isVerified, true)),
      })
      .from(otpVerifications);

    return stats || { total: 0, active: 0, expired: 0, verified: 0 };
  } catch (error) {
    console.error('OTP stats error:', error);
    return { total: 0, active: 0, expired: 0, verified: 0 };
  }
}