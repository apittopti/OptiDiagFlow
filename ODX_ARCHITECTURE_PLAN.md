# ODX-Based Diagnostic System Architecture Plan

## Executive Summary
This document outlines the architecture for implementing a comprehensive ODX-based diagnostic system in OptiDiagFlow. The system will parse Jifeline trace logs, automatically generate ODX files from captured UDS communications, provide editing capabilities, and visualize diagnostic sessions with proper data conversion.

## 1. System Architecture Overview

### 1.1 Core Components
- **Trace Log Parser**: Extracts ECU communications from Jifeline logs
- **ODX Generator**: Creates ODX XML files from parsed UDS data
- **File Storage System**: Manages ODX files on disk (not database)
- **ODX Editor**: Web-based editor for ODX customization
- **Session Visualizer**: Display diagnostic sessions with ODX data conversion

### 1.2 Data Flow
```
Jifeline Log → Parser → UDS Data → ODX Generator → ODX Files
                                                         ↓
User Upload → Job Creation → Parse & Store → ODX Editor
                                                         ↓
                                           Session Visualization
```

## 2. File-Based ODX Storage Strategy

### 2.1 Directory Structure
```
opti-diag-flow/
├── storage/
│   └── odx/
│       ├── {jobId}/                    # Per-job ODX files
│       │   ├── catalog.xml             # PDX catalog
│       │   ├── vehicle.odx-v           # Vehicle configuration
│       │   ├── {ecu_name}.odx-d        # ECU diagnostic layers
│       │   └── metadata.json           # Job metadata & references
│       └── templates/                   # Base ODX templates
│           ├── protocol.odx-cs         # Communication specs
│           └── base-variant.odx-d      # Base diagnostic layer
```

### 2.2 Database Storage (Minimal)
Only store references and metadata in database:
```typescript
// Prisma schema additions
model DiagnosticJob {
  // ... existing fields
  odxPath         String?      // Path to ODX directory
  odxGenerated    Boolean      @default(false)
  odxMetadata     Json?        // Quick access metadata
}

model ECUConfiguration {
  id              String       @id @default(cuid())
  jobId           String
  ecuName         String
  sourceAddress   String       // From trace log
  targetAddress   String       // From trace log
  odxFileName     String?      // Reference to ODX file
  job             DiagnosticJob @relation(fields: [jobId], references: [id])
}
```

## 3. Jifeline Trace Log Parser

### 3.1 Parser Implementation
```typescript
// src/lib/trace-parser/jifeline-parser.ts
interface TraceEntry {
  timestamp: string
  source: string      // ECU source address
  target: string      // ECU target address
  service: string     // UDS service (e.g., "0x22")
  data: string        // Hex data payload
  response: string    // Response type (positive/negative)
}

class JifelineParser {
  parseLog(content: string): ParsedSession {
    // Extract DOIP communications
    // Pattern: "YYYY-MM-DD HH:MM:SS.mmm | 0xSSSS -> 0xTTTT | DATA"
    // Identify UDS services (0x10, 0x22, 0x27, 0x2E, 0x31, etc.)
    // Group by ECU pairs
    // Extract DIDs, DTCs, routines
  }

  extractECUs(entries: TraceEntry[]): ECUInfo[] {
    // Identify unique ECU addresses
    // Map common addresses to ECU names
    // Group communications by ECU
  }

  extractDIDs(entries: TraceEntry[]): DataIdentifier[] {
    // Find all 0x22 (ReadDataByIdentifier) requests
    // Extract DID numbers and responses
    // Parse response data lengths
  }
}
```

### 3.2 UDS Service Mapping
```typescript
const UDS_SERVICES = {
  '0x10': 'DiagnosticSessionControl',
  '0x11': 'ECUReset',
  '0x14': 'ClearDiagnosticInformation',
  '0x19': 'ReadDTCInformation',
  '0x22': 'ReadDataByIdentifier',
  '0x27': 'SecurityAccess',
  '0x28': 'CommunicationControl',
  '0x2E': 'WriteDataByIdentifier',
  '0x2F': 'InputOutputControlByIdentifier',
  '0x31': 'RoutineControl',
  '0x3E': 'TesterPresent',
  '0x62': 'PositiveResponse_ReadDataByIdentifier',
  '0x6E': 'PositiveResponse_WriteDataByIdentifier',
  '0x7F': 'NegativeResponse'
}
```

