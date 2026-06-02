# DEPLOYMENT GUIDE — Quick Start

## Prerequisites
- Docker & Docker Compose installed
- PostgreSQL 16+ (or use managed service like Supabase)
- Redis 7+ instance available
- All environment variables prepared

---

## Quick Deployment (5 minutes)

### 1. Prepare Environment
```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env

# Required minimum (for local testing):
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.com
DATABASE_URL=postgresql://postgres:password@db:5432/saascloser
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=<generate with: openssl rand -base64 32>
GEMINI_API_KEY=<your-gemini-key>
STRIPE_SECRET_KEY=<your-stripe-key>
```

### 2. Start Services
```bash
# Start all services (app, db, redis)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app
```

### 3. Verify Deployment
```bash
# Health check
curl https://your-domain.com/api/health

# Check database connection
docker-compose exec db psql -U postgres -d saascloser -c "SELECT 1"

# Check Redis connection
docker-compose exec redis redis-cli ping
```

---

## Manual Deployment (AWS EC2)

### 1. Launch Instance
```bash
# Ubuntu 22.04 LTS on AWS EC2 (t3.xlarge recommended)
# Security groups: Allow 80, 443, 22

# SSH into server
ssh -i your-key.pem ubuntu@instance-ip
```

### 2. Install Dependencies
```bash
sudo apt update && sudo apt install -y \
  git nodejs npm postgresql-client redis-tools curl

# Install Docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker ubuntu
```

### 3. Clone & Deploy
```bash
cd /var/www
git clone https://github.com/your-org/whatsapp-sales-saas.git
cd whatsapp-sales-saas

# Prepare environment
cp .env.example .env
nano .env  # Edit with production values

# Start services
docker-compose up -d
```

### 4. Setup SSL (Let's Encrypt)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure in .env
HTTPS_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem
HTTPS_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 5. Setup Reverse Proxy (Nginx)
```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo tee /etc/nginx/sites-available/whatsapp-saas > /dev/null <<'EOF'
upstream app {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/whatsapp-saas \
            /etc/nginx/sites-enabled/whatsapp-saas

# Test & reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Database Setup

### First Time Setup
```bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed data (optional)
docker-compose exec app npm run seed

# Check database
docker-compose exec db psql -U postgres -d saascloser
```

### Backup Strategy
```bash
# Automated daily backup (add to crontab)
0 2 * * * docker-compose exec -T db pg_dump -U postgres saascloser \
  | gzip > /backups/db-backup-$(date +\%Y\%m\%d).sql.gz

# Upload to S3
aws s3 sync /backups s3://your-backup-bucket/database/
```

---

## Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app
```

### Performance Monitoring
```bash
# CPU/Memory usage
docker stats

# Database connections
docker-compose exec db psql -U postgres -d saascloser \
  -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Redis info
docker-compose exec redis redis-cli info
```

---

## Troubleshooting

### Database Connection Error
```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL

# Check container
docker-compose logs db
```

### Redis Connection Error
```bash
# Test Redis
redis-cli -u $REDIS_URL ping

# Check Redis logs
docker-compose logs redis
```

### WebSocket Connection Issues
```bash
# Check if using HTTPS
curl -I https://your-domain.com/api/health

# Enable debug logging
LOG_LEVEL=debug docker-compose up -d app
```

### Out of Memory
```bash
# Increase Docker memory
# Edit docker-compose.yml deploy.resources.limits.memory

# Or restart containers
docker-compose restart
```

---

## Health Checks

### Application
```bash
# Health endpoint
curl https://your-domain.com/api/health

# Should return:
# { "status": "ok", "timestamp": "2024-06-03T00:00:00Z" }
```

### Database
```bash
# Connection test
docker-compose exec app npx prisma db execute --stdin <<< "SELECT 1"
```

### Redis
```bash
# Connection test
redis-cli -u $REDIS_URL ping
```

---

## Scaling Recommendations

### For 100+ Concurrent Users
- [ ] Database: Upgrade to AWS RDS t3.large (2vCPU, 8GB RAM)
- [ ] Redis: Upgrade to AWS ElastiCache (cache.t3.medium)
- [ ] App: Increase instance to t3.2xlarge
- [ ] Add load balancer (AWS ALB)

### For 500+ Concurrent Users
- [ ] Implement read replicas for database
- [ ] Use Redis Cluster (3+ nodes)
- [ ] Split WhatsApp service to separate servers
- [ ] Add CDN for static assets (CloudFront)

### For 1000+ Concurrent Users
- [ ] Horizontal scaling with Kubernetes (EKS)
- [ ] Database sharding by tenant
- [ ] Microservices architecture
- [ ] Message queue (Kafka) for async processing

---

## Security Checklist

### Before Going Live
- [ ] JWT_SECRET: 32+ characters, cryptographically random
- [ ] ENCRYPTION_KEY: Generated and backed up
- [ ] All secrets in Secret Manager (not in .env)
- [ ] HTTPS with valid certificate
- [ ] Database backup tested
- [ ] Firewall configured (port 22, 80, 443 only)
- [ ] Regular security updates scheduled
- [ ] Monitoring and alerting enabled

### Ongoing
- [ ] Rotate JWT_SECRET every 90 days
- [ ] Rotate database password every 90 days
- [ ] Review logs weekly for suspicious activity
- [ ] Backup database daily
- [ ] Test disaster recovery monthly
- [ ] Security updates applied promptly

---

## Contact & Support

For deployment issues:
1. Check troubleshooting section above
2. Review application logs
3. Check Docker container status
4. Verify environment variables
5. Contact support if issue persists

---

**Last Updated:** June 3, 2026
**Version:** 1.0
**Status:** Production Ready

