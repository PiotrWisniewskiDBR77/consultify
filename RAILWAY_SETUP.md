# Railway Deployment Setup Guide

## Separate Dockerfiles for Each Service

Since Railway doesn't support multiple Dockerfile targets, this project uses separate Dockerfiles:
- **`Dockerfile.api`** - Backend service (Node.js)
- **`Dockerfile.frontend`** - Frontend service (Nginx)

## Railway Service Configuration

### For Backend Service:
1. Create a **new service** in Railway (or use existing backend service)
2. Go to **Settings** → **Builder**
3. Under **"Dockerfile Path"**, set it to: `Dockerfile.api`
4. Alternatively, copy `railway.api.json` to `railway.json` in the backend service root
5. The service will use: `CMD ["node", "dist/index.js"]`

### For Frontend Service:
1. Create a **new service** in Railway (or use existing frontend service)
2. Go to **Settings** → **Builder**  
3. Under **"Dockerfile Path"**, set it to: `Dockerfile.frontend`
4. Alternatively, copy `railway.frontend.json` to `railway.json` in the frontend service root
5. The service will use: `CMD ["nginx", "-g", "daemon off;"]`

## Important Notes

- Railway requires **separate services** for frontend and backend
- Each service uses its own Dockerfile (`Dockerfile.api` or `Dockerfile.frontend`)
- The original `Dockerfile` is kept for local development with docker-compose
- Make sure to set the correct Dockerfile path in Railway UI for each service

## Troubleshooting

**Error: "The executable `node` could not be found"**
- This means Railway is building the `frontend` stage (nginx) but trying to run a node command
- Solution: Set the Dockerfile target to `api` in Railway UI

**Error: "nginx: command not found"**  
- This means Railway is building the `api` stage but trying to run nginx
- Solution: Set the Dockerfile target to `frontend` in Railway UI
