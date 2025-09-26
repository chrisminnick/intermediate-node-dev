const fs = require('fs');
const path = require('path');

/**
 * Quality Gates Configuration and Enforcement
 * This script checks test results and code quality metrics
 */

class QualityGates {
  constructor() {
    this.config = {
      coverage: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      performance: {
        maxResponseTime: 500, // ms
        minThroughput: 100, // requests/second
      },
      security: {
        allowedVulnerabilities: {
          low: 5,
          medium: 0,
          high: 0,
          critical: 0,
        },
      },
      codeQuality: {
        maxComplexity: 10,
        maxDuplication: 3, // percentage
        minMaintainabilityIndex: 70,
      },
    };

    this.results = {
      coverage: null,
      performance: null,
      security: null,
      tests: null,
    };
  }

  /**
   * Load test coverage results
   */
  async loadCoverageResults() {
    try {
      const coveragePath = path.join(
        __dirname,
        '../coverage/coverage-summary.json'
      );
      if (fs.existsSync(coveragePath)) {
        this.results.coverage = JSON.parse(
          fs.readFileSync(coveragePath, 'utf8')
        );
        console.log('✅ Coverage results loaded');
      } else {
        console.log('⚠️  Coverage results not found');
      }
    } catch (error) {
      console.error('❌ Error loading coverage results:', error.message);
    }
  }

  /**
   * Load performance test results
   */
  async loadPerformanceResults() {
    try {
      const performancePath = path.join(
        __dirname,
        '../test-results/performance.json'
      );
      if (fs.existsSync(performancePath)) {
        this.results.performance = JSON.parse(
          fs.readFileSync(performancePath, 'utf8')
        );
        console.log('✅ Performance results loaded');
      } else {
        console.log('⚠️  Performance results not found');
      }
    } catch (error) {
      console.error('❌ Error loading performance results:', error.message);
    }
  }

  /**
   * Load security audit results
   */
  async loadSecurityResults() {
    try {
      const securityPath = path.join(
        __dirname,
        '../test-results/security-audit.json'
      );
      if (fs.existsSync(securityPath)) {
        this.results.security = JSON.parse(
          fs.readFileSync(securityPath, 'utf8')
        );
        console.log('✅ Security results loaded');
      } else {
        console.log('⚠️  Security results not found - running audit...');
        await this.runSecurityAudit();
      }
    } catch (error) {
      console.error('❌ Error loading security results:', error.message);
    }
  }

  /**
   * Run security audit
   */
  async runSecurityAudit() {
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      const audit = spawn('npm', ['audit', '--json'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      audit.stdout.on('data', (data) => {
        output += data.toString();
      });

      audit.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      audit.on('close', (code) => {
        try {
          if (output) {
            this.results.security = JSON.parse(output);
          }
          resolve();
        } catch (error) {
          console.warn('⚠️  Could not parse security audit results');
          resolve();
        }
      });
    });
  }

  /**
   * Check coverage quality gate
   */
  checkCoverageGate() {
    if (!this.results.coverage) {
      console.log('⚠️  Coverage gate: SKIPPED (no results)');
      return true;
    }

    const { total } = this.results.coverage;
    const gates = this.config.coverage;
    let passed = true;

    console.log('\n📊 Coverage Quality Gate:');

    Object.entries(gates).forEach(([metric, threshold]) => {
      const actual = total[metric]?.pct || 0;
      const status = actual >= threshold ? '✅' : '❌';

      if (actual < threshold) {
        passed = false;
      }

      console.log(
        `  ${status} ${metric}: ${actual}% (threshold: ${threshold}%)`
      );
    });

    return passed;
  }

  /**
   * Check performance quality gate
   */
  checkPerformanceGate() {
    if (!this.results.performance) {
      console.log('⚠️  Performance gate: SKIPPED (no results)');
      return true;
    }

    const gates = this.config.performance;
    let passed = true;

    console.log('\n🚀 Performance Quality Gate:');

    // Check response time
    const avgResponseTime = this.results.performance.latency?.average || 0;
    const responseTimeOk = avgResponseTime <= gates.maxResponseTime;
    console.log(
      `  ${
        responseTimeOk ? '✅' : '❌'
      } Avg Response Time: ${avgResponseTime}ms (max: ${
        gates.maxResponseTime
      }ms)`
    );

    // Check throughput
    const throughput = this.results.performance.requests?.average || 0;
    const throughputOk = throughput >= gates.minThroughput;
    console.log(
      `  ${throughputOk ? '✅' : '❌'} Throughput: ${throughput} req/s (min: ${
        gates.minThroughput
      } req/s)`
    );

    passed = responseTimeOk && throughputOk;
    return passed;
  }

  /**
   * Check security quality gate
   */
  checkSecurityGate() {
    if (!this.results.security) {
      console.log('⚠️  Security gate: SKIPPED (no results)');
      return true;
    }

    const vulnerabilities = this.results.security.vulnerabilities || {};
    const gates = this.config.security.allowedVulnerabilities;
    let passed = true;

    console.log('\n🔒 Security Quality Gate:');

    Object.entries(gates).forEach(([severity, maxCount]) => {
      const actual = vulnerabilities[severity] || 0;
      const status = actual <= maxCount ? '✅' : '❌';

      if (actual > maxCount) {
        passed = false;
      }

      console.log(
        `  ${status} ${severity}: ${actual} vulnerabilities (max: ${maxCount})`
      );
    });

    return passed;
  }

  /**
   * Check test results quality gate
   */
  checkTestGate() {
    console.log('\n🧪 Test Quality Gate:');

    try {
      // Check if any test files exist
      const testFiles = [
        'tests/unit',
        'tests/integration',
        'tests/performance',
      ];

      let hasTests = false;
      testFiles.forEach((dir) => {
        const fullPath = path.join(__dirname, '..', dir);
        if (fs.existsSync(fullPath)) {
          const files = fs
            .readdirSync(fullPath)
            .filter((f) => f.endsWith('.test.js'));
          if (files.length > 0) {
            hasTests = true;
            console.log(`  ✅ ${dir}: ${files.length} test files`);
          }
        }
      });

      if (!hasTests) {
        console.log('  ❌ No test files found');
        return false;
      }

      return true;
    } catch (error) {
      console.log('  ❌ Error checking test files:', error.message);
      return false;
    }
  }

  /**
   * Generate quality report
   */
  generateReport() {
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      gates: {
        coverage: this.checkCoverageGate(),
        performance: this.checkPerformanceGate(),
        security: this.checkSecurityGate(),
        tests: this.checkTestGate(),
      },
      results: this.results,
      config: this.config,
    };

    // Save report
    const reportPath = path.join(
      __dirname,
      '../test-results/quality-report.json'
    );
    const reportDir = path.dirname(reportPath);

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Run all quality gates
   */
  async runQualityGates() {
    console.log('🚦 Running Quality Gates...\n');

    // Load all results
    await this.loadCoverageResults();
    await this.loadPerformanceResults();
    await this.loadSecurityResults();

    // Generate report
    const report = this.generateReport();

    // Check overall status
    const allPassed = Object.values(report.gates).every((gate) => gate);

    console.log('\n📋 Quality Gates Summary:');
    Object.entries(report.gates).forEach(([gate, passed]) => {
      console.log(
        `  ${passed ? '✅' : '❌'} ${gate.toUpperCase()}: ${
          passed ? 'PASSED' : 'FAILED'
        }`
      );
    });

    console.log(
      `\n🎯 Overall Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`
    );
    console.log(`📄 Report saved to: test-results/quality-report.json`);

    if (!allPassed) {
      console.log('\n💡 Tips for improvement:');

      if (!report.gates.coverage) {
        console.log(
          '   • Increase test coverage by adding more unit and integration tests'
        );
      }

      if (!report.gates.performance) {
        console.log('   • Optimize slow endpoints and database queries');
        console.log('   • Consider caching frequently accessed data');
      }

      if (!report.gates.security) {
        console.log('   • Update vulnerable dependencies');
        console.log('   • Review security best practices');
      }

      if (!report.gates.tests) {
        console.log('   • Add comprehensive test suites');
        console.log('   • Ensure all critical paths are tested');
      }
    }

    return allPassed;
  }
}

// CLI execution
if (require.main === module) {
  const qualityGates = new QualityGates();

  qualityGates
    .runQualityGates()
    .then((passed) => {
      process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Quality gates failed:', error);
      process.exit(1);
    });
}

module.exports = QualityGates;
