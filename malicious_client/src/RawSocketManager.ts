import * as net from 'net';
import { TCPPacket } from './PacketCrafter';

export class RawSocketManager {
  private connections: Map<string, net.Socket> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.isInitialized = true;
    console.log('Socket manager initialized');
  }

  public async sendPacket(packet: TCPPacket): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Socket manager not initialized');
    }

    const connectionKey = `${packet.destIP}:${packet.destPort}`;
    
    return new Promise((resolve, reject) => {
      try {
        // For demonstration, we'll use regular TCP socket
        // In real implementation, raw sockets would be used
        if (!this.connections.has(connectionKey)) {
          const socket = new net.Socket();
          this.connections.set(connectionKey, socket);
          
          socket.connect(packet.destPort, packet.destIP, () => {
            console.log(`Connected to ${packet.destIP}:${packet.destPort}`);
            this.simulatePacketSending(packet);
            resolve();
          });

          socket.on('error', (error) => {
            console.error('Socket error:', error);
            reject(error);
          });
        } else {
          this.simulatePacketSending(packet);
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private simulatePacketSending(packet: TCPPacket): void {
    console.log(`Sending ${packet.length} bytes packet:`);
    console.log(`  Source: ${packet.sourceIP}:${packet.sourcePort}`);
    console.log(`  Destination: ${packet.destIP}:${packet.destPort}`);
    console.log(`  Flags: ${Object.entries(packet.flags)
      .filter(([_, value]) => value)
      .map(([key, _]) => key.toUpperCase())
      .join(', ')}`);
  }

  public async establishConnection(targetIP: string, targetPort: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      
      socket.connect(targetPort, targetIP, () => {
        console.log(`TCP connection established to ${targetIP}:${targetPort}`);
        resolve(socket);
      });

      socket.on('error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });
    });
  }

  public close(): void {
    this.connections.forEach((socket, key) => {
      socket.destroy();
      console.log(`Closed connection to ${key}`);
    });
    this.connections.clear();
    this.isInitialized = false;
  }
}