## 4. ODX Generator

### 4.1 ODX XML Generation
```typescript
// src/lib/odx-generator/odx-builder.ts
class ODXBuilder {
  generateVehicleFile(vehicleInfo: VehicleData): string {
    // Create ODX-V XML structure
    // Define ECU logical links
    // Set up communication parameters
  }

  generateECUDiagnosticLayer(ecu: ECUData): string {
    // Create ODX-D XML structure
    // Generate DIAG-SERVICE entries
    // Create REQUEST/RESPONSE structures
    // Define DATA-OBJECT-PROPS
  }

  generateDataIdentifier(did: DIDInfo): XMLElement {
    // Create DID structure with:
    // - REQUEST (0x22 + DID bytes)
    // - POS-RESPONSE (0x62 + DID + data)
    // - NEG-RESPONSE references
    // - DATA-OBJECT-PROP definitions
  }

  generateDTC(dtc: DTCInfo): XMLElement {
    // Create DTC definition
    // Include trouble code and description
    // Map to DTC sections
  }
}
```

### 4.2 ODX Structure Templates
```xml
<!-- Template for Data Identifier -->
<DIAG-SERVICE ID="ID_DIAG_SER_RD_{DID_NAME}" SEMANTIC="DATA">
  <SHORT-NAME>Read_{DID_NAME}</SHORT-NAME>
  <LONG-NAME>Read {DID_Description}</LONG-NAME>
  <REQUEST-REF ID-REF="ID_RQ_{DID_NAME}"/>
  <POS-RESPONSE-REFS>
    <POS-RESPONSE-REF ID-REF="ID_PR_{DID_NAME}"/>
  </POS-RESPONSE-REFS>
  <NEG-RESPONSE-REFS>
    <NEG-RESPONSE-REF ID-REF="ID_NR_Generic"/>
  </NEG-RESPONSE-REFS>
</DIAG-SERVICE>
```

## 5. ODX Editor Implementation

### 5.1 Editor UI Components
```typescript
// src/app/odx-editor/[jobId]/page.tsx
interface ODXEditorProps {
  jobId: string
  odxFiles: ODXFile[]
}

const ODXEditor = () => {
  // Tree view for ODX structure
  // DID editor panel
  // Conversion formula editor
  // Real-time XML preview
  // Save/validate functionality
}
```

### 5.2 Editor Features
- **DID Management**
  - Edit short names and long names
  - Set data types (A_UINT8, A_UINT16, A_UNICODE2STRING, etc.)
  - Define bit positions and lengths

- **Data Conversion**
  - Linear conversions: `y = ax + b`
  - Text mappings: enum values to strings
  - Bit field definitions
  - Unit specifications (km/h, °C, V, etc.)

- **Validation**
  - XML schema validation against odx.xsd
  - Reference integrity checking
  - Data type compatibility

### 5.3 API Endpoints
```typescript
// src/app/api/odx/[jobId]/route.ts
// GET: Retrieve ODX files for job
// PUT: Update ODX file content
// POST: Validate ODX against schema

// src/app/api/odx/[jobId]/did/route.ts
// GET: List all DIDs in ODX
// PATCH: Update DID properties
// POST: Add conversion formula
```

## 6. Session Visualization

### 6.1 Session Details View
```typescript
// src/app/jobs/[jobId]/session/page.tsx
interface SessionView {
  timeline: TimelineComponent      // Chronological view
  ecuGrid: ECUGridComponent        // ECU communication matrix
  dataPanel: DataPanelComponent    // Decoded data values
  dtcList: DTCListComponent        // Active DTCs
  routineLog: RoutineComponent     // Executed routines
}
```

### 6.2 Data Conversion Display
```typescript
class DataConverter {
  convertDIDValue(
    rawHex: string,
    dataObjectProp: DataObjectProp
  ): ConvertedValue {
    // Apply ODX conversion formulas
    // Format based on data type
    // Add units and descriptions
    return {
      raw: rawHex,
      converted: calculatedValue,
      unit: dataObjectProp.unit,
      description: dataObjectProp.longName
    }
  }
}
```

