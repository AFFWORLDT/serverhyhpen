#!/bin/bash

echo "🚀 EC2 Deployment Script for HypGym Backend"
echo "============================================="

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install Node.js
echo "📦 Installing Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Git
echo "📦 Installing Git..."
sudo yum install -y git

# Install Nginx
echo "📦 Installing Nginx..."
sudo yum install -y nginx

# Clone repository
echo "📦 Cloning repository..."
git clone https://github.com/AFFWORLDT/serverhyhpen.git
cd serverhyhpen

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file
echo "📦 Creating environment file..."
cat > .env << EOF
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority
JWT_SECRET=4c05ff8b3007b64382ccc741bc66f1bb3108210bfe7ad6bc9a78c1d7addf384345037d20e343b20cef5c5ea91f0366518dc36c26a58e94ece54b462bd346dbfd
EOF

# Start application with PM2
echo "🚀 Starting application..."
pm2 start index.js --name "hypgym-backend"
pm2 save
pm2 startup

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/conf.d/hypgym-backend.conf > /dev/null << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Test configuration
sudo nginx -t
sudo systemctl restart nginx

echo "✅ Deployment complete!"
echo "🌐 Your backend should be accessible at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5001"
echo "🔧 PM2 Status:"
pm2 status
echo "📊 Test your API:"
echo "curl http://localhost:5001/api/health"
