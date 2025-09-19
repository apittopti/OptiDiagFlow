# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OptiDiagFlow is a Next.js 15.5.3 application for automotive diagnostic management, built with TypeScript and using ODX (Open Diagnostic Data Exchange) standards for vehicle diagnostics.

**CRITICAL**: All code implementations MUST strictly adhere to the ODX standard. Reference the schema files (odx.xsd, odx-xhtml.xsd) in ExamplesForClaude for validation.

## Development Commands

```bash
# Navigate to the application directory first
cd opti-diag-flow

# Development
npm run dev        # Start development server with Turbopack on port 6001

# Build & Production
npm run build      # Build production bundle with Turbopack
npm run start      # Start production server on port 6001

# Database Operations
npm run db:push    # Push Prisma schema to database without migrations
npm run db:migrate # Run Prisma migrations in development
npm run db:seed    # Seed database with initial data (prisma/seed.js)
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15.5.3 with App Router and Turbopack
- **Language**: TypeScript with strict mode enabled
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Prisma adapter
- **UI Components**: Radix UI primitives with Tailwind CSS 4
- **API Pattern**: REST endpoints in `src/app/api/`
- **State Management**: React Query (TanStack Query) with tRPC

### Project Structure

```
opti-diag-flow/
├── src/
│   ├── app/                 # Next.js App Router pages and API routes
│   │   ├── api/             # REST API endpoints
│   │   │   ├── auth/        # Authentication endpoints
│   │   │   ├── jobs/        # Diagnostic job management
│   │   │   ├── odx/         # ODX file processing
│   │   │   ├── sessions/    # Session management
│   │   │   ├── vehicles/    # Vehicle data management
│   │   │   └── uds/         # UDS service definitions
│   │   ├── dashboard/       # Dashboard pages
│   │   ├── jobs/           # Job management UI with integrated file upload
│   │   ├── odx-knowledge/  # ODX knowledge base UI
│   │   ├── odx-management/ # ODX file management UI
│   │   ├── oem/            # OEM management
│   │   └── vehicles/       # Vehicle management UI
│   ├── components/         # Reusable React components
│   ├── lib/               # Core business logic and utilities
│   │   ├── auth-config.ts           # NextAuth configuration
│   │   ├── prisma.ts                # Prisma client singleton
│   │   ├── doip-parser.ts          # DoIP trace file parser
│   │   ├── odx-parser.ts           # ODX file parser
│   │   ├── odx-discovery-engine.ts # ODX discovery logic
│   │   ├── odx-ecu-manager.ts      # ECU management
│   │   └── parsing-engine.ts       # General parsing utilities
│   └── types/             # TypeScript type definitions
├── prisma/
│   ├── schema.prisma      # Database schema definition
│   └── seed.js           # Database seeding script
└── public/               # Static assets
```

### Key Domain Models

The application manages automotive diagnostic data with these core entities:
- **Company**: Manufacturing companies (OEMs)
- **Vehicle**: Individual vehicle records with VIN tracking
- **DiagnosticLayer**: ODX diagnostic layers (protocols, ECUs, base variants)
- **DiagnosticJob**: Diagnostic sessions and their results
- **TraceSession**: DoIP trace recordings and analysis
- **ECUVariant**: ECU configurations and variants
- **DTCSection**: Diagnostic Trouble Code definitions
- **User/Account**: Authentication and user management

### API Design Patterns

REST APIs follow this structure:
- `GET /api/[resource]` - List resources
- `POST /api/[resource]` - Create resource
- `GET /api/[resource]/[id]` - Get specific resource
- `PUT /api/[resource]/[id]` - Update resource
- `DELETE /api/[resource]/[id]` - Delete resource

Most API routes interact with Prisma through the singleton client in `src/lib/prisma.ts`.

### Authentication Flow

Uses NextAuth.js with database sessions:
- Configuration in `src/lib/auth-config.ts`
- Middleware protection in `src/middleware.ts`
- Session management via Prisma adapter
- Protected routes require authentication

### File Processing

The application handles two main file types:
1. **ODX Files** (.odx, .odx-d, .odx-v): Parsed in `src/lib/odx-parser.ts`
2. **DoIP Traces**: Parsed in `src/lib/doip-parser.ts`

Files are uploaded through the jobs page interface and processed asynchronously.

### Development Notes

- Path alias `@/*` maps to `./src/*`
- Strict TypeScript configuration enforced
- Database URL configured via `DATABASE_URL` environment variable
- Development server runs on port 6001 (not default 3000)
- Using Turbopack for faster builds and HMR

### Demo Credentials

For testing the application:
- **Username**: demo@optiflow.com
- **Password**: demo123

### Database Credentials

PostgreSQL database connection:
- **Database**: postgres
- **Password**: ClipperTippy1!

### Test Data - Real Trace Logs

**IMPORTANT**: Always use these real trace logs for testing. Never create synthetic test logs.

Location: `C:\Optimotive-dev\OptiDiagFlow\ExamplesForClaude\TraceLogs\`

Available trace logs:
- **Land Rover Defender 2020**: `Landrover/Defender/2020/Camera Calibration/8873778.txt`
- **Polestar 2 2022**: `Polestar/Polestar 2/2022/Camera calibration/8875011.txt`

### ODX Reference Files

Location: `C:\Optimotive-dev\OptiDiagFlow\ExamplesForClaude\`

**Schema Files**:
- `odx.xsd` - ODX XML Schema Definition
- `odx-xhtml.xsd` - ODX XHTML Schema Definition

**ODX/PDX Examples** in `ODX-examples/`:
- **MAGNA 1.pdx** - Contains multiple ECUs and a vehicle file (comprehensive example)
- **VehicleInfo.odx-v** - Vehicle information file
- **BV_EGS.odx-d** - Base variant diagnostic file
- **GREN_BV_BCM.odx-d** - Grenadier BCM diagnostic file
- Various PDX files: EGS.pdx, GWS.pdx, SCR.pdx, TEC_DDE_PDX, DME_PDX

These files serve as reference implementations for ODX parsing and testing.