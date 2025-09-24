/**
 * Analyzes trace data to discover DID definitions
 */
export function discoverDIDs(messages: TraceMessage[]): DiscoveryPattern[] {
  const didMap = new Map<string, {
    count: number;
    dataLengths: Set<number>;
    sampleValues: string[];
    ecuAddresses: Set<string>;
  }>();

  // Common DIDs
  const knownDIDs: Record<string, string> = {
    'F190': 'VIN (Vehicle Identification Number)',
    'F187': 'ECU Software Number',
    'F188': 'ECU Software Version',
    'F189': 'ECU Software Date',
    'F18A': 'System Supplier Identifier',
    'F18B': 'ECU Manufacturing Date',
    'F18C': 'System Supplier ECU Software Number',
    'F18E': 'ECU Serial Number',
    'F191': 'Vehicle Manufacturer Hardware Number',
    'F192': 'Vehicle Manufacturer Software Number',
    'F193': 'Vehicle Manufacturer Software Version',
    'F194': 'System Supplier Hardware Number',
    'F195': 'System Supplier Hardware Version',
    'F197': 'System Name',
    'F199': 'Programming Date',
    'F19D': 'ODX File Version',
    'F19E': 'Entity',
  };

  messages.forEach((msg) => {
    // Look for Read Data By Identifier (service 22) in the data field
    if (msg.data && msg.data.length >= 8) {
      // Parse the data to extract service and DID information
      const cleanData = msg.data.replace(/^0x/i, '').toUpperCase();
      let serviceCode = '';
      let didData = '';

      // Handle ISO-TP framing for non-DoIP protocols
      if (msg.protocol !== 'DoIP') {
        const firstByte = parseInt(cleanData.substring(0, 2), 16);
        if (firstByte >= 0x01 && firstByte <= 0x07) {
          // ISO-TP single frame - service starts after length byte
          serviceCode = cleanData.substring(2, 4);
          didData = cleanData.substring(4);
        } else {
          // No ISO-TP framing
          serviceCode = cleanData.substring(0, 2);
          didData = cleanData.substring(2);
        }
      } else {
        // DoIP - no ISO-TP framing
        serviceCode = cleanData.substring(0, 2);
        didData = cleanData.substring(2);
      }

      // Check if this is a Read Data By Identifier service (0x22)
      if (serviceCode === '22' && didData.length >= 4) {
        const did = didData.substring(0, 4).toUpperCase();

        if (did.length === 4) {
          if (!didMap.has(did)) {
            didMap.set(did, {
              count: 0,
              dataLengths: new Set(),
              sampleValues: [],
              ecuAddresses: new Set(),
            });
          }

          const didInfo = didMap.get(did)!;
          didInfo.count++;
          didInfo.ecuAddresses.add(msg.target);

          // Analyze response data
          if (msg.response) {
            // Assume response format: 62XXXX[DATA]
            if (msg.response.startsWith('62')) {
              const dataStart = 6; // After 62XXXX
              const data = msg.response.substring(dataStart);
              const dataLength = data.length / 2; // Convert hex length to bytes

              didInfo.dataLengths.add(dataLength);

              // Store sample values (limit to 5)
              if (didInfo.sampleValues.length < 5) {
                didInfo.sampleValues.push(data);
              }
            }
          }
        }
      }
    }
  });

  const discoveries: DiscoveryPattern[] = [];

  didMap.forEach((info, did) => {
    const knownName = knownDIDs[did];
    const confidence = knownName ? 0.95 : 0.4 + Math.min(0.5, info.count / 20);

    // Infer data type from sample values
    let inferredType = 'HEX';
    if (info.sampleValues.length > 0) {
      // Check if all samples are ASCII-printable
      const isAscii = info.sampleValues.every(val => {
        for (let i = 0; i < val.length; i += 2) {
          const byte = parseInt(val.substr(i, 2), 16);
          if (byte < 0x20 || byte > 0x7E) return false;
        }
        return true;
      });
      if (isAscii) inferredType = 'ASCII';
    }

    discoveries.push({
      type: DefinitionType.DID,
      identifier: did,
      name: knownName || `DID_${did}`,
      confidence,
      evidence: {
        messageCount: info.count,
        dataLengths: Array.from(info.dataLengths),
        sampleValues: info.sampleValues.slice(0, 3),
        ecuAddresses: Array.from(info.ecuAddresses),
        inferredType,
        isKnown: !!knownName,
      },
      occurrences: info.count,
    });
  });

  return discoveries;
}