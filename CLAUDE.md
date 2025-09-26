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

Complete trace logs collection: `C:\Optimotive-dev\OptiDiagFlow\ExamplesForClaude\TraceLogsComplete\`
- Contains 35 trace files from various OEMs (Fiat, Ford, Honda, Hyundai, Kia, Land Rover, Mercedes-Benz, MG, Mitsubishi, Nissan, Polestar, Toyota, Vauxhall, Volkswagen, Volvo)

Example trace logs for quick testing:
- **Land Rover Defender 2020**: `Landrover/Defender/2020/Camera Calibration/8873778.txt`
- **Polestar 2 2022**: `Polestar/Polestar 2/2022/Camera calibration/8875011.txt`

### Script Organization Rules

**IMPORTANT**: Never create duplicate or temporary scripts. Follow this organization:

```
opti-diag-flow/
├── scripts/
│   ├── dtc/           # DTC-related utilities
│   ├── import/        # Data import scripts
│   └── seed/          # Database seeding scripts
```

**Rules for Creating Scripts**:
1. Never create test/temporary scripts in the root directory
2. Always place scripts in the appropriate subdirectory
3. Never create multiple versions of the same script (no "properly-", "test-", "verify-" prefixes)
4. One script per purpose - consolidate functionality
5. Delete test scripts immediately after use

### Importing Trace Files for Testing

**IMPORTANT**: The application ONLY references files in `uploads/traces` directory. The TraceLogsComplete directory is for Claude's reference only.

To properly set up test data, always upload trace files to the application's uploads directory:

```bash
cd opti-diag-flow
node scripts/import/upload-trace-files.js
```
This script:
- Reads trace files from TraceLogsComplete (Claude's reference location)
- Uploads them through the `/api/upload` endpoint
- Files are saved to `uploads/traces` with timestamped filenames (e.g., `1758886171435-65okmi-YW23BTX_XC90_CAMERA_ALLSCREENS_LOG.txt`)
- This is where the application expects to find trace files

After uploading, create jobs that reference these uploaded files:
```bash
cd opti-diag-flow
# Create jobs using the uploaded files
```

#### Important Notes:
- **Application references**: `uploads/traces` directory ONLY
- **Claude references**: `TraceLogsComplete` directory for understanding trace content
- After database reset, always run `properly-upload-traces.js` to populate uploads directory
- The reparse functionality looks for files in `uploads/traces` by matching filename patterns
- Currently 35 trace files available for testing after proper upload

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

## Trace Parser - JifelineParser

### Overview
The application uses a **SINGLE unified parser** (`src/lib/trace-parser/jifeline-parser.ts`) for ALL Jifeline trace files. This parser automatically detects and handles multiple protocols within the same trace file.

### Supported Protocols
The JifelineParser automatically detects and parses the following protocols:
- **DoIP (Diagnostic over IP)**: Ethernet-based diagnostic protocol
- **ISO-TP (ISO 15765-2)**: CAN-based diagnostic protocol (handles all variants)
- **ISO14230**: K-line diagnostic protocol for legacy vehicles
- **OBD-II/EOBD**: On-Board Diagnostics standard

### Protocol Detection Rules
The parser detects protocols based on message format and CAN ID patterns:

1. **DoIP**: Messages contain explicit source/target addresses in args (e.g., `0E80`, `1726`)
   - Used by: Land Rover, Jaguar, Polestar

2. **ISO-TP with 29-bit Extended CAN IDs**:
   - Format: `0x18DAxxYY` where xx=target, YY=source
   - Used by: Honda (labeled as "HONDA ISOTP" in logs)
   - Also seen in some Renault/Nissan vehicles

3. **ISO-TP with 11-bit Standard CAN IDs**:
   - Various formats including:
     - `0x07Dx` range (Hyundai/Kia - labeled as "HYUNDAI ISOTP")
     - `0x07E0`, `0x0710` (Ford/MG - labeled as "FORD ISOTP")
     - `0x0792`, `0x079A` (Toyota - labeled as "TOYOTA ISOTP")
     - Mixed patterns (Renault/Nissan - labeled as "RENAULT ISOTP")

4. **OBD-II Standard**:
   - Broadcast: `0x07DF`
   - Requests: `0x07E0-0x07E7`
   - Responses: `0x07E8-0x07EF`

5. **ISO14230 (K-line)**: Module identifiers like `K-line1`, `K-line2`

### Currently Supported OEM Trace Formats
Based on trace logs in `ExamplesForClaude/TraceLogsComplete`:

✅ **Fully Supported**:
- **Honda** (Jazz V 2020) - Uses ISO-TP with 29-bit extended CAN IDs (0x18DAxxYY format)
- **Hyundai** (i20 2021) - Uses ISO-TP with 11-bit standard CAN IDs (0x07D2, 0x07DA)
- **Kia** - Uses same as Hyundai (11-bit standard CAN IDs)
- **Land Rover** (Defender 2020/2023, Range Rover Sport III 2025) - Uses DoIP protocol
- **Jaguar** - Uses DoIP protocol (same as Land Rover)
- **Polestar** (Polestar 2 2022) - Uses DoIP protocol
- **Nissan** (Qashqai 2022) - Uses ISO-TP with mixed 11-bit and 29-bit CAN IDs
- **Renault** - Uses ISO-TP with mixed 11-bit and 29-bit CAN IDs (same as Nissan)
- **MG** (MG 3 2021) - Uses ISO-TP with 11-bit standard CAN IDs (0x07E0, 0x0710)
- **Ford** - Uses ISO-TP with 11-bit standard CAN IDs (same as MG)
- **Toyota** (Yaris 2024) - Uses ISO-TP with 11-bit standard CAN IDs (0x0792, 0x079A)

### Protocol Implementation Analysis
**Key Finding**: After deep analysis of all trace logs, the "special" ISOTP protocols (HONDA ISOTP, HYUNDAI ISOTP, FORD ISOTP, TOYOTA ISOTP, RENAULT ISOTP) are actually **standard ISO-TP (ISO 15765-2)** with different CAN ID addressing schemes:

| OEM | Protocol Label in Logs | Actual Protocol | CAN ID Type | Example CAN IDs |
|-----|------------------------|-----------------|-------------|-----------------|
| Honda | "HONDA ISOTP" | ISO-TP | 29-bit Extended | 0x18DAB0F1, 0x18DAF1B0 |
| Hyundai/Kia | "HYUNDAI ISOTP" | ISO-TP | 11-bit Standard | 0x07D2, 0x07DA |
| Renault/Nissan | "RENAULT ISOTP" | ISO-TP | Mixed 11/29-bit | 0x07D6, 0x18DAxxYY |
| Ford/MG | "FORD ISOTP" | ISO-TP | 11-bit Standard | 0x07E0, 0x0710 |
| Toyota | "TOYOTA ISOTP" | ISO-TP | 11-bit Standard | 0x0792, 0x079A |

### Actual Protocols Used
Only **two distinct protocols** are actually in use across all OEMs:
1. **DoIP (Diagnostic over IP)** - Used by JLR group (Land Rover, Jaguar) and Polestar
2. **ISO-TP (ISO 15765-2)** - Used by ALL other OEMs with varying CAN ID addressing:
   - 11-bit standard CAN IDs (most common)
   - 29-bit extended CAN IDs (Honda, some Renault/Nissan)
   - OBD-II standard addresses (0x07DF broadcast, 0x07E0-0x07EF)

### ECU Address Extraction
The parser extracts ECU addresses based on protocol and message format:

- **DoIP**: Direct addresses from args[0] (source) and args[1] (target)
- **ISO-TP with 29-bit CAN IDs**: Extract from CAN ID pattern:
  - `0x18DAxxYY` → target=xx, source=YY (Honda format)
  - `0x18DBxxYY` → target=xx, source=YY (rarely used)
- **ISO-TP with 11-bit CAN IDs**: Direct CAN ID as address
  - Request/Response pairs mapped (e.g., `07E0`/`07E8`)
- **OBD-II**: Map response IDs (`07E8-07EF` → ECU_0 to ECU_7)
- **ISO14230 (K-line)**: Use module identifier as address
- **Tester Address**: `0E80` (DoIP), `F1` (ISO-TP), `TESTER` (K-line)

### ECU Naming Architecture
**CRITICAL**: ECU names follow a strict two-tier system:
1. **Parser Level**: Always generates generic names (`ECU_B0`, `ECU_1726`) - NO hardcoded names
2. **Knowledge Base Level**: User-assigned names via `/api/knowledge/ecu/resolve`

#### Name Resolution Flow
```
Parser → Generic ECU_[address] → Knowledge Base Lookup → Display Name
```

**Parser Behavior** (`src/lib/trace-parser/jifeline-parser.ts`):
- Generates ONLY generic names: `ECU_${address}` (e.g., `ECU_B0`, `ECU_1726`)
- NEVER hardcodes vehicle-specific names like "Camera_B0" or "Gateway_F1"
- Name assignment is exclusively handled by knowledge base

**Knowledge Base Resolution** (`src/app/api/knowledge/ecu/resolve/route.ts`):
- Frontend calls this endpoint with ECU addresses
- Searches ECUDefinition table with priority:
  1. ModelYear specific → Model specific → OEM specific → Any verified → Any definition
- Returns user-assigned names or falls back to generated defaults
- **Issue Prevention**: Remove old hardcoded ECU definitions when changing parser naming

### Data Extraction
The parser extracts:
- **ECUs**: Address, name, protocol, message count
- **UDS Services**: Session Control (0x10), Security Access (0x27), Read DID (0x22), etc.
- **Security Levels**: From service 0x27 subfunctions
- **Session Types**: Default (0x01), Extended (0x03), etc.
- **DTCs**: From service 0x19 responses with ISO 14229 status bytes
- **DIDs**: From service 0x22/0x62 with data values
- **Routines**: From service 0x31 with control types

### Message Storage
- **ALL messages are stored** in job metadata for complete UDS Flow display
- Full message data preserved for diagnostic analysis
- Direction preserved: `Local->Remote` (Tester→ECU), `Remote->Local` (ECU→Tester)
- messagesComplete flag indicates if all messages are stored

## Job Details Page - Tab Functionality

### Overview Tab (`activeTab === 'overview'`)
**Purpose**: High-level summary of the diagnostic job

**Displays**:
1. **Session Information**:
   - Session ID, Vehicle VIN, Procedure Type
   - Status (ACTIVE/COMPLETED)
   - Created timestamp and Duration
   - Total Messages count (from metadata.messages.length)
   - Protocol (DoIP/UDS)
   - Trace File name

2. **Security Access Analysis**:
   - Checks BOTH message events AND ECU metadata for security access
   - If messages available: Shows detailed seed/key exchange events
   - If only metadata: Shows ECUs with security levels
   - Statistics: Successful Authentications, Failed Attempts, ECUs with Security
   - Security event table with Time, ECU, Event, Level, and Data

### ECUs Tab (`activeTab === 'ecus'`)
**Purpose**: Display all discovered ECUs and their capabilities

**Displays**:
- ECU cards showing:
  - Address badge (e.g., "1726")
  - ECU Name (from knowledge base or default)
  - Description (if available from knowledge base)
  - Message count badge
  - "Verified" badge (if in knowledge base)
  - **Services Used**: Badge list of UDS services (e.g., "Security Access", "Read Data")
  - **Security Levels**: Badge list (e.g., "Level 0x21", "Level 0x22")
  - **Session Types**: Badge list (e.g., "Extended", "Default")

### UDS Flow Tab (`activeTab === 'flow'`)
**Purpose**: Show chronological message flow between tester and ECUs

**Features**:
- ECU filter dropdown (excludes tester addresses)
- Message table with columns:
  - Time (timestamp)
  - Source (with ECU name lookup)
  - Arrow (→)
  - Target (with ECU name lookup)
  - Service ID (hex badge)
  - Service Name (decoded)
  - DID (if applicable)
  - Description (decoded message)
  - Raw Message (hex data)
  - Data (extracted data bytes)
- Color coding:
  - Blue background: Requests (Local->Remote)
  - Green background: Positive responses
  - Red background: Negative responses (0x7F)
- Load more button for large message sets

### DTCs Tab (`activeTab === 'dtcs'`)
**Purpose**: Display Diagnostic Trouble Codes by ECU

**Displays**:
- Grouped by ECU name
- DTC table with:
  - DTC Code badge
  - Description
  - HEX Data column showing original hex bytes from trace (e.g., "24C600" for P24C6)
  - ISO 14229 Status bits (8 columns):
    - Test Failed (Bit 0)
    - Failed This Cycle (Bit 1)
    - Pending (Bit 2)
    - Confirmed (Bit 3)
    - Not Complete Clear (Bit 4)
    - Failed Since Clear (Bit 5)
    - Not Complete Cycle (Bit 6)
    - Warning Light (Bit 7)
- Visual indicators (colored boxes) for each status bit

**Recent Enhancement**: Added `rawHex` field to DTC storage and display for showing original hex bytes before P/B/U/C code conversion

### DIDs Tab (`activeTab === 'dids'`)
**Purpose**: Display Data Identifiers read from ECUs

**Displays**:
- Grouped by ECU name
- DID table with:
  - DID badge (hex value)
  - Name (from common DIDs or default)
  - Type (data type)
  - Length (in bytes)
  - Data (sample values from trace, with DID prefix removed)

### Routines Tab (`activeTab === 'routines'`)
**Purpose**: Display diagnostic routines executed

**Displays**:
- Grouped by ECU name
- Routine cards showing:
  - Routine ID badge (warning color)
  - Routine name
  - Control type (start, stop, results)

### Services Tab (`activeTab === 'services'`)
**Purpose**: Aggregate view of all UDS services used

**Displays**:
- Services grouped by service code
- For each service:
  - Service name and code
  - List of ECUs that used this service
  - Total usage count across all ECUs

## Important Implementation Rules

### Message Population
1. **Reparse Route** (`src/app/api/jobs/[id]/reparse/route.ts:194`):
   - **MUST store ALL messages**: `messages: parsedData.messages` (no slicing!)
   - Add messagesComplete flag: `messagesComplete: true`
   - Store ECU summaries with services, security levels, session types

2. **Job Creation** (`src/app/api/jobs/route.ts:289`):
   - Store ALL messages in metadata during initial creation
   - Same structure as reparse route

3. **Page Display** (`src/app/jobs/[id]/page.tsx:169-183`):
   - Extract messages from `data.metadata.messages` (NOT `data.metadata.procedures`)
   - Map message properties correctly for display
   - Progressive loading: Start with 500, increment by 500

3. **Security Access Display**:
   - Check BOTH message events AND ECU metadata
   - Fall back to ECU metadata display if no messages available
   - Always show security information if ANY ECU has security levels

### Error Handling
- Handle missing messages gracefully with "No messages available" message
- Display ECU metadata even when messages aren't available
- Show appropriate empty states for each tab

### Performance Considerations
- **Store ALL messages** in metadata - critical for complete diagnostic analysis
- Progressive loading in UI: Initial 500 messages, then load 500 more at a time
- "Show All" button available for viewing complete trace
- Client-side ECU filtering for performance
- PostgreSQL JSON field can handle large message arrays (tested with 50,000+ messages)

## API Endpoints Documentation

### Jobs API

#### `GET /api/jobs`
**Purpose**: List diagnostic jobs with filtering and pagination
**Query Parameters**:
- `vehicleId` - Filter by vehicle
- `status` - Filter by job status (ACTIVE, COMPLETED)
- `procedureType` - Filter by procedure type
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset
**Returns**: Jobs with full relations (Vehicle, User, Tag, counts)

#### `POST /api/jobs`
**Purpose**: Create a new diagnostic job from uploaded trace
**Body**:
- `name` - Job name
- `traceContent` - Raw trace file content
- `vehicleId` - Associated vehicle
- `procedureType` - Type of diagnostic procedure
**Process**:
1. Parse trace with JifelineParser
2. Create job and store ECUs, DTCs, DIDs, Routines
3. Trigger knowledge discovery
**Returns**: Created job with all data

#### `GET /api/jobs/[id]`
**Purpose**: Get single job with all related data
**Returns**: Job with ECUs, DTCs, DIDs, Routines, Vehicle hierarchy

#### `PATCH /api/jobs/[id]`
**Purpose**: Update job metadata
**Body**: `name`, `description`, `status`, `procedureType`

#### `DELETE /api/jobs/[id]`
**Purpose**: Delete job and all related data

#### `POST /api/jobs/[id]/reparse`
**Purpose**: Reparse existing job trace file
**Process**:
1. Find trace file based on job name mapping
2. Parse with JifelineParser
3. Delete and recreate all ECUs, DTCs, DIDs, Routines
4. **CRITICAL**: Store ALL messages in metadata (no limit!) for complete UDS Flow display
5. Set messagesComplete: true flag
**Returns**: Parse statistics

### Upload API

#### `POST /api/upload`
**Purpose**: Handle trace file uploads
**Body**: FormData with file
**Process**:
1. Save to `uploads/traces/` directory
2. Generate unique filename with timestamp
3. Return file content for immediate parsing
**Returns**: File info and content

### Knowledge API

#### `POST /api/knowledge/ecu/resolve`
**Purpose**: Resolve ECU addresses to names/descriptions
**Body**:
- `addresses[]` - ECU addresses to resolve
- `vehicleId`, `oemId`, `modelId`, `modelYearId` - Context for resolution
**Resolution Priority**:
1. ModelYear specific definitions
2. Model specific definitions
3. OEM specific definitions
4. Any verified definition
5. Any definition (even unverified)
**Returns**: Map of addresses to ECU definitions

#### `GET /api/knowledge/ecu-definitions`
**Purpose**: List all ECU definitions in knowledge base
**Query Parameters**:
- `oemId` - Filter by OEM
- `modelId` - Filter by model
- `verified` - Filter by verification status

#### `POST /api/knowledge/ecu-definitions`
**Purpose**: Create new ECU definition
**Body**:
- `address` - ECU hex address
- `name` - ECU name
- `description` - ECU description
- `category` - ECU category (Powertrain, Body, Chassis, etc.)

#### `POST /api/knowledge/discover`
**Purpose**: Auto-discover knowledge from job data
**Process**: Analyzes job ECUs and creates definitions

### Vehicle Management API

#### `GET /api/vehicles`
**Purpose**: List vehicles
**Query Parameters**:
- `modelYearId` - Filter by model year
- `vin` - Search by VIN
**Returns**: Vehicles with full hierarchy and job counts

#### `POST /api/vehicles`
**Purpose**: Create vehicle
**Body**:
- `modelYearId` - Required model year
- `vin` - Optional VIN
**Returns**: Created vehicle with relations

#### `GET /api/vehicles/hierarchy`
**Purpose**: Get complete OEM/Model/ModelYear hierarchy
**Returns**: Tree structure for vehicle selection

### OEM/Model/ModelYear APIs

#### `GET /api/oems`
**Purpose**: List all OEMs (manufacturers)
**Returns**: OEMs with model counts

#### `POST /api/oems`
**Purpose**: Create OEM
**Body**: `name`, `country`

#### `GET /api/models`
**Purpose**: List models
**Query Parameters**: `oemId` - Filter by manufacturer

#### `POST /api/models`
**Purpose**: Create model
**Body**: `name`, `oemId`

#### `GET /api/model-years`
**Purpose**: List model years
**Query Parameters**: `modelId` - Filter by model

#### `POST /api/model-years`
**Purpose**: Create model year
**Body**: `year`, `modelId`

### Statistics API

#### `GET /api/stats`
**Purpose**: Get dashboard statistics
**Returns**:
- `totalJobs` - Total diagnostic jobs
- `activeJobs` - Active jobs count
- `totalVehicles` - Total vehicles
- `discoveredECUs` - Total ECUs found
- `totalDTCs` - Total DTCs detected
- `totalDIDs` - Total DIDs read

### Authentication API

#### `POST /api/auth/[...nextauth]`
**Purpose**: NextAuth.js authentication endpoints
**Handles**: Sign in, sign out, session management

#### `POST /api/auth/register`
**Purpose**: User registration
**Body**: `name`, `email`, `password`

### ODX Management APIs

#### `POST /api/odx/discover`
**Purpose**: Discover ODX patterns from trace data

#### `GET /api/odx/knowledge`
**Purpose**: Get ODX knowledge base entries

#### `GET /api/odx-management/hierarchy`
**Purpose**: Get ODX layer hierarchy

#### DTCs, DIDs, Services endpoints for ODX management

### UDS Service Definition APIs

#### `GET /api/uds/services`
**Purpose**: Get UDS service definitions
**Returns**: Standard UDS services (0x10, 0x27, etc.)

#### `GET /api/uds/dids`
**Purpose**: Get standard DID definitions
**Returns**: Common DIDs with names and types

#### `GET /api/uds/ecu-types`
**Purpose**: Get ECU type categories
**Returns**: ECU categories (Powertrain, Body, etc.)

## API Usage Patterns

### Job Creation Flow
1. Upload file via `/api/upload`
2. Create job via `POST /api/jobs` with trace content
3. Parser extracts ECUs, DTCs, DIDs, Routines
4. Knowledge discovery triggered automatically
5. Reparse available via `/api/jobs/[id]/reparse`

### Knowledge Resolution Flow
1. Job page loads ECUs
2. Calls `/api/knowledge/ecu/resolve` with addresses
3. Returns names based on context (OEM/Model/Year)
4. UI displays verified names with badges

### Data Relationships
- **Job** → Vehicle → ModelYear → Model → OEM
- **Job** → ECUConfiguration (discovered ECUs)
- **Job** → DTC, DataIdentifier, Routine (per ECU)
- **ECUDefinition** → OEM/Model/ModelYear (knowledge base)

### Error Handling
- All APIs return consistent error format:
  ```json
  { "error": "Error message", "details": "..." }
  ```
- HTTP status codes:
  - 200: Success
  - 400: Bad request
  - 404: Not found
  - 500: Server error

### Authentication Status
- **Currently DISABLED** in most endpoints for development
- Session management ready via NextAuth
- User association tracked but not enforced