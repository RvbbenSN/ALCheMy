// ALCheMy Native n8n JavaScript Characterization Parser
// Location: src/characterization_parser_n8n.js
// Uses Node built-in 'fs' module & base64 scanning to extract XML & raw curves flawlessly.

const fs = require('fs');
const path = require('path');

function getNodeBinary(nodeName) {
  try {
    const nodeRef = $(nodeName);
    if (nodeRef && typeof nodeRef.first === 'function') {
      const firstItem = nodeRef.first();
      return firstItem ? firstItem.binary : null;
    }
  } catch (e) {}
  return null;
}

function getNodeItem(nodeName) {
  try {
    const nodeRef = $(nodeName);
    if (nodeRef && typeof nodeRef.first === 'function') {
      const firstItem = nodeRef.first();
      return firstItem ? firstItem.json : null;
    }
  } catch (e) {}
  return null;
}

for (const item of $input.all()) {
  const sanitizeJson = getNodeItem("Sanitize Input");
  const pathJson = getNodeItem("Extract Technique from Path");
  const hashJson = getNodeItem("Calculate MD5 File Hash");
  const sourceJson = sanitizeJson || pathJson || item.json;

  const sampleCode = item.json?.sample_code || sourceJson?.sample_code || "";
  const technique = (item.json?.technique || sourceJson?.technique || "PXRD").toUpperCase();
  const researcherName = item.json?.researcher_name || sourceJson?.researcher_name || "";
  const researcherEmail = item.json?.researcher_email || sourceJson?.researcher_email || "";
  const measurementTag = item.json?.measurement_tag || sourceJson?.measurement_tag || "as_synthesized";
  const instrumentName = item.json?.instrument_name || sourceJson?.instrument_name || "";
  const fileName = item.json?.fileName || item.json?.file_name || sourceJson?.fileName || sourceJson?.file_name || "24DRX0180-RS1883_CoPy.xrdml";
  const rawFilePath = item.json?.raw_file_path || sourceJson?.raw_file_path || ("data/sample_datalake_demo/" + technique + "/" + fileName);
  
  const fileHash = hashJson?.file_hash || item.json?.file_hash || sourceJson?.file_hash || "";

  let operatorName = item.json?.operator_name || sourceJson?.operator_name || "";
  
  let headerMetadata = {
    sample_name_raw: fileName,
    researcher_name: researcherName,
    researcher_email: researcherEmail,
    operator_name: operatorName,
    technique: technique,
    instrument: instrumentName || "PANalytical EMPYREAN"
  };
  
  let rawData = {
    x_label: "2theta_deg",
    y_label: "intensity_counts",
    x: [],
    y: []
  };

  let fileText = "";
  
  // Method 1: Try reading file directly from disk using Node.js 'fs' (Bulletproof & Instant)
  try {
    const candidatePaths = [
      rawFilePath,
      path.join('/home/node', rawFilePath),
      path.join(process.cwd(), rawFilePath),
      path.join('c:/Users/rubbe/Documents/ALCheMy', rawFilePath),
      path.join('/home/node/data/sample_datalake_demo', technique, fileName)
    ];
    
    for (const p of candidatePaths) {
      if (p && fs.existsSync(p)) {
        fileText = fs.readFileSync(p, 'utf-8');
        if (fileText) break;
      }
    }
  } catch (e) {}

  // Method 2: Fallback to binary base64 scanning if file on disk was not found
  if (!fileText) {
    let binaryObj = null;
    if (item.binary) {
      for (const k of Object.keys(item.binary)) {
        if (item.binary[k] && item.binary[k].data) {
          binaryObj = item.binary[k];
          break;
        }
      }
    }
    
    if (!binaryObj) {
      const upstreamNodes = ["Sanitize Input", "Extract Technique from Path", "Unzip File", "Lab Upload Portal", "Webhook"];
      for (const nodeName of upstreamNodes) {
        const bDict = getNodeBinary(nodeName);
        if (bDict) {
          for (const k of Object.keys(bDict)) {
            if (bDict[k] && bDict[k].data) {
              binaryObj = bDict[k];
              break;
            }
          }
        }
        if (binaryObj) break;
      }
    }

    if (binaryObj && binaryObj.data) {
      try {
        fileText = Buffer.from(binaryObj.data, 'base64').toString('utf-8');
      } catch(e) {}
    }
  }

  // Extract XML metadata and numerical curves if file text was retrieved
  if (fileText) {
    try {
      if (technique.includes('PXRD') || fileName.toLowerCase().endsWith('.xrdml') || fileText.includes('xrdMeasurement')) {
        // Extract real XML tags from PANalytical .xrdml
        const sampleNameMatch = fileText.match(/<sample[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/i);
        const sampleIdMatch = fileText.match(/<sample[^>]*>[\s\S]*?<id>([\s\S]*?)<\/id>/i);
        
        // Extract operator_name STRICTLY from <preparedBy> (Javier) or <author><name> (difraccion)
        const prepByMatch = fileText.match(/<preparedBy[^>]*>([\s\S]*?)<\/preparedBy>/i) || fileText.match(/preparedBy>([^<]+)</i);
        const authorMatch = fileText.match(/<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i) || fileText.match(/author>[\s\S]*?name>([^<]+)</i);
        
        const extractedOperator = (prepByMatch ? prepByMatch[1].trim() : "") || (authorMatch ? authorMatch[1].trim() : "");
        if (extractedOperator) {
          operatorName = extractedOperator;
        }
        
        const instrMatch = fileText.match(/<diffractometerSystem[^>]*>([\s\S]*?)<\/diffractometerSystem>/i);
        const anodeMatch = fileText.match(/<anodeMaterial[^>]*>([\s\S]*?)<\/anodeMaterial>/i);
        const kalpha1Match = fileText.match(/<kAlpha1[^>]*>([\d.]+)/i);
        const kalpha2Match = fileText.match(/<kAlpha2[^>]*>([\d.]+)/i);
        const tensionMatch = fileText.match(/<tension[^>]*>([\d.]+)/i);
        const currentMatch = fileText.match(/<current[^>]*>([\d.]+)/i);
        const detectorMatch = fileText.match(/<detector[^>]*name="([^"]+)"/i);
        
        const countsMatch = fileText.match(/<counts[^>]*>([\s\S]*?)<\/counts>/i) || fileText.match(/<intensities[^>]*>([\s\S]*?)<\/intensities>/i);
        const startMatch = fileText.match(/<startPosition>([\d.]+)/i);
        const endMatch = fileText.match(/<endPosition>([\d.]+)/i);
        
        headerMetadata.sample_name_raw = sampleNameMatch ? sampleNameMatch[1].trim() : (sampleIdMatch ? sampleIdMatch[1].trim() : fileName);
        headerMetadata.operator_name = operatorName;
        headerMetadata.instrument = instrMatch ? instrMatch[1].trim() : (instrumentName || "PANalytical EMPYREAN");
        headerMetadata.anode_material = anodeMatch ? anodeMatch[1].trim() : "Cu";
        headerMetadata.wavelength_kalpha1_angstrom = kalpha1Match ? parseFloat(kalpha1Match[1]) : 1.540598;
        headerMetadata.wavelength_kalpha2_angstrom = kalpha2Match ? parseFloat(kalpha2Match[1]) : 1.544426;
        headerMetadata.voltage_kv = tensionMatch ? parseFloat(tensionMatch[1]) : 45.0;
        headerMetadata.current_ma = currentMatch ? parseFloat(currentMatch[1]) : 40.0;
        headerMetadata.detector = detectorMatch ? detectorMatch[1] : "PIXcel3D";
        
        const start2t = startMatch ? parseFloat(startMatch[1]) : 3.006565;
        const end2t = endMatch ? parseFloat(endMatch[1]) : 49.999846;
        
        if (countsMatch) {
          const yCounts = countsMatch[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
          const countLen = yCounts.length;
          const step = (end2t > start2t && countLen > 1) ? Number(((end2t - start2t) / (countLen - 1)).toFixed(4)) : 0.0131;
          const x2t = Array.from({ length: countLen }, (_, i) => Number((start2t + i * step).toFixed(4)));
          
          headerMetadata.scan_start_2theta_deg = Number(start2t.toFixed(4));
          headerMetadata.scan_end_2theta_deg = Number(end2t.toFixed(4));
          headerMetadata.step_size_2theta_deg = step;
          headerMetadata.num_data_points = countLen;
          
          rawData = {
            x_label: "2theta_deg",
            y_label: "intensity_counts",
            x: x2t,
            y: yCounts
          };
        }
      } else if (technique.includes('TGA') || fileName.toLowerCase().endsWith('.txt')) {
        const lines = fileText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const dataRows = lines.filter(l => /^[\d.\s-]+$/.test(l));
        
        const temps = [], weights = [];
        dataRows.forEach(row => {
          const parts = row.split(/\s+/).map(Number);
          if (parts.length >= 3) {
            temps.push(Number(parts[1].toFixed(2)));
            weights.push(Number(parts[2].toFixed(4)));
          }
        });
        
        headerMetadata.num_data_points = temps.length;
        rawData = {
          x_label: "temperature_c",
          y_label: "weight_mg",
          x: temps,
          y: weights
        };
      } else if (technique.includes('FTIR') || fileName.toLowerCase().endsWith('.csv')) {
        const lines = fileText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const wavenumbers = [], trans = [];
        
        lines.forEach(l => {
          const parts = l.split(/[,;]/).map(p => parseFloat(p.replace(',', '.')));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            wavenumbers.push(Number(parts[0].toFixed(2)));
            trans.push(Number(parts[1].toFixed(2)));
          }
        });
        
        headerMetadata.spectral_range_cm_1 = [
          wavenumbers.length > 0 ? Math.min(...wavenumbers) : 400.0,
          wavenumbers.length > 0 ? Math.max(...wavenumbers) : 4000.0
        ];
        headerMetadata.num_data_points = wavenumbers.length;
        
        rawData = {
          x_label: "wavenumber_cm-1",
          y_label: "transmittance_percent",
          x: wavenumbers,
          y: trans
        };
      }
    } catch (e) {
      console.log('Error parsing binary file: ' + e.message);
    }
  }
  
  // 3. Construct dynamic standard payload matching PostgreSQL schema & spec
  item.json.sample_code = sampleCode;
  item.json.researcher_name = researcherName;
  item.json.researcher_email = researcherEmail;
  item.json.technique = technique;
  item.json.operator_name = operatorName || headerMetadata.operator_name;
  item.json.measurement_tag = measurementTag;
  item.json.instrument_name = headerMetadata.instrument || instrumentName;
  item.json.file_name = fileName;
  item.json.raw_file_path = rawFilePath;
  item.json.data_json = {
    header_metadata: headerMetadata,
    raw_data: rawData
  };
  item.json.file_hash = fileHash;
}

return $input.all();
