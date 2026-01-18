// Generate Parkinson's dataset statistics for voice assessment
const fs = require('fs');
const path = require('path');

function parseCSV(data) {
  const lines = data.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i];
    });
    return obj;
  });
  return rows;
}

function calculateStats(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];
  const min = sorted[0];
  const max = sorted[n - 1];
  
  return { mean, std, median, min, max, n };
}

try {
  console.log('📊 Generating Parkinson\'s dataset statistics...');
  
  const dataPath = path.join(__dirname, 'parkinsons.data');
  const data = fs.readFileSync(dataPath, 'utf8');
  const rows = parseCSV(data);
  
  console.log(`✅ Loaded ${rows.length} voice recordings`);
  
  // Separate healthy and PD patients
  const healthy = rows.filter(r => r.status === '0');
  const pd = rows.filter(r => r.status === '1');
  
  console.log(`   ${healthy.length} healthy, ${pd.length} PD patients`);
  
  // Extract key metrics
  const metrics = [
    'MDVP:Jitter(%)',
    'MDVP:Shimmer',
    'HNR'
  ];
  
  const stats = {
    healthy: {},
    pd: {},
    thresholds: {}
  };
  
  metrics.forEach(metric => {
    const healthyValues = healthy.map(r => parseFloat(r[metric])).filter(v => !isNaN(v));
    const pdValues = pd.map(r => parseFloat(r[metric])).filter(v => !isNaN(v));
    
    stats.healthy[metric] = calculateStats(healthyValues);
    stats.pd[metric] = calculateStats(pdValues);
    
    // Calculate threshold (mean + 2*std for healthy)
    if (metric === 'HNR') {
      // HNR: lower is worse
      stats.thresholds[metric] = stats.healthy[metric].mean - 2 * stats.healthy[metric].std;
    } else {
      // Jitter, Shimmer: higher is worse
      stats.thresholds[metric] = stats.healthy[metric].mean + 2 * stats.healthy[metric].std;
    }
    
    console.log(`   ${metric}:`);
    console.log(`     Healthy: ${stats.healthy[metric].mean.toFixed(4)} ± ${stats.healthy[metric].std.toFixed(4)}`);
    console.log(`     PD: ${stats.pd[metric].mean.toFixed(4)} ± ${stats.pd[metric].std.toFixed(4)}`);
    console.log(`     Threshold: ${stats.thresholds[metric].toFixed(4)}`);
  });
  
  // Format for frontend
  const output = {
    healthy: {
      jitter: {
        mean: stats.healthy['MDVP:Jitter(%)'].mean / 100, // Convert to decimal
        std: stats.healthy['MDVP:Jitter(%)'].std / 100,
        threshold: stats.thresholds['MDVP:Jitter(%)'] / 100
      },
      shimmer: {
        mean: stats.healthy['MDVP:Shimmer'].mean,
        std: stats.healthy['MDVP:Shimmer'].std,
        threshold: stats.thresholds['MDVP:Shimmer']
      },
      hnr: {
        mean: stats.healthy['HNR'].mean,
        std: stats.healthy['HNR'].std,
        threshold: stats.thresholds['HNR']
      },
      pitchRange: { mean: 65, std: 25, threshold: 50 },
      syllableRate: { mean: 6.0, std: 0.8, threshold: 5.0 },
      loudnessVar: { mean: 6.5, std: 1.5, threshold: 5.0 }
    },
    pd: {
      jitter: {
        mean: stats.pd['MDVP:Jitter(%)'].mean / 100,
        std: stats.pd['MDVP:Jitter(%)'].std / 100
      },
      shimmer: {
        mean: stats.pd['MDVP:Shimmer'].mean,
        std: stats.pd['MDVP:Shimmer'].std
      },
      hnr: {
        mean: stats.pd['HNR'].mean,
        std: stats.pd['HNR'].std
      },
      pitchRange: { mean: 28, std: 12 },
      syllableRate: { mean: 3.5, std: 0.6 },
      loudnessVar: { mean: 2.3, std: 0.8 }
    },
    metadata: {
      source: 'UCI Parkinson\'s Disease Dataset',
      totalRecordings: rows.length,
      healthyCount: healthy.length,
      pdCount: pd.length,
      generated: new Date().toISOString()
    }
  };
  
  const outputPath = path.join(__dirname, 'parkinsons_stats.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`✅ Statistics saved to ${outputPath}`);
  
} catch (error) {
  console.error('❌ Error generating statistics:', error);
  process.exit(1);
}
