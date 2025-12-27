# Getting Started with Consultify

This guide will help you get Consultify up and running in your local development environment.

## Prerequisites

### Required Software

- **Node.js** >= 18.x (20.x recommended)
- **npm** >= 9.x
- **Git**

### Optional (for full functionality)

- **PostgreSQL** >= 15 (if not using SQLite)
- **Redis** >= 7 (for rate limiting and caching)
- **Docker** and **Docker Compose** (for easy dependency management)

## Quick Start

### Option 1: Using Startup Script (Recommended)

```bash
chmod +x start.sh
./start.sh
```

This script automatically:
- Checks prerequisites
- Creates `.env.local` with default configuration
- Installs all dependencies
- Starts both frontend and backend servers

### Option 2: Manual Setup

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd consultify
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env.local` file in the project root. See [Environment Configuration](#environment-configuration) below for details.

4. **Start the application**:
   ```bash
   npm run dev
   ```

   This starts both frontend (port 3000) and backend (port 3005) concurrently.

## Environment Configuration

Create a `.env.local` file with the following minimum configuration:

```bash
# Server Configuration
NODE_ENV=development
PORT=3005
FRONTEND_URL=http://localhost:3000

# Database Configuration
DB_TYPE=sqlite
SQLITE_PATH=./server/consultify.db

# JWT & Security
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# LLM Provider - REQUIRED (at least one)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Getting LLM API Keys

- **Google Gemini**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Anthropic Claude**: Get your API key from [Anthropic Console](https://console.anthropic.com/)

> **Note**: For detailed environment setup instructions, see [LOCAL_SETUP.md](../LOCAL_SETUP.md)

## Running the Application

After starting the application, you can access:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3005
- **Health Check**: http://localhost:3005/api/health

## First Steps After Installation

1. **Create a user account** through the web interface
2. **Verify LLM configuration** – Ensure your API key is working
3. **Explore the demo** – Try the demo session to understand the platform
4. **Review documentation** – Check out [Features](03-features.md) and [Architecture](02-architecture.md)

## Running Tests

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit          # Unit tests
npm run test:component     # Component tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests (Playwright)
```

## Troubleshooting

### Database Connection Issues

**SQLite:**
- Ensure the `server/` directory exists and has write permissions
- Check the `SQLITE_PATH` in `.env.local`

**PostgreSQL:**
- Verify PostgreSQL is running: `pg_isready`
- Check connection credentials in `.env.local`
- Ensure database exists: `psql -l | grep consultify`

### Redis Connection Issues

- If Redis is not available, set `MOCK_REDIS=true` in `.env.local`
- Verify Redis is running: `redis-cli ping` (should return `PONG`)

### LLM API Issues

- Verify API key is correctly set in `.env.local`
- Check backend logs for authentication errors
- Ensure you have sufficient API quota/credits

### Port Already in Use

- Change `PORT` in `.env.local` (default: 3005)
- Change frontend port in `vite.config.ts` (default: 3000)
- Check occupied ports: `lsof -i :3005` (macOS/Linux)

## Development Workflow

1. **Make changes** to code
2. **Frontend** hot-reloads automatically (Vite)
3. **Backend** requires restart for changes (or use nodemon)
4. **Run tests** before committing: `npm run test:all`
5. **Type check**: `npm run type-check`

## Next Steps

- **[Architecture Guide](02-architecture.md)** – Understand the system architecture
- **[Development Guide](04-development.md)** – Learn about coding standards and workflows
- **[API Reference](API_REFERENCE.md)** – Explore the API endpoints
- **[Features Documentation](03-features.md)** – Understand platform capabilities

## Additional Resources

- [Local Setup Guide](../LOCAL_SETUP.md) – Detailed local setup instructions
- [Deployment Guide](06-deployment.md) – Production deployment instructions
- [API Reference](API_REFERENCE.md) – Complete API documentation

---

**Need help?** Check the logs in the console or review the [troubleshooting section](#troubleshooting) above.