### 6.3 Visualization Components
- **Timeline View**: Sequential diagnostic operations
- **ECU Communication Map**: Visual network of ECU interactions
- **Data Grid**: Tabular view of all DIDs with converted values
- **DTC Status**: Current and historical DTCs
- **Routine Results**: Pass/fail status of diagnostic routines

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. ✅ Study ODX specification and examples
2. ✅ Analyze Jifeline trace format
3. Create file storage structure
4. Update Prisma schema for ODX references
5. Implement basic Jifeline parser

### Phase 2: ODX Generation (Week 2-3)
1. Build ODX XML templates
2. Implement UDS service extraction
3. Create ODX generator for DIDs
4. Generate ECU diagnostic layers
5. Package as PDX files

### Phase 3: ODX Editor (Week 3-4)
1. Create editor UI framework
2. Implement DID property editing
3. Add conversion formula support
4. Build validation system
5. Create save/load functionality

### Phase 4: Visualization (Week 4-5)
1. Build session timeline component
2. Implement data conversion display
3. Create ECU communication visualizer
4. Add DTC and routine views
5. Integrate with job details page

### Phase 5: Polish & Testing (Week 5-6)
1. Add error handling
2. Implement caching
3. Performance optimization
4. User testing
5. Documentation

## 8. Technology Choices

### XML Processing
- **xml2js**: For parsing ODX files
- **xmlbuilder2**: For generating ODX XML
- **libxmljs2**: For XSD validation

### File Management
- **fs-extra**: Enhanced file operations
- **archiver**: Creating PDX (ZIP) files
- **multer**: File upload handling

### UI Components
- **Monaco Editor**: XML editing with syntax highlighting
- **React Flow**: ECU network visualization
- **Recharts**: Data visualization
- **React Tree View**: ODX structure navigation

## 9. API Design

### Job Processing Flow
```typescript
// POST /api/jobs/{jobId}/process-trace
async function processTraceLog(jobId: string) {
  // 1. Parse Jifeline log
  const traces = await parseJifelineLog(logPath)

  // 2. Extract ECUs and services
  const ecus = extractECUs(traces)
  const services = extractServices(traces)

  // 3. Generate ODX files
  const odxFiles = await generateODX(ecus, services)

  // 4. Save to file system
  await saveODXFiles(jobId, odxFiles)

  // 5. Update job status
  await updateJobStatus(jobId, 'ODX_GENERATED')
}
```

## 10. Error Handling & Validation

### Validation Rules
- ODX files must conform to odx.xsd schema
- DID numbers must be unique within ECU
- Data lengths must match response sizes
- Conversion formulas must be mathematically valid

### Error Recovery
- Backup ODX files before editing
- Transaction-based file operations
- Validation before saving
- Rollback capability

## 11. Performance Considerations

### Optimization Strategies
- Cache parsed ODX in memory
- Lazy load large trace files
- Paginate session data
- Index DIDs for quick search
- Compress stored ODX files

### Scalability
- File-based storage scales horizontally
- Async processing for large traces
- CDN for static ODX templates
- Background jobs for ODX generation

## 12. Security Considerations

### Access Control
- Job-level permissions
- Read-only ODX templates
- Sanitize XML input
- Validate file uploads

### Data Protection
- Encrypt sensitive vehicle data
- Audit log for ODX modifications
- Backup critical ODX files
- Version control for changes

## Conclusion

This architecture provides a robust, scalable solution for ODX-based diagnostic management. By using file-based storage for ODX files and keeping only references in the database, we maintain flexibility while avoiding database bloat. The modular design allows for incremental implementation and future enhancements.

The system will transform OptiDiagFlow into a comprehensive diagnostic platform capable of:
- Automatic ODX generation from trace logs
- Professional ODX editing capabilities
- Rich visualization of diagnostic sessions
- Accurate data conversion and interpretation

Next steps:
1. Review and approve architecture
2. Set up file storage structure
3. Begin Phase 1 implementation
4. Create initial Jifeline parser