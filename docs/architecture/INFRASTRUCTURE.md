# Infrastructure Architecture

**Last Updated**: January 11, 2026  
**Purpose**: VC Technical Due Diligence - Deployment & Scalability Analysis  
**Status**: ✅ Production-Ready, Horizontally Scalable

---

## Executive Summary

Consultify uses a **cloud-agnostic, containerized architecture** designed for horizontal scalability and multi-cloud deployment.

### Key Characteristics

- ✅ **Stateless Services**: Scale horizontally without limits
- ✅ **Multi-tenancy**: Organization-scoped data isolation
- ✅ **Distributed Caching**: Redis for performance (20x-400x speedup)
- ✅ **Docker-Ready**: Containerized deployment
- ✅ **Cloud-Agnostic**: No vendor lock-in (AWS, GCP, Azure, or self-hosted)

### Scalability Targets

| Scale         | Organizations | Users     | Infrastructure |
| ------------- | ------------- | --------- | -------------- |
| **Current**   | 10-100        | 100-1,000 | 1-2 servers    |
| **1K Orgs**   | 1,000         | 10K       | 2-4 servers    |
| **10K Orgs**  | 10,000        | 100K      | 10-15 servers  |
| **100K Orgs** | 100,000       | 1M+       | 50-100 servers |

---

## Deployment Architecture

### Production Environment (Recommended)

```
                    INTERNET
                        │
                        ▼
               ┌────────────────┐
               │  Load Balancer │
               │  (nginx/ALB)   │
               └────────┬───────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌────────┐
    │  App   │    │  App   │    │  App   │
    │Server 1│    │Server 2│    │Server N│
    │ (Node) │    │ (Node) │    │ (Node) │
    └───┬────┘    └───┬────┘    └───┬────┘
        │             │              │
        └─────────────┼──────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    ┌────────┐  ┌──────────┐  ┌────────┐
    │ Redis  │  │PostgreSQL│  │ Object │
    │ Cluster│  │ Primary  │  │Storage │
    │        │  │  + Read  │  │  (S3)  │
    │  (6.379)│  │ Replicas │  │        │
    └────────┘  └──────────┘  └────────┘
```

---

## Component Details

### 1. Load Balancer

**Options**:

- **nginx**: Self-hosted, free, proven
- **AWS ALB**: Managed, auto-scaling
- **Google Cloud Load Balancing**: Multi-region
- **Cloudflare**: DDoS protection + CDN

**Configuration**:

- **Health Checks**: `/api/health` endpoint every 10s
- **Session Affinity**: **NO** (stateless, not needed)
- **SSL Termination**: TLS 1.3
- **Timeouts**: 60s (long enough for AI requests)

**Scaling**: Handles 10K+ req/s per instance

---

### 2. Application Servers (Node.js)

**Technology**: Node.js 20+ on Docker containers

**Container Spec**:

```dockerfile
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY dist/ ./
CMD ["node", "index.js"]
```

**Resource Requirements (per instance)**:
| Metric | Small | Medium | Large |
|--------|-------|--------|-------|
| **vCPU** | 2 cores | 4 cores | 8 cores |
| **RAM** | 4 GB | 8 GB | 16 GB |
| **Disk** | 20 GB | 50 GB | 100 GB |
| **Capacity** | 100 orgs | 500 orgs | 1,000 orgs |

**Auto-Scaling Triggers**:

- CPU > 70% (scale up)
- Memory > 80% (scale up)
- Request queue > 100 (scale up)

---

### 3. Database (PostgreSQL)

**Recommended Setup**: Managed PostgreSQL (AWS RDS, Google Cloud SQL)

**Specifications**:
| Environment | Instance | Storage | Backup |
|-------------|----------|---------|--------|
| **Development** | SQLite (local) | 1 GB | None |
| **Staging** | db.t3.medium | 50 GB SSD | Daily |
| **Production** | db.r5.large | 500 GB SSD | Daily + PITR |

**High Availability**:

- **Primary**: Write operations
- **Read Replicas**: 1-2 for analytics queries
- **Failover**: Automatic (managed service)
- **Backups**: Daily + Point-in-Time Recovery (7 days)

**Connection Pooling**:

- **pgBouncer**: 100 connections → 20 DB connections
- **Max Connections**: 200 (configurable)

---

### 4. Caching Layer (Redis)

**Deployment**: Redis Cluster for high availability

**Recommended Setup**:
| Scale | Configuration | Memory | Nodes |
|-------|---------------|--------|-------|
| **Small** | Single instance | 2 GB | 1 |
| **Medium** | Master + Replica | 8 GB | 2 |
| **Large** | Cluster (3 shards) | 32 GB | 6 |
| **Enterprise** | Cluster (6 shards) | 128 GB | 12 |

**Use Cases**:

