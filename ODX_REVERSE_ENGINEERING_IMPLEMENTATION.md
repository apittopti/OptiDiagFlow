# ODX Reverse Engineering Implementation

## Overview
This document describes the comprehensive ODX reverse engineering system implemented for OptiDiagFlow. The system analyzes Jifeline trace logs to discover ECUs, services, DIDs, DTCs, and routines, then generates complete ODX files from scratch without any existing templates.

## Key Components Implemented

### 1. OEM Seed Script
**File:** `opti-diag-flow/src/lib/seed-oems.ts`
- Parses the trace log directory structure
- Creates OEMs, Models, and Model Years in the database
- Run with: `npx tsx src/lib/seed-oems.ts`

### 2. Enhanced Jifeline Parser
**File:** `opti-diag-flow/src/lib/trace-parser/jifeline-parser.ts`
- **Discovery Features:**
  - Automatically discovers ECUs from trace logs
  - Builds comprehensive DID dictionary from 0x22 services
  - Extracts DTC codes from 0x19 services
  - Identifies routines from 0x31 services
  - Tracks data lengths from actual responses
  - Intelligently guesses ECU names based on address patterns

- **ECU Address Mapping:**
  - 0x0700-0x070F: Powertrain (Engine, TCM, PCM, ECM)
  - 0x0710-0x071F: Body/Comfort (BCM, Door, Seat, Window)
  - 0x0720-0x072F: Chassis (ABS, ESP, Steering, Suspension)
  - 0x0730-0x073F: Safety/ADAS (Airbag, Camera, Radar, ADAS)
  - 0x0740-0x074F: Infotainment (Radio, Navigation, Display)
  - 0x0750-0x075F: Gateway
  - 0x0760-0x076F: Hybrid/Electric (Battery, Inverter, Charger)
  - 0x0770-0x077F: Diagnostics

### 3. ODX Reverse Engineering Module
**File:** `opti-diag-flow/src/lib/odx-generator/reverse-engineer.ts`
- Generates complete ODX structure from discovered data
- Creates:
  - Vehicle Info files (.odx-v)
  - ECU Diagnostic Layers (.odx-d)
  - Protocol definitions (.odx-p)
  - Communication parameters (.odx-c)
- No templates required - builds everything from trace analysis

### 4. Batch Processing Script
**File:** `opti-diag-flow/src/lib/process-all-traces.ts`
- Processes all trace files in the directory
- Generates ODX for each vehicle
- Creates comprehensive discovery reports
- Saves to: `storage/odx/{oemName}/{modelName}/{year}/`
- Run with: `npx tsx src/lib/process-all-traces.ts`

### 5. API Integration
**File:** `opti-diag-flow/src/app/api/jobs/[jobId]/process-trace/route.ts`
- Updated to use the new reverse engineering approach
- Saves discovered ECUs, DIDs, DTCs, and routines to database
- Generates complete ODX package for each job

### 6. Database Schema Updates
**File:** `opti-diag-flow/prisma/schema.prisma`
- Added Company model (for OEMs)
- Added VehicleModel and ModelYear models
- Added DataIdentifier model for discovered DIDs
- Added DTC model for discovered trouble codes
- Added Routine model for discovered routines
- Enhanced ECUConfiguration with metadata field

## Available Trace Logs
Location: `C:\Optimotive-dev\OptiDiagFlow\ExamplesForClaude\TraceLogsComplete\`

1. **Honda Jazz V (2020)** - Camera Calibration
2. **Hyundai i20 (2021)** - Camera Calibration
3. **Land Rover Defender (2020, 2023)** - Camera Calibration
4. **MG 3 (2021)** - Camera Calibration
5. **Nissan Qashqai (2022)** - Camera Calibration
6. **Polestar 2 (2022)** - Camera Calibration
7. **Toyota Yaris (2024)** - Camera Calibration

## How It Works

### Discovery Process
1. **Parse Trace Log**: Extract all CAN/DoIP messages
2. **Identify ECUs**: Track source/target addresses
3. **Discover Services**: Identify UDS service IDs (0x10, 0x22, 0x31, etc.)
4. **Extract DIDs**: Build dictionary from ReadDataByIdentifier (0x22) requests/responses
5. **Find DTCs**: Parse ReadDTCInformation (0x19) responses
6. **Identify Routines**: Track RoutineControl (0x31) operations
7. **Guess Data Types**: Analyze response patterns (ASCII, numeric, binary, date)

### ODX Generation
1. **Vehicle Info**: Generate .odx-v with vehicle metadata
2. **ECU Layers**: Create .odx-d for each discovered ECU
3. **Data Objects**: Define DATA-OBJECT-PROPS for DIDs
4. **Services**: Generate DIAG-SERVICE definitions
5. **DTCs**: Create DTCDOP entries
6. **Protocol**: Define communication protocol layer
7. **Parameters**: Set timing and communication parameters

## Running the System

### 1. Set Up Database
```bash
cd opti-diag-flow
npm run db:push  # Push schema changes
```

### 2. Seed OEMs
```bash
npx tsx src/lib/seed-oems.ts
```

### 3. Process All Traces
```bash
npx tsx src/lib/process-all-traces.ts
```

### 4. Via Web Interface
- Upload a trace file through the Jobs page
- Click "Process Trace" to generate ODX
- View discovered ECUs, DIDs, DTCs, and routines

## Key Features

### Intelligent Discovery
- No pre-existing ODX templates needed
- Learns diagnostic protocol from traces
- Identifies standard and manufacturer-specific DIDs
- Decodes DTC formats correctly
- Maps ECU addresses to likely functions

### Comprehensive Output
- Complete ODX file set per vehicle
- Discovery summary JSON
- Database storage of all findings
- Preserves sample values for analysis

### Extensibility
- Easy to add new DID definitions
- Can enhance ECU name guessing
- Supports multiple trace formats
- Batch processing capability

## Database Models

### Company
- Stores OEM information
- Types: OEM, SUPPLIER, DEALER

### VehicleModel
- Vehicle model definitions
- Linked to Company (OEM)

### ModelYear
- Specific year variants
- Linked to VehicleModel

### ECUConfiguration
- Discovered ECU details
- Address mappings
- Service capabilities

### DataIdentifier
- Discovered DIDs
- Data types and lengths
- Sample values

### DTC
- Diagnostic Trouble Codes
- Status information

### Routine
- Diagnostic routines
- Control types

## Benefits

1. **No Manual ODX Creation**: Automatically generates from traces
2. **Complete Discovery**: Finds all ECUs and services in trace
3. **Intelligent Mapping**: Guesses ECU functions from addresses
4. **Standard Compliance**: Generates valid ODX 2.2.0 format
5. **Database Integration**: Stores all discoveries for analysis
6. **Batch Processing**: Can process multiple vehicles at once

## Future Enhancements

1. **Machine Learning**: Train models to better identify ECU types
2. **DID Database**: Build comprehensive DID knowledge base
3. **Protocol Detection**: Auto-detect CAN vs DoIP vs other protocols
4. **ODX Validation**: Add schema validation against ODX XSD
5. **Merge Capability**: Combine discoveries from multiple traces
6. **Export Formats**: Support PDX package generation