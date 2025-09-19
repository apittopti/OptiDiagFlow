# ODX Structure Implementation Guide for OptiDiagFlow

## ODX Hierarchy per ISO 22901

The ODX standard defines a clear hierarchical structure for organizing diagnostic data:

```
OEM (Organization)
├── Platform/Model (Vehicle Architecture)
│   ├── Base ODX Layer (Platform-wide definitions)
│   │   ├── Base Variants (Common ECU configurations)
│   │   ├── Protocol Stack (DoIP, CAN, etc.)
│   │   ├── Functional Groups
│   │   └── Shared DIDs/Services
│   │
│   └── Model Years (Specific implementations)
│       ├── ECU Variants (Override/extend base)
│       ├── Model-specific DTCs
│       ├── Model-specific Services
│       └── Vehicle Configuration
```

## Current Implementation Structure

### 1. OEM Level
- **Purpose**: Top-level organization (e.g., Volvo, Polestar, Land Rover)
- **Contains**:
  - Company-wide diagnostic standards
  - Default protocol configurations
  - Common DTC formats

### 2. Platform/Model Level
- **Purpose**: Vehicle platform shared across multiple model years
- **Key Concept**: Many vehicles share platforms (e.g., Volvo XC90, XC60, V90 all use SPA platform)
- **Contains**:
  - **Base ODX Layer**: Platform-wide diagnostic definitions
  - **Base Variants**: Standard ECU configurations for the platform
  - **Protocol Stack**: Communication protocols used
  - **Functional Groups**: Logical grouping of ECUs

### 3. Model Year Level
- **Purpose**: Specific implementation for a production year
- **Contains**:
  - **ECU Variants**: Override or extend base platform definitions
  - **Model-specific configurations**
  - **Production changes and updates**

## Key ODX Concepts

### Base Variant vs ECU Variant
- **Base Variant**: Platform-level ECU definition (inherited by all model years)
- **ECU Variant**: Model year-specific override/extension of base variant

### Diagnostic Layers
- **Protocol Layer**: Communication protocol (DoIP, CAN, etc.)
- **Functional Layer**: Logical grouping of diagnostic services
- **Base Variant Layer**: ECU-specific diagnostic data
- **ECU Variant Layer**: Model year overrides

### Inheritance Model
```
Platform Base Variant (e.g., "SPA2_BCM_Base")
    ↓ inherits to
Model Year ECU Variant (e.g., "XC90_2024_BCM")
    ↓ can override
    - DTCs
    - DIDs
    - Services
    - Parameters
```

## Implementation in OptiDiagFlow

### Vehicle Creation Flow
1. **Select/Create OEM** (e.g., Volvo)
2. **Select/Create Model** (e.g., XC90)
   - Specify platform code (e.g., SPA2)
3. **Select/Create Model Year** (e.g., 2024)
4. **Associate Base ODX** (at platform level)
5. **Override with ECU Variants** (at model year level)

### Trace Upload Flow
1. **Select Vehicle**: OEM → Model → Model Year
2. **Parse Trace**: Extract diagnostic messages
3. **Match to ODX Structure**:
   - First check ECU Variants (model year specific)
   - Fall back to Base Variants (platform level)
   - Fall back to OEM defaults
4. **Build ODX Knowledge**:
   - New discoveries go to appropriate level
   - Platform-wide patterns → Base Variant
   - Model-specific → ECU Variant

### ODX Discovery Process
When discovering new diagnostic elements:

1. **Analyze Pattern Scope**:
   - Seen across multiple model years? → Base Variant (platform)
   - Specific to one model year? → ECU Variant
   - Common across all OEM vehicles? → OEM level

2. **Progressive Refinement**:
   ```
   Initial Discovery → Tentative placement
   Multiple confirmations → Move to appropriate level
   Pattern validation → Solidify in ODX structure
   ```

## Database Relationships

```sql
-- Proper relationships for ODX compliance
OEM
  ↓ has many
Model (with platform field)
  ↓ has many
ModelYear
  ↓ has many
Vehicle (VIN-specific instance)
  ↓ has many
DiagnosticJob (trace uploads)

-- ODX Layer relationships
Model (Platform)
  ↓ has one
DiagnosticLayer (Base ODX)
  ↓ has many
BaseVariant (Platform ECUs)

ModelYear
  ↓ has many
ECUVariant (extends BaseVariant)

-- Discovery relationships
DiagnosticJob
  ↓ discovers
DiscoveredECU
  ↓ maps to
BaseVariant or ECUVariant
```

## Best Practices

1. **Always start at platform level**: Base ODX should be associated with the Model/Platform, not individual vehicles
2. **Use inheritance**: ECU Variants should only contain differences from Base Variants
3. **Validate discoveries**: New discoveries should be validated across multiple vehicles before promoting to platform level
4. **Maintain traceability**: Keep track of which trace/job discovered each element
5. **Version control**: Track changes to ODX structures over time

## Example Scenario

**Volvo XC90 on SPA2 Platform**:
```
OEM: Volvo
├── Model: XC90 (Platform: SPA2)
│   ├── Base ODX Layer: SPA2_Diagnostic_Base
│   │   ├── Base Variant: SPA2_BCM (Body Control Module)
│   │   ├── Base Variant: SPA2_ECM (Engine Control Module)
│   │   └── Base Variant: SPA2_TCM (Transmission Control Module)
│   │
│   ├── Model Year: 2023
│   │   ├── ECU Variant: XC90_2023_BCM (adds specific DTCs)
│   │   └── Vehicle: VIN_YV1LFA2B4P1234567
│   │
│   └── Model Year: 2024
│       ├── ECU Variant: XC90_2024_BCM (different DID mapping)
│       └── Vehicle: VIN_YV1LFA2B5R1234568
```

When uploading a trace for the 2024 XC90:
1. System identifies vehicle as XC90 2024
2. Checks for XC90_2024_BCM variant first
3. Falls back to SPA2_BCM base if no override exists
4. New discoveries are evaluated:
   - If pattern matches 2023 vehicles too → update SPA2_BCM base
   - If unique to 2024 → add to XC90_2024_BCM variant