# Piotr's Development Tools

**⚠️ FOR INTERNAL USE ONLY - NOT FOR AUDIT**

This directory contains personal development utilities, experimental features, and project management artifacts. These tools are not part of the production codebase and should be excluded from formal technical audits.

---

## 📁 Directory Structure

### `refactoring/`

Custom AST manipulation and code modification scripts used during major refactoring initiatives.

**Purpose**: One-off scripts for automated code transformations  
**For Audit**: ❌ Exclude

### `experiments/`

Experimental features, AI integrations, and proof-of-concept implementations.

**Purpose**: Testing new technologies and approaches  
**For Audit**: ❌ Exclude

### `debug/`

Debug utilities, troubleshooting tools, and diagnostic artifacts.

**Purpose**: Development debugging and issue diagnosis  
**For Audit**: ❌ Exclude

### `migration/`

One-off migration scripts used during platform evolution (e.g., ESM migration, TypeScript migration).

**Purpose**: Historical migration tooling  
**For Audit**: ❌ Exclude

### `utilities/`

Helper scripts for development workflow optimization.

**Purpose**: Development automation  
**For Audit**: ❌ Exclude

### `project-mgmt/`

Project management artifacts including backlog, status reports, and planning documents.

**Purpose**: Project tracking and historical documentation  
**For Audit**: ❌ Exclude

---

## 🎯 Usage

These tools are maintained for:

- Development workflow optimization
- Historical reference
- Experimental feature testing
- One-off automation tasks

**They are NOT required for**:

- Building the application
- Running tests
- Deploying to production
- Operating the platform

---

## 📝 For Auditors

**Please exclude this entire directory from your technical audit.**

Focus your review on:

- `/src` - Frontend source code
- `/server` - Backend source code
- `/tests` - Test suite
- `/docs` - Enterprise documentation
- `/scripts` - Production utility scripts

For audit scope questions, contact: engineering@company.com

---

**Last Updated**: January 11, 2026  
**Maintained By**: Piotr Wiśniewski (Development Lead)
