/**
 * Neuro Change Monitor - Charts
 * Chart.js configuration for live pupil and symmetry graphs
 */

class NeuroCharts {
  constructor() {
    this.maxDataPoints = 60; // Show last 60 seconds
    this.charts = {};
    this.data = {
      timestamps: [],
      pupilLeft: [],
      pupilRight: [],
      symmetry: [],
      trendPupilLeft: [],
      trendPupilRight: [],
      trendSymmetry: []
    };

    this.initCharts();
  }

  initCharts() {
    // Common chart options
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0 // Disable animation for real-time updates
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#e8e8f0',
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(18, 18, 26, 0.95)',
          titleColor: '#e8e8f0',
          bodyColor: '#9898a8',
          borderColor: '#4a9eff',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          type: 'linear',
          display: true,
          title: {
            display: true,
            text: 'Time (seconds ago)',
            color: '#9898a8'
          },
          ticks: {
            color: '#9898a8',
            callback: function(value) {
              return Math.abs(value);
            }
          },
          grid: {
            color: 'rgba(152, 152, 168, 0.1)'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            color: '#9898a8'
          },
          ticks: {
            color: '#9898a8'
          },
          grid: {
            color: 'rgba(152, 152, 168, 0.1)'
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };

    // Pupil Size Chart
    const pupilCtx = document.getElementById('pupilChart').getContext('2d');
    this.charts.pupil = new Chart(pupilCtx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Left Pupil (raw)',
            data: [],
            borderColor: '#4a9eff',
            backgroundColor: 'rgba(74, 158, 255, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1
          },
          {
            label: 'Left Pupil (trend)',
            data: [],
            borderColor: '#4a9eff',
            backgroundColor: 'transparent',
            borderWidth: 3,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.3
          },
          {
            label: 'Right Pupil (raw)',
            data: [],
            borderColor: '#4aff9e',
            backgroundColor: 'rgba(74, 255, 158, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1
          },
          {
            label: 'Right Pupil (trend)',
            data: [],
            borderColor: '#4aff9e',
            backgroundColor: 'transparent',
            borderWidth: 3,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.3
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            title: {
              ...commonOptions.scales.y.title,
              text: 'Pupil Size (mm)'
            },
            suggestedMin: 2,
            suggestedMax: 8
          }
        }
      }
    });

    // Face Symmetry Chart
    const symmetryCtx = document.getElementById('symmetryChart').getContext('2d');
    this.charts.symmetry = new Chart(symmetryCtx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Symmetry Score (raw)',
            data: [],
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1
          },
          {
            label: 'Symmetry Score (trend)',
            data: [],
            borderColor: '#ff6b6b',
            backgroundColor: 'transparent',
            borderWidth: 3,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.3
          },
          {
            label: 'Advisory Threshold (15%)',
            data: [],
            borderColor: 'rgba(255, 193, 7, 0.5)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [10, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Critical Threshold (30%)',
            data: [],
            borderColor: 'rgba(244, 67, 54, 0.5)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [10, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            title: {
              ...commonOptions.scales.y.title,
              text: 'Symmetry Score (0-1)'
            },
            suggestedMin: 0,
            suggestedMax: 1
          }
        }
      }
    });

    console.log('Charts initialized');
  }

  updateCharts(newData) {
    const now = Date.now();
    const timeOffset = (now - (this.data.timestamps[0] || now)) / 1000; // seconds

    // Add new data point
    this.data.timestamps.push(now);
    this.data.pupilLeft.push(newData.pupilLeft);
    this.data.pupilRight.push(newData.pupilRight);
    this.data.symmetry.push(newData.symmetry);
    this.data.trendPupilLeft.push(newData.trendPupilLeft);
    this.data.trendPupilRight.push(newData.trendPupilRight);
    this.data.trendSymmetry.push(newData.trendSymmetry);

    // Trim old data points
    if (this.data.timestamps.length > this.maxDataPoints) {
      this.data.timestamps.shift();
      this.data.pupilLeft.shift();
      this.data.pupilRight.shift();
      this.data.symmetry.shift();
      this.data.trendPupilLeft.shift();
      this.data.trendPupilRight.shift();
      this.data.trendSymmetry.shift();
    }

    // Calculate relative timestamps (seconds ago)
    const relativeTimestamps = this.data.timestamps.map(ts => {
      return -((now - ts) / 1000); // Negative so it goes left to right
    });

    // Update pupil chart
    this.charts.pupil.data.datasets[0].data = this.createDataPoints(relativeTimestamps, this.data.pupilLeft);
    this.charts.pupil.data.datasets[1].data = this.createDataPoints(relativeTimestamps, this.data.trendPupilLeft);
    this.charts.pupil.data.datasets[2].data = this.createDataPoints(relativeTimestamps, this.data.pupilRight);
    this.charts.pupil.data.datasets[3].data = this.createDataPoints(relativeTimestamps, this.data.trendPupilRight);
    this.charts.pupil.update('none'); // 'none' mode for performance

    // Calculate baseline and thresholds for symmetry
    const baseline = this.calculateBaseline(this.data.symmetry);
    const advisoryThreshold = baseline * 0.85; // 15% deviation
    const criticalThreshold = baseline * 0.70; // 30% deviation

    // Update symmetry chart
    this.charts.symmetry.data.datasets[0].data = this.createDataPoints(relativeTimestamps, this.data.symmetry);
    this.charts.symmetry.data.datasets[1].data = this.createDataPoints(relativeTimestamps, this.data.trendSymmetry);

    // Threshold lines
    const thresholdLine = relativeTimestamps.map(() => advisoryThreshold);
    this.charts.symmetry.data.datasets[2].data = this.createDataPoints(relativeTimestamps, thresholdLine);

    const criticalLine = relativeTimestamps.map(() => criticalThreshold);
    this.charts.symmetry.data.datasets[3].data = this.createDataPoints(relativeTimestamps, criticalLine);

    this.charts.symmetry.update('none');
  }

  createDataPoints(x, y) {
    return x.map((xVal, i) => ({
      x: xVal,
      y: y[i]
    }));
  }

  calculateBaseline(data) {
    // Use first 10 data points for baseline, or all if less
    const baselineData = data.slice(0, Math.min(10, data.length));
    if (baselineData.length === 0) return 1;

    const sum = baselineData.reduce((a, b) => a + b, 0);
    return sum / baselineData.length;
  }

  clearCharts() {
    this.data = {
      timestamps: [],
      pupilLeft: [],
      pupilRight: [],
      symmetry: [],
      trendPupilLeft: [],
      trendPupilRight: [],
      trendSymmetry: []
    };

    this.charts.pupil.data.datasets.forEach(dataset => dataset.data = []);
    this.charts.symmetry.data.datasets.forEach(dataset => dataset.data = []);

    this.charts.pupil.update();
    this.charts.symmetry.update();

    console.log('Charts cleared');
  }
}

// Expose to global scope
window.NeuroCharts = NeuroCharts;
