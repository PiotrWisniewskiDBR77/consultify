# Deployment Guide

## Production Build

To prepare the application for production:

1.  **Framework Production Build**:
    ```bash
    npm run build
    ```
    This compiles the React application into the `dist/` directory using Vite.

2.  **Server Startup**:
    Ensure `NODE_ENV` is set to `production`.
    ```bash
    npm start
    ```

## Docker

We provide a `Dockerfile` for containerized deployment.

### Building the Image
```bash
docker build -t consultify:latest .
```

### Running the Container
```bash
docker run -d \
  -p 3000:3000 \
  -e GEMINI_API_KEY=your_key \
  -e JWT_SECRET=your_secret \
  consultify:latest
```

> **Note**: If using a local database with Docker, ensure you mount a volume to persist `server/consultify.db`.

## Environment Variables
Ensure all required environment variables are set in your production environment (e.g., AWS, Heroku, Vercel). See `docs/01-getting-started.md` for the list.
