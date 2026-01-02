# 10. Non-Functional Requirements (NFR)

## 10.1. Performance
*   **API Response Time**: < 300ms for 95% of requests (excluding AI generation).
*   **AI Latency**: < 10s for initial chunk (Time To First Token) via Streaming.
*   **Report Generation**: < 60s for full PDF. Background worker handles this asynchronously to prevent timeouts.

## 10.2. Availability & Reliability
*   **SLA**: 99.9% uptime strictly monitored by UptimeRobot / AWS CloudWatch.
*   **Maintenance Windows**: Scheduled for Sundays 02:00 UTC with 48h notice.
*   **Zero Downtime Deployment**: Blue/Green deployment strategy using Docker containers.

## 10.3. Scalability
*   **Horizontal Scaling**: Stateless API tier allows adding N instances behind the Load Balancer.
*   **Vertical Scaling**: Database can be resized from `db.t3.medium` to `db.m5.large` with minimal downtime.
*   **Concurrent Users**: System designed to support 10,000 active users per shard.

## 10.4. Backup & Disaster Recovery (DR)
*   **Backup Frequency**: Daily incremental snapshots (retained for 30 days). weekly full backups.
*   **Geo-Redundancy**: Backups replicated to a secondary AWS Region (e.g., eu-central-1 -> eu-west-1).
*   **Corruption Recovery**: Immutability locks on S3 buckets prevent ransomware encryption of backups.

## 10.5. Monitoring & Logging
*   **Application Logs**: Winston logger via standard output -> Aggregated in Datadog/CloudWatch.
*   **Error Tracking**: Sentry integration for real-time frontend/backend exception alerts.
*   **Metrics**: Prometheus endpoint exposing standard Node.js metrics (Event loop lag, Heap memory).

## 10.6. Cost Control
*   **AI Token Limits**: Hard caps on monthly token usage per Tenant to prevent billing spikes.
*   **Resource Tagging**: All cloud resources tagged by Environment (`prod`, `staging`) and CostCenter.
