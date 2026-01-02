# Getting Started with Consultify

This guide covers how to set up Consultify on your local machine for development.

## Prerequisites
- **Node.js**: v18 or higher (v20+ recommended)
- **npm**: v9 or higher
- **Git**

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd consultify
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Configuration

Consultify uses environment variables for configuration. 

1. **Create the local environment file:**
   Duplicate the `.env` or `.env.production.example` file to create `.env.local`.
   ```bash
   cp .env.production.example .env.local
   ```

2. **Set up valid keys:**
   Open `.env.local` and configure the following:

   | Variable | Description | Required? |
   |----------|-------------|-----------|
   | `GEMINI_API_KEY` | API key for Google Gemini (AI features) | **Yes** |
   | `JWT_SECRET` | Random string for session security | **Yes** |
   | `PORT` | Backend server port (default: 3005) | No |
   | `DATABASE_URL` | Postgres connection string (if not using SQLite) | No |
   
   > **Note:** By default, the app uses SQLite, so you don't need to set up a database server.

## Running the Application

### Development Mode
To run both the frontend (Vite) and backend (Node) concurrently:

```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3005

### Production Mode
To build and run the optimized version:

```bash
npm run build
npm start
```

## Troubleshooting
- **Port Conflicts**: If port 3005 or 5173 is in use, the app may fail to start. Update `PORT` in `.env.local` or kill the conflicting process.
- **Database Issues**: If using SQLite, ensure the `server/consultify.db` file is writable.
