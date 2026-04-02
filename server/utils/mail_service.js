const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER, // 你的信箱帳號
        pass: process.env.SMTP_PASS  // 你的 APP 密碼
    }
});

/**
 * 送出 6 位數驗證郵件
 * @param {string} toEmail 
 * @param {string} code 6位數代碼
 * @param {string} userName 使用者名稱
 */
async function sendVerificationEmail(toEmail, code, userName) {
    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Stock Screener'}" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: '【Stock Screener】您的帳號註冊驗證碼',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                <h2 style="color: #4A90E2; border-bottom: 2px solid #EEE; padding-bottom: 10px;">帳號驗證中心</h2>
                <p>親愛的 <strong>${userName}</strong> 您好，</p>
                <p>感謝您註冊我們的股票篩選器系統！請在註冊頁面輸入以下 6 位數驗證碼：</p>
                
                <div style="background: #F8F9FA; padding: 25px; text-align: center; border-radius: 12px; margin: 20px 0; border: 1px solid #E1E4E8;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #D0021B;">${code}</span>
                </div>
                
                <p style="color: #666; font-size: 14px;">此驗證碼有效期限為 <strong>10 分鐘</strong>。如果您並未進行此操作，請忽略此郵件。</p>
                <hr style="border: 0; border-top: 1px solid #EEE; margin: 30px 0;">
                <p style="font-size: 12px; color: #999; text-align: center;">此為系統自動發送郵件，請勿直接回覆。</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mail] Verification email sent to ${toEmail}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('[Mail] Failed to send email:', err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendVerificationEmail
};
