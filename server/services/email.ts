import nodemailer from 'nodemailer';
import crypto from 'crypto';

// SMTP Configuration from Environment Variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASSWORD || ''; // Fixed: Use SMTP_PASSWORD instead of SMTP_PASS
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;
const FROM_NAME = process.env.FROM_NAME || 'Campus For Wisdom';

// Create nodemailer transporter with SMTP configuration
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // Use SSL for port 465, otherwise TLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    // Allow self-signed certificates (useful for development)
    rejectUnauthorized: false,
  },
});

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Calculate OTP expiry time (10 minutes from now)
 */
export function getOTPExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10); // 10 minutes from now
  return expiry;
}

/**
 * Send OTP email for application verification
 */
export async function sendOTPEmail(email: string, otp: string, purpose: string = 'application_submission'): Promise<boolean> {
  try {
    // Email templates based on purpose
    const templates = {
      application_submission: {
        subject: '🔐 Copy Trading Application - Email Verification',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">Campus For Wisdom</h1>
              <p style="color: #666; margin: 5px 0;">Copy Trading Application</p>
            </div>
            
            <div style="background: #f8fafc; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #1e293b; margin-bottom: 20px;">Verify Your Email Address</h2>
              
              <p style="color: #475569; font-size: 16px; margin-bottom: 30px;">
                Please use this OTP to verify your email address and complete your copy trading application:
              </p>
              
              <div style="background: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #2563eb;">
                <span style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px;">${otp}</span>
              </div>
              
              <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">
                ⏱️ This OTP will expire in <strong>10 minutes</strong>
              </p>
              
              <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                If you didn't request this OTP, please ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2025 Campus For Wisdom - Professional Copy Trading Services
              </p>
            </div>
          </div>
        `,
      },
      password_reset: {
        subject: '🔐 Password Reset - Email Verification',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">Campus For Wisdom</h1>
              <p style="color: #666; margin: 5px 0;">Password Reset Request</p>
            </div>
            
            <div style="background: #f8fafc; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #1e293b; margin-bottom: 20px;">Reset Your Password</h2>
              
              <p style="color: #475569; font-size: 16px; margin-bottom: 30px;">
                Use this OTP to reset your password:
              </p>
              
              <div style="background: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #ef4444;">
                <span style="font-size: 32px; font-weight: bold; color: #ef4444; letter-spacing: 8px;">${otp}</span>
              </div>
              
              <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">
                ⏱️ This OTP will expire in <strong>10 minutes</strong>
              </p>
              
              <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                If you didn't request a password reset, please ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2025 Campus For Wisdom - Professional Copy Trading Services
              </p>
            </div>
          </div>
        `,
      },
    };

    const template = templates[purpose as keyof typeof templates] || templates.application_submission;

    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: template.subject,
      html: template.html,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`📧 OTP email sent to ${email}, Message ID: ${info.messageId}`);
    return true;
    
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

/**
 * Send application confirmation email after successful submission
 */
export async function sendApplicationConfirmationEmail(
  email: string, 
  applicationData: {
    name: string;
    applicationId: string;
    exchange: string;
    submittedAt: Date;
  }
): Promise<boolean> {
  try {
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: '✅ Copy Trading Application Submitted Successfully',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Campus For Wisdom</h1>
            <p style="color: #64748b; margin: 5px 0 0 0;">Copy Trading Platform</p>
          </div>

          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 10px; color: white; text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0; font-size: 24px;">🎉 Application Submitted!</h2>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your copy trading application has been received successfully</p>
          </div>

          <div style="background: #f8fafc; padding: 25px; border-radius: 10px; border-left: 4px solid #10b981;">
            <h3 style="color: #374151; margin: 0 0 20px 0;">Application Details:</h3>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #374151;">Application ID:</strong>
              <span style="color: #6b7280; background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace; margin-left: 10px;">${applicationData.applicationId}</span>
            </div>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #374151;">Applicant Name:</strong>
              <span style="color: #6b7280; margin-left: 10px;">${applicationData.name}</span>
            </div>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #374151;">Exchange:</strong>
              <span style="color: #6b7280; margin-left: 10px;">${applicationData.exchange.toUpperCase()}</span>
            </div>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #374151;">Submitted At:</strong>
              <span style="color: #6b7280; margin-left: 10px;">${applicationData.submittedAt.toLocaleString('en-IN', { 
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
          </div>

          <div style="background: #eff6ff; padding: 20px; border-radius: 10px; border: 1px solid #dbeafe; margin: 20px 0;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="color: #2563eb; font-size: 18px;">ℹ️</div>
              <div>
                <h4 style="color: #1e40af; margin: 0 0 8px 0;">What happens next?</h4>
                <ul style="color: #3730a3; margin: 0; padding-left: 18px; line-height: 1.6;">
                  <li>Our team will review your application within <strong>24-48 hours</strong></li>
                  <li>We'll verify your API credentials and trading setup</li>
                  <li>You'll receive an email with approval status and next steps</li>
                  <li>Once approved, you'll get access to our copy trading system</li>
                </ul>
              </div>
            </div>
          </div>

          <div style="background: #fefce8; padding: 20px; border-radius: 10px; border: 1px solid #fde047; margin: 20px 0;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="color: #ca8a04; font-size: 18px;">⚠️</div>
              <div>
                <h4 style="color: #92400e; margin: 0 0 8px 0;">Important Security Reminder</h4>
                <p style="color: #a16207; margin: 0; line-height: 1.6;">
                  Your API credentials are encrypted and stored securely. For maximum security, ensure your API keys have <strong>trading permissions enabled</strong> but <strong>withdrawal permissions disabled</strong>.
                </p>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://telegram.me/campusforwisdom" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; transition: all 0.3s ease;">
              💬 Join Our Community
            </a>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #64748b; font-size: 14px;">
            <p style="margin: 0;">Thank you for choosing Campus For Wisdom</p>
            <p style="margin: 5px 0 0 0;">If you have questions, contact us at support@campusforwisdom.com</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`📧 Application confirmation email sent to ${email}, Message ID: ${info.messageId}`);
    return true;
    
  } catch (error) {
    console.error('Confirmation email sending error:', error);
    return false;
  }
}

/**
 * Test SMTP configuration
 */
export async function testSMTPConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
    return false;
  }
}

/**
 * Check if required SMTP environment variables are configured
 */
export function checkSMTPConfig(): { configured: boolean; missing: string[] } {
  const required = ['SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(key => !process.env[key]);
  
  return {
    configured: missing.length === 0,
    missing,
  };
}