import { transporter } from "../config/nodeMailer.js";

export const sendOtpMail = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Verification",
      html: `
        <div style="font-family:Arial; padding:10px;">
          <h2>Email Verification</h2>
          <p>Your OTP is:</p>
          <h3 style="color:blue;">${otp}</h3>
          <p>This OTP is valid for 1 minutes.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ OTP email sent to:", email);
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
  }
};
