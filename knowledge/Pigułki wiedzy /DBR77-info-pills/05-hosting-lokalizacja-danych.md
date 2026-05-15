# File 05: Hosting and Data Residency — DBR77 Ecosystem

**Producer:** DBR77 Robotics Sp. z o.o.  
**Product:** DBR77 Ecosystem  
**Document version:** 1.0 | March 2026  

---

## 1. Purpose

This document defines how the DBR77 Ecosystem is hosted, how data is managed, and how data residency is controlled across all system layers.

It is designed for:
- CTO / IT leadership  
- Compliance teams  
- Enterprise buyers  

---

## 2. Core Principle

**The client decides where data lives.**

DBR77 adapts to:
- security requirements  
- regulatory constraints  
- infrastructure preferences  

---

## 3. Hosting Models

### 3.1 On-Premise (Full Control)

- Entire system runs inside client infrastructure  
- No external data transfer  
- Full control over hardware and access  

**Best for:**
- regulated industries  
- high IP sensitivity  

---

### 3.2 Private Cloud (Dedicated)

- Single-tenant environment  
- Hosted in AWS / Azure / GCP  
- VPC isolation  

**Best for:**
- enterprise scalability  
- controlled flexibility  

---

### 3.3 Hybrid Model

- critical data on-prem  
- processing in cloud  

**Best for:**
- balancing control and performance  

---

## 4. Data Residency

DBR77 supports:

- EU-only hosting  
- US-only hosting  
- local on-prem deployment  

### Key Rule:
**No data is moved across regions without explicit configuration.**

---

## 5. Data Flow Across Ecosystem

```
IoT → Data Storage → Digital Twin → Vector → IRIS → Marketplace → Consultify
```

At each step:
- data access is controlled  
- processing location is defined  
- ownership remains with client  

---

## 6. Data Storage

| Layer | Storage Type |
|------|-------------|
| Operational data | PostgreSQL |
| Files / datasets | Object storage |
| AI context | Vector DB |

---

## 7. Data Retention

Default:
- minimal storage  
- no unnecessary persistence  

Configurable:
- logs  
- audit data  
- historical datasets  

---

## 8. Security and Hosting Alignment

Hosting choice determines:

- compliance level  
- cost structure  
- performance  

---

## 9. Cost Model

| Model | Cost Type |
|------|----------|
| On-prem | CAPEX |
| Private cloud | OPEX |
| Hybrid | Mixed |

---

## 10. Decision Guidelines

Choose:

- **On-prem** → if security is critical  
- **Private cloud** → if scalability matters  
- **Hybrid** → if both are needed  

---

## 11. Summary

DBR77 Ecosystem provides:

- flexible hosting  
- controlled data residency  
- scalable infrastructure  

---

## 12. Key Takeaway

DBR77 is not tied to one environment.

It is a **deployment-flexible system that adapts to the client’s infrastructure and compliance needs.**

---
