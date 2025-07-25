import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { OptimisticACKAttacker, AttackConfig } from './OptimisticACKAttacker';
import { NetworkMonitor } from './NetworkMonitor';

class AttackCLI {
  private attacker: OptimisticACKAttacker | null = null;
  private networkMonitor: NetworkMonitor;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.networkMonitor = new NetworkMonitor();
    this.displayBanner();
  }

  private displayBanner(): void {
    console.clear();
    console.log(chalk.red.bold(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            🔥 OPTIMISTIC ACK ATTACK TOOL 🔥                 ║
║                                                              ║
║                    Educational Use Only                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `));
    console.log(chalk.yellow('⚠️  WARNING: This tool is for educational and research purposes only!'));
    console.log(chalk.yellow('⚠️  Do not use against systems you do not own or have permission to test.\n'));
  }

  public async run(): Promise<void> {
    try {
      const action = await this.getMainMenuChoice();
      
      switch (action) {
        case 'attack':
          await this.runAttack();
          break;
        case 'test':
          await this.testConnection();
          break;
        case 'monitor':
          await this.monitorNetwork();
          break;
        case 'ui':
          await this.launchUI();
          break;
        case 'exit':
          console.log(chalk.green('Goodbye!'));
          process.exit(0);
          break;
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  private async getMainMenuChoice(): Promise<string> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🚀 Launch Optimistic ACK Attack', value: 'attack' },
          { name: '🔗 Test Target Connection', value: 'test' },
          { name: '📊 Monitor Network Performance', value: 'monitor' },
          { name: '🌐 Launch Web UI', value: 'ui' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);
    return action;
  }

  private async launchUI(): Promise<void> {
    console.log(chalk.cyan('\n🌐 Launching Web UI...'));
    console.log(chalk.green('The web interface will open at: http://localhost:5173'));
    console.log(chalk.yellow('Note: Run "npm run dev:ui" in another terminal to start the web interface.'));
    
    await this.pressAnyKey();
    return this.run();
  }

  private async getAttackConfig(): Promise<AttackConfig> {
    console.log(chalk.cyan('\n📋 Configure Attack Parameters:\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'targetHost',
        message: 'Target Host:',
        default: '127.0.0.1',
        validate: (input) => input.length > 0 || 'Host is required'
      },
      {
        type: 'number',
        name: 'targetPort',
        message: 'Target Port:',
        default: 3001,
        validate: (input) => (input > 0 && input <= 65535) || 'Port must be between 1-65535'
      },
      {
        type: 'number',
        name: 'attackDuration',
        message: 'Attack Duration (seconds):',
        default: 30,
        validate: (input) => input > 0 || 'Duration must be positive'
      },
      {
        type: 'number',
        name: 'packetInterval',
        message: 'Packet Interval (ms):',
        default: 100,
        validate: (input) => input > 0 || 'Interval must be positive'
      },
      {
        type: 'number',
        name: 'ackAdvanceSize',
        message: 'ACK Advance Size (bytes):',
        default: 1460,
        validate: (input) => input > 0 || 'Size must be positive'
      },
      {
        type: 'number',
        name: 'windowScale',
        message: 'Window Scale Factor (1-2 recommended):',
        default: 1.5,
        validate: (input) => (input > 0 && input <= 2) || 'Scale should be between 1-2 for safety'
      }
    ]);

    return answers as AttackConfig;
  }

  private async runAttack(): Promise<void> {
    const config = await this.getAttackConfig();
    
    console.log(chalk.yellow('\n⚡ Preparing attack...'));
    
    // Display configuration
    const configTable = new Table({
      head: [chalk.cyan('Parameter'), chalk.cyan('Value')],
      colWidths: [20, 20]
    });
    
    configTable.push(
      ['Target', `${config.targetHost}:${config.targetPort}`],
      ['Duration', `${config.attackDuration}s`],
      ['Interval', `${config.packetInterval}ms`],
      ['ACK Advance', `${config.ackAdvanceSize} bytes`],
      ['Window Scale', `${config.windowScale}x`]
    );
    
    console.log(configTable.toString());
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('⚠️  Are you sure you want to proceed with the attack?'),
        default: false
      }
    ]);
    
    if (!confirm) {
      console.log(chalk.yellow('Attack cancelled.'));
      return this.run();
    }
    
    try {
      this.attacker = new OptimisticACKAttacker(config);
      
      console.log(chalk.green('\n🚀 Starting Optimistic ACK Attack...\n'));
      
      // Start real-time metrics display
      this.startMetricsDisplay();
      
      await this.attacker.executeAttack();
      
      console.log(chalk.green('\n✅ Attack completed successfully!'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Attack failed:'), error);
    } finally {
      this.stopMetricsDisplay();
      await this.pressAnyKey();
      return this.run();
    }
  }

  private async testConnection(): Promise<void> {
    const { host, port } = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Target Host:',
        default: '127.0.0.1'
      },
      {
        type: 'number',
        name: 'port',
        message: 'Target Port:',
        default: 3001
      }
    ]);

    console.log(chalk.yellow(`\n🔗 Testing connection to ${host}:${port}...`));
    
    try {
      // Test both HTTP and TCP connections
      const fetch = (await import('node-fetch')).default;
      
      // Test HTTP endpoint
      try {
        const response = await fetch(`http://${host}:${port}/health`, { timeout: 5000 });
        console.log(chalk.green(`✅ HTTP connection successful (Status: ${response.status})`));
      } catch (error) {
        console.log(chalk.yellow('⚠️  HTTP endpoint not available'));
      }
      
      // Test TCP connection
      const net = await import('net');
      const socket = new net.Socket();
      
      await new Promise((resolve, reject) => {
        socket.setTimeout(5000);
        
        socket.connect(port, host, () => {
          console.log(chalk.green('✅ TCP connection successful'));
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', reject);
        socket.on('timeout', () => reject(new Error('Connection timeout')));
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Connection failed:'), error);
    }
    
    await this.pressAnyKey();
    return this.run();
  }

  private async monitorNetwork(): Promise<void> {
    console.log(chalk.cyan('\n📊 Network Performance Monitor'));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));
    
    const metricsTable = new Table({
      head: [
        chalk.cyan('Metric'),
        chalk.cyan('Value'),
        chalk.cyan('Unit')
      ],
      colWidths: [20, 15, 10]
    });
    
    const monitorInterval = setInterval(() => {
      const metrics = this.networkMonitor.getMetrics();
      
      console.clear();
      this.displayBanner();
      console.log(chalk.cyan('\n📊 Real-time Network Metrics:\n'));
      
      metricsTable.length = 0; // Clear table
      metricsTable.push(
        ['Download Speed', this.formatSpeed(metrics.downloadSpeed), 'B/s'],
        ['Upload Speed', this.formatSpeed(metrics.uploadSpeed), 'B/s'],
        ['Latency', metrics.latency.toFixed(1), 'ms'],
        ['Bandwidth', this.formatSpeed(metrics.bandwidth), 'B/s'],
        ['Packets/sec', metrics.packetsPerSecond.toFixed(0), 'pps']
      );
      
      console.log(metricsTable.toString());
      console.log(chalk.gray('\nPress Ctrl+C to stop monitoring...'));
      
    }, 1000);
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(monitorInterval);
      console.log(chalk.yellow('\n\n📊 Network monitoring stopped.'));
      this.run();
    });
  }

  private startMetricsDisplay(): void {
    this.metricsInterval = setInterval(() => {
      if (!this.attacker) return;
      
      const metrics = this.attacker.getMetrics();
      const networkMetrics = this.networkMonitor.getMetrics();
      
      console.clear();
      console.log(chalk.red.bold('🔥 ATTACK IN PROGRESS 🔥\n'));
      
      const attackTable = new Table({
        head: [chalk.red('Attack Metric'), chalk.red('Value')],
        colWidths: [25, 20]
      });
      
      attackTable.push(
        ['Packets Sent', metrics.packetsPressed.toLocaleString()],
        ['Successful ACKs', metrics.successfulAcks.toLocaleString()],
        ['Connection Status', metrics.connectionEstablished ? '✅ ACTIVE' : '❌ FAILED'],
        ['Current Speed', this.formatSpeed(metrics.currentSpeed)],
        ['Data Transferred', this.formatBytes(metrics.totalDataTransferred)],
        ['Elapsed Time', `${((Date.now() - metrics.attackStartTime) / 1000).toFixed(1)}s`]
      );
      
      console.log(attackTable.toString());
      
      const networkTable = new Table({
        head: [chalk.cyan('Network Metric'), chalk.cyan('Value')],
        colWidths: [25, 20]
      });
      
      networkTable.push(
        ['Download Speed', this.formatSpeed(networkMetrics.downloadSpeed)],
        ['Upload Speed', this.formatSpeed(networkMetrics.uploadSpeed)],
        ['Latency', `${networkMetrics.latency.toFixed(1)}ms`],
        ['Packets/sec', networkMetrics.packetsPerSecond.toFixed(0)]
      );
      
      console.log('\n' + networkTable.toString());
      
    }, 1000);
  }

  private stopMetricsDisplay(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private async pressAnyKey(): Promise<void> {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatSpeed(bytesPerSecond: number): string {
    return this.formatBytes(bytesPerSecond) + '/s';
  }
}

// Start the CLI application
const cli = new AttackCLI();
cli.run().catch(console.error);