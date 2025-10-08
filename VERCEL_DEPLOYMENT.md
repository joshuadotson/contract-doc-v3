# Deploying WordFTW to Vercel

## 🚀 Quick Deployment Guide

### What CAN be deployed to Vercel:

- ✅ **Main API Server** (as serverless functions)
- ✅ **Web Client** (static files)
- ✅ **Shared UI Components** (static assets)

### What CANNOT be deployed to Vercel:

- ❌ **Word Add-in** (requires Office.js runtime)
- ❌ **Collaboration Backend** (needs persistent WebSocket connections)
- ❌ **File Storage** (ephemeral file system)

## 📋 Pre-Deployment Setup

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Environment Variables

Set these in your Vercel dashboard or via CLI:

```bash
# Required
NODE_ENV=production
DOCUMENT_ID=default

# Optional - LLM Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4o-mini

# Optional - Document Content (for AI features)
DOCUMENT_CONTENT=Your document content here...

# Optional - System Prompt
LLM_SYSTEM_PROMPT=Your custom system prompt...
```

## 🚀 Deployment Steps

### Option 1: Deploy from GitHub (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically detect the `vercel.json` configuration
4. Set environment variables in Vercel dashboard
5. Deploy!

### Option 2: Deploy via CLI

```bash
# From your project root
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: wordftw (or your preferred name)
# - Directory: ./
# - Override settings? No
```

### Option 3: Deploy with Environment Variables

```bash
vercel --env NODE_ENV=production --env DOCUMENT_ID=default
```

## 🔧 Post-Deployment Configuration

### 1. Set Environment Variables

In your Vercel dashboard:

- Go to your project → Settings → Environment Variables
- Add the variables listed above

### 2. Configure Custom Domain (Optional)

- Go to your project → Settings → Domains
- Add your custom domain
- Update DNS records as instructed

### 3. Test Your Deployment

```bash
# Test the health endpoint
curl https://your-app.vercel.app/api/v1/health

# Test the web interface
open https://your-app.vercel.app
```

## 🏗️ Architecture for Vercel

### What's Deployed:

```
┌─────────────────────────────────────┐
│           Vercel Deployment         │
├─────────────────────────────────────┤
│  • Main API Server (serverless)     │
│  • Web Client (static files)        │
│  • Shared UI Components             │
│  • Document processing              │
│  • AI chat features                 │
└─────────────────────────────────────┘
```

### What's NOT Deployed:

```
┌─────────────────────────────────────┐
│        External Services            │
├─────────────────────────────────────┤
│  • Word Add-in (Office.js)          │
│  • Collaboration Backend (WebSocket)│
│  • File Storage (S3/External)       │
└─────────────────────────────────────┘
```

## 🔄 Alternative Architecture

Since Vercel has limitations, consider this hybrid approach:

### Option A: Vercel + External Services

- **Vercel**: Main API + Web client
- **Railway/Render**: Collaboration backend
- **AWS S3**: File storage
- **Office 365**: Word add-in hosting

### Option B: Full Cloud Deployment

- **AWS**: EC2 + ECS + RDS
- **Azure**: App Service + Container Instances
- **Google Cloud**: Cloud Run + Cloud SQL

## 🚨 Limitations & Workarounds

### 1. File Storage

**Problem**: Vercel has ephemeral file system
**Solution**: Use external storage (AWS S3, Cloudinary, etc.)

### 2. WebSocket Connections

**Problem**: Serverless functions can't maintain persistent connections
**Solution**: Use external WebSocket service (Pusher, Ably, etc.)

### 3. Word Add-in

**Problem**: Requires Office.js runtime
**Solution**: Deploy separately to Office 365 or use Office Add-in hosting

### 4. Real-time Collaboration

**Problem**: No persistent connections
**Solution**: Use external collaboration service (Yjs + Hocuspocus on Railway)

## 🛠️ Development vs Production

### Development (Local)

```bash
# Start all services
./tools/scripts/servers.ps1 -Action start
```

### Production (Vercel)

```bash
# Deploy to Vercel
vercel --prod
```

## 📊 Monitoring & Debugging

### Vercel Dashboard

- View function logs
- Monitor performance
- Check deployment status

### Environment Variables

```bash
# Check current environment
vercel env ls

# Add new environment variable
vercel env add VARIABLE_NAME
```

## 🔧 Troubleshooting

### Common Issues:

1. **Function Timeout**

   - Increase `maxDuration` in `vercel.json`
   - Optimize function performance

2. **File Upload Issues**

   - Use external storage (S3, etc.)
   - Implement streaming uploads

3. **WebSocket Errors**

   - Use external WebSocket service
   - Implement polling fallback

4. **Memory Issues**
   - Optimize function memory usage
   - Use external caching (Redis)

## 🎯 Next Steps

1. **Deploy to Vercel** using the steps above
2. **Set up external services** for file storage and collaboration
3. **Configure custom domain** if needed
4. **Test all functionality** in production
5. **Set up monitoring** and logging

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Serverless Functions Guide](https://vercel.com/docs/functions)
- [Environment Variables](https://vercel.com/docs/environment-variables)
- [Custom Domains](https://vercel.com/docs/custom-domains)
