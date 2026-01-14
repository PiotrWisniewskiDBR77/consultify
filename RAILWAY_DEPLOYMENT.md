# Railway Deployment Guide - Quick Start

## Prerequisites
- GitHub account
- Railway account (sign up at railway.app)
- Your API keys ready (GEMINI_API_KEY, etc.)

## Step-by-Step Deployment

### 1. Prepare Your Repository
Ensure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### 2. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select your `consultify` repository

### 3. Add PostgreSQL Database
1. In your Railway project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create the database
4. Note: `DATABASE_URL` is automatically set as an environment variable

### 4. Configure Environment Variables
Go to your service → "Variables" tab and add:

```bash
# Core Configuration
NODE_ENV=production
PORT=3005

# Security (IMPORTANT: Generate a strong secret!)
JWT_SECRET=<generate-strong-random-string>

# Frontend URL (update after deployment)
FRONTEND_URL=https://your-app-name.up.railway.app

# AI Service
GEMINI_API_KEY=<your-gemini-api-key>

# Stripe (if using billing features)
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
```

**Generate JWT_SECRET:**
```bash
# On your local machine
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Add Persistent Volume for Uploads
1. Go to your service → "Volumes" tab
2. Click "Add Volume"
3. Mount path: `/app/server/uploads`
4. Size: Start with 1GB (can increase later)

### 6. Deploy
Railway will automatically:
- Build your Docker image
- Deploy the container
- Start your application

Wait for deployment to complete (usually 2-5 minutes).

### 7. Get Your Application URL
1. Go to your service → "Settings"
2. Click "Generate Domain"
3. Copy your URL (e.g., `https://consultify-production.up.railway.app`)

### 8. Update FRONTEND_URL
1. Go back to "Variables"
2. Update `FRONTEND_URL` with your actual Railway URL
3. Redeploy (Railway will auto-redeploy on variable change)

### 9. Verify Deployment
Visit your Railway URL:
- Health check: `https://your-app.up.railway.app/api/health`
- Should return: `{"status":"ok","timestamp":"..."}`

### 10. (Optional) Custom Domain
1. Go to "Settings" → "Networking"
2. Click "Custom Domain"
3. Add your domain
4. Follow DNS instructions
5. Railway handles SSL automatically

## Post-Deployment Checklist

- [ ] Health check endpoint works (`/api/health`)
- [ ] Database connection successful (check logs)
- [ ] File uploads directory exists and is writable
- [ ] Environment variables are set correctly
- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] WebSocket connections work (if using real-time features)

## Monitoring

### View Logs
- Railway dashboard → Your service → "Deployments" → Click deployment → "View Logs"

### Metrics
- Railway provides basic metrics (CPU, Memory, Network)
- For advanced monitoring, consider:
  - Sentry (error tracking)
  - LogRocket (session replay)
  - UptimeRobot (uptime monitoring)

## Troubleshooting

### Build Fails
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check build logs in Railway dashboard

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running
- Review database logs

### Application Crashes
- Check application logs
- Verify all required environment variables are set
- Check health check endpoint

### File Upload Issues
- Verify volume is mounted correctly
- Check volume has enough space
- Verify write permissions

## Updating Your Application

Railway auto-deploys on git push to your main branch.

To manually trigger deployment:
1. Go to "Deployments"
2. Click "Redeploy"

## Scaling

### Vertical Scaling (More Resources)
1. Go to service → "Settings"
2. Adjust CPU/Memory allocation
3. Railway will redeploy automatically

### Horizontal Scaling (More Instances)
- Railway supports multiple instances
- Go to "Settings" → "Scaling"
- Increase instance count

## Cost Optimization

- **Free Tier**: $5 credit/month
- **Hobby Plan**: $5/month + usage
- **Pro Plan**: $20/month + usage

**Tips:**
- Use persistent volumes efficiently
- Monitor usage in Railway dashboard
- Set up usage alerts

## Database Backups

Railway automatically backs up PostgreSQL databases:
- Daily backups retained for 7 days
- Manual backups available in database service settings

## Environment-Specific Deployments

### Staging Environment
1. Create new Railway project
2. Deploy from same repo
3. Use different branch (e.g., `staging`)
4. Set `NODE_ENV=staging`

### Production Environment
- Use main/master branch
- Set `NODE_ENV=production`
- Use production API keys
- Enable all monitoring

## Security Best Practices

1. ✅ Never commit `.env` files
2. ✅ Use strong `JWT_SECRET`
3. ✅ Rotate API keys regularly
4. ✅ Enable rate limiting (already configured)
5. ✅ Use HTTPS only (Railway handles this)
6. ✅ Set proper CORS origins
7. ✅ Regular dependency updates

## Next Steps

1. Set up monitoring (Sentry, LogRocket)
2. Configure custom domain
3. Set up CI/CD (optional, Railway auto-deploys)
4. Configure database backups
5. Set up usage alerts
6. Consider CDN for static assets (Cloudflare)

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

---

**Need help?** Check Railway logs or reach out for assistance!