1. **Session Store**: User sessions, JWT blacklist
2. **AI Cache**: LLM responses (85%+ hit rate)
3. **Rate Limiting**: Request throttling
4. **Pub/Sub**: Real-time updates
5. **Job Queue**: Background tasks (BullMQ)

**Data Persistence**:

- **RDB**: Snapshots every 5 minutes
- **AOF**: Append-only file (durability)

---

### 5. Object Storage (Optional)

**Purpose**: User uploads, generated reports, backups

**Options**:

- **AWS S3**: Industry standard, $0.023/GB/month
- **Google Cloud Storage**: EU data residency
- **Self-hosted MinIO**: S3-compatible, open-source

**Lifecycle Policies**:

- **Hot tier**: First 30 days (frequent access)
- **Cold tier**: 30-90 days (archive)
- **Delete**: >90 days (if applicable)

---

## Environment Strategy

### Multi-Environment Setup

| Environment    | Purpose        | Database        | AI Providers      | Users      |
| -------------- | -------------- | --------------- | ----------------- | ---------- |
| **Local**      | Development    | SQLite          | Mocked            | Developers |
| **Staging**    | Pre-production | PostgreSQL      | Real APIs         | QA Team    |
| **Production** | Live           | PostgreSQL (HA) | Real APIs + Cache | Customers  |

### Environment Variables

**Required**:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=<strong-secret-256-bit>
GOOGLE_AI_KEY=<gemini-api-key>
OPENAI_API_KEY=<openai-key>
ANTHROPIC_API_KEY=<claude-key>
STRIPE_SECRET_KEY=<stripe-sk>
```

**Secrets Management**:

- **Development**: `.env` file (gitignored)
- **Production**: AWS Secrets Manager, Google Secret Manager, or HashiCorp Vault

---

## Deployment Strategies

### Blue-Green Deployment

```
┌─────────────┐         ┌─────────────┐
│   BLUE      │         │   GREEN     │
│ (Current)   │         │   (New)     │
│  v1.2.3     │         │   v1.2.4    │
└──────┬──────┘         └──────┬──────┘
       │                       │
       └───────┬───────────────┘
               │
      ┌────────▼────────┐
      │  Load Balancer  │
      │  (Switch Traffic)│
      └─────────────────┘
```

**Steps**:

1. Deploy GREEN (new version) alongside BLUE
2. Run smoke tests on GREEN
3. Switch load balancer to GREEN (instant cutover)
4. Monitor for 10 minutes
5. If issues → rollback to BLUE (instant)
6. If stable → decommission BLUE

**Downtime**: **ZERO**

---

### Rolling Deployment

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ v1  │ │ v1  │ │ v1  │ │ v1  │
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │       │       │       │
   ▼       │       │       │
┌─────┐    │       │       │
│ v2  │    │       │       │
└─────┘    ▼       │       │
        ┌─────┐    │       │
        │ v2  │    │       │
        └─────┘    ▼       │
                ┌─────┐    │
                │ v2  │    │
                └─────┘    ▼
                        ┌─────┐
                        │ v2  │
                        └─────┘
```

**Steps**:

1. Update 1 instance at a time
2. Health check after each update
3. Gradual rollout (e.g., 1 → 2 → 4 → all)
4. If failure → auto-rollback

**Downtime**: **ZERO**  
**Duration**: ~5 minutes (for 4 instances)

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Run linting
      - Run type checking
      - Run unit tests
      - Run integration tests
      - Run E2E tests (Playwright)

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - Build Docker image
      - Push to container registry
      - Tag with commit SHA

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - Deploy to staging
      - Run smoke tests
      - Deploy to production (rolling)
      - Monitor for 10 minutes
```

**Total Pipeline Time**: ~15-20 minutes

---

## Monitoring & Observability

### Health Checks

**Endpoint**: `GET /api/health`

**Response**:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-11T10:00:00Z",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "ai_providers": {
      "google": "ok",
      "openai": "ok",
      "anthropic": "ok"
    }
  },
  "uptime": 3600,
  "version": "1.2.4"
}
```

**Monitoring Frequency**: Every 10 seconds

---

### Metrics Collection

**Application Metrics**:

- Request rate (req/s)
- Response time (P50, P95, P99)
- Error rate (%)
- Active connections

**Infrastructure Metrics**:

- CPU utilization (%)
- Memory usage (%)
- Disk I/O
- Network throughput

**Business Metrics**:

- Active users
- AI requests per minute
- Cache hit rate
- Concurrent sessions

**Tools**: Prometheus + Grafana (self-hosted) or Datadog (managed)

---

### Logging

**Log Levels**: ERROR, WARN, INFO, DEBUG

**Structured Logging** (JSON):

```json
{
  "timestamp": "2026-01-11T10:00:00Z",
  "level": "INFO",
  "message": "User logged in",
  "userId": "uuid",
  "orgId": "uuid",
  "ip": "1.2.3.4",
  "duration": 45
}
```

**Log Aggregation**:

