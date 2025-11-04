const nodemailer = require('nodemailer');

const configs = [
  { name: 'Port 587 + STARTTLS', host: 'smtp.zoho.com', port: 587, secure: false },
  { name: 'Port 465 + SSL', host: 'smtp.zoho.com', port: 465, secure: true },
  { name: 'Port 587 + requireTLS', host: 'smtp.zoho.com', port: 587, secure: false, requireTLS: true },
];

async function testAll() {
  console.log('🧪 Testing Zoho SMTP with multiple configurations...\n');
  
  for (const config of configs) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: ${config.name}`);
    console.log(`${'='.repeat(50)}`);
    
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTLS: config.requireTLS || false,
        auth: {
          user: 'train@hyphendxb.ae',
          pass: 'Dubai@2025#'
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      await transporter.verify();
      console.log('✅ Connection verified!');
      
      // Try sending
      const info = await transporter.sendMail({
        from: '"Hyphen" <train@hyphendxb.ae>',
        to: 'rahulsarswat57@gmail.com',
        subject: `Test - ${config.name}`,
        html: `<p>This is a test from ${config.name}</p>`
      });
      
      console.log('✅✅✅ EMAIL SENT!');
      console.log('Message ID:', info.messageId);
      break; // Success, stop testing other configs
      
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
  }
}

testAll();