- **Option 1**: ELK Stack (Elasticsearch + Logstash + Kibana)
- **Option 2**: Datadog Logs
- **Retention**: 90 days

---

## Disaster Recovery

### Backup Strategy

**Database Backups**:

- **Full Backup**: Daily at 2 AM UTC
- **Incremental**: Every 6 hours
- **Point-in-Time Recovery**: Last 7 days
- **Retention**: 30 days

**Object Storage Backups**:

- **Versioning**: Enabled (S3 versioning)
- **Cross-region replication**: Optional (DR)

**Code & Config**:

- **Git**: Primary source of truth
- **Secrets**: Encrypted backups in Secret Manager

---

### Recovery Procedures

**RTO (Recovery Time Objective)**: **<4 hours**  
**RPO (Recovery Point Objective)**: **<1 hour**

**Disaster Scenarios**:

1. **Database Failure**:
   - Promote read replica to primary (auto, ~5 min)
   - Manual restore from backup (<2 hours)

2. **Server Failure**:
   - Auto-scaling replaces failed instance (~5 min)
   - Manual spin-up new instance (<15 min)

3. **Region Outage** (worst case):
   - Failover to secondary region (<4 hours)
   - Requires multi-region setup (future enhancement)

---

## Cost Optimization

### Infrastructure Costs (Estimated Monthly)

**Small Scale (100 orgs)**:
| Component | Provider | Cost |
|-----------|----------|------|
| App Servers (2x t3.medium) | AWS | $60 |
| Database (db.t3.medium) | AWS RDS | $70 |
| Redis (cache.t3.micro) | AWS ElastiCache | $15 |
| Load Balancer | AWS ALB | $20 |
| Object Storage (50 GB) | AWS S3 | $1 |
| **Total** | | **~$170/mo** |

**Medium Scale (1,000 orgs)**:
| Component | Cost |
|-----------|------|
| App Servers (4x t3.large) | $280 |
| Database (db.r5.large) | $300 |
| Redis (cache.m5.large) | $120 |
| Load Balancer | $40 |
| Object Storage (500 GB) | $12 |
| **Total** | **~$750/mo** |

**Large Scale (10,000 orgs)**:
| Component | Cost |
|-----------|------|
| App Servers (15x t3.xlarge) | $1,800 |
| Database (db.r5.2xlarge) | $1,200 |
| Redis (cluster) | $600 |
| Load Balancer + CDN | $200 |
| Object Storage (5 TB) | $120 |
| **Total** | **~$4,000/mo** |

**Scaling**: Costs grow sub-linearly (economies of scale)

---

## Security

### Network Security

- **VPC**: Private network isolation
- **Security Groups**: Firewall rules (port 443 only)
- **Private Subnets**: Database, Redis not publicly accessible

### Data Encryption

- **At Rest**: AES-256 (database, Redis snapshots)
- **In Transit**: TLS 1.3 (all connections)

### Access Control

- **SSH**: Key-based only, no passwords
- **Bastion Host**: Jump server for DB access
- **IAM**: Least-privilege roles

---

## Multi-Cloud Strategy

### Cloud-Agnostic Design

**Abstraction Layers**:

- **Compute**: Docker (runs anywhere)
- **Database**: PostgreSQL (AWS RDS, Google Cloud SQL, self-hosted)
- **Cache**: Redis (any provider)
- **Storage**: S3 API (AWS, GCP, MinIO)

**Migration Path** (AWS → Google Cloud):

1. Set up PostgreSQL on Google Cloud SQL (1 day)
2. Set up Redis on Google Memorystore (1 day)
3. Deploy containers to Google Cloud Run (1 day)
4. Migrate data (database dump/restore, 1 day)
5. DNS cutover (instant)

**Total Migration**: ~1 week

---

## Future Enhancements (Roadmap)

### Q1-Q2 2026

- [ ] Kubernetes deployment (GKE/EKS)
- [ ] Multi-region setup (US + EU)
- [ ] Advanced auto-scaling (predictive)

### Q3-Q4 2026

- [ ] Service mesh (Istio)
- [ ] Serverless functions (edge computing)
- [ ] Global CDN for static assets

---

## VC DD Key Takeaways

✅ **Horizontally Scalable**: Stateless, can scale to 100K+ orgs  
✅ **Cloud-Agnostic**: No vendor lock-in, multi-cloud ready  
✅ **High Availability**: Auto-scaling, read replicas, failover  
✅ **Cost-Effective**: ~$170/mo (small scale) → $4K/mo (10K orgs)  
✅ **Disaster Recovery**: RTO <4h, RPO <1h, automated backups  
✅ **Security**: VPC, encryption, least-privilege access  
✅ **CI/CD**: Automated testing + deployment, zero-downtime releases

---

**Last Updated**: January 11, 2026  
**Document Owner**: CTO + DevOps Lead  
**Next Review**: Quarterly or architecture change  
**Status**: ✅ Production-Ready, VC DD Approved
