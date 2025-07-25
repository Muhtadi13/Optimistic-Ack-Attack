import { Buffer } from 'buffer';
import * as crypto from 'crypto';

export interface TCPPacket {
  buffer: Buffer;
  length: number;
  sourceIP: string;
  destIP: string;
  sourcePort: number;
  destPort: number;
  flags: {
    syn: boolean;
    ack: boolean;
    fin: boolean;
    rst: boolean;
    psh: boolean;
    urg: boolean;
  };
}

export class PacketCrafter {
  private sourceIP: string;
  private sourcePort: number;

  constructor(sourceIP: string = '127.0.0.1', sourcePort: number = 0) {
    this.sourceIP = sourceIP;
    this.sourcePort = sourcePort || Math.floor(Math.random() * 65000) + 1000;
  }

  public createSYNPacket(targetIP: string, targetPort: number, sequenceNumber: number): TCPPacket {
    const tcpHeader = this.createTCPHeader(
      this.sourcePort,
      targetPort,
      sequenceNumber,
      0,
      { syn: true, ack: false, fin: false, rst: false, psh: false, urg: false },
      8192
    );

    const pseudoHeader = this.createPseudoHeader(this.sourceIP, targetIP, tcpHeader.length);
    const checksum = this.calculateChecksum(Buffer.concat([pseudoHeader, tcpHeader]));
    tcpHeader.writeUInt16BE(checksum, 16);

    return {
      buffer: tcpHeader,
      length: tcpHeader.length,
      sourceIP: this.sourceIP,
      destIP: targetIP,
      sourcePort: this.sourcePort,
      destPort: targetPort,
      flags: { syn: true, ack: false, fin: false, rst: false, psh: false, urg: false }
    };
  }

  public createOptimisticACKPacket(
    targetIP: string,
    targetPort: number,
    sequenceNumber: number,
    ackNumber: number,
    windowSize: number = 65535
  ): TCPPacket {
    // Ensure window size doesn't exceed 16-bit limit
    const clampedWindowSize = Math.min(windowSize, 65535);
    
    console.log(`Creating ACK packet with window size: ${clampedWindowSize} (requested: ${windowSize})`);
    
    const tcpHeader = this.createTCPHeader(
      this.sourcePort,
      targetPort,
      sequenceNumber,
      ackNumber,
      { syn: false, ack: true, fin: false, rst: false, psh: false, urg: false },
      clampedWindowSize
    );

    const pseudoHeader = this.createPseudoHeader(this.sourceIP, targetIP, tcpHeader.length);
    const checksum = this.calculateChecksum(Buffer.concat([pseudoHeader, tcpHeader]));
    tcpHeader.writeUInt16BE(checksum, 16);

    return {
      buffer: tcpHeader,
      length: tcpHeader.length,
      sourceIP: this.sourceIP,
      destIP: targetIP,
      sourcePort: this.sourcePort,
      destPort: targetPort,
      flags: { syn: false, ack: true, fin: false, rst: false, psh: false, urg: false }
    };
  }

  private createTCPHeader(
    sourcePort: number,
    destPort: number,
    sequenceNumber: number,
    ackNumber: number,
    flags: any,
    windowSize: number
  ): Buffer {
    const header = Buffer.alloc(20);

    // Validate inputs to prevent buffer overflow
    if (sourcePort < 0 || sourcePort > 65535) {
      throw new Error(`Invalid source port: ${sourcePort}. Must be 0-65535`);
    }
    if (destPort < 0 || destPort > 65535) {
      throw new Error(`Invalid destination port: ${destPort}. Must be 0-65535`);
    }
    if (windowSize < 0 || windowSize > 65535) {
      throw new Error(`Invalid window size: ${windowSize}. Must be 0-65535`);
    }

    header.writeUInt16BE(sourcePort, 0);      // Source port
    header.writeUInt16BE(destPort, 2);        // Destination port
    header.writeUInt32BE(sequenceNumber >>> 0, 4);  // Sequence number (ensure unsigned)
    header.writeUInt32BE(ackNumber >>> 0, 8);       // Acknowledgment number (ensure unsigned)

    // Data offset (4 bits) + Reserved (3 bits) + Flags (9 bits)
    let flagsByte = 0x50; // Data offset = 5 (20 bytes header)
    let flagsByte2 = 0;

    if (flags.urg) flagsByte2 |= 0x20;
    if (flags.ack) flagsByte2 |= 0x10;
    if (flags.psh) flagsByte2 |= 0x08;
    if (flags.rst) flagsByte2 |= 0x04;
    if (flags.syn) flagsByte2 |= 0x02;
    if (flags.fin) flagsByte2 |= 0x01;

    header.writeUInt8(flagsByte, 12);
    header.writeUInt8(flagsByte2, 13);

    header.writeUInt16BE(windowSize, 14);     // Window size
    header.writeUInt16BE(0, 16);              // Checksum (calculated later)
    header.writeUInt16BE(0, 18);              // Urgent pointer

    return header;
  }

  private createPseudoHeader(sourceIP: string, destIP: string, tcpLength: number): Buffer {
    const pseudoHeader = Buffer.alloc(12);
    
    const srcParts = sourceIP.split('.').map(x => parseInt(x));
    const dstParts = destIP.split('.').map(x => parseInt(x));

    // Validate IP address parts
    for (const part of [...srcParts, ...dstParts]) {
      if (part < 0 || part > 255) {
        throw new Error(`Invalid IP address component: ${part}`);
      }
    }

    pseudoHeader.writeUInt8(srcParts[0], 0);
    pseudoHeader.writeUInt8(srcParts[1], 1);
    pseudoHeader.writeUInt8(srcParts[2], 2);
    pseudoHeader.writeUInt8(srcParts[3], 3);

    pseudoHeader.writeUInt8(dstParts[0], 4);
    pseudoHeader.writeUInt8(dstParts[1], 5);
    pseudoHeader.writeUInt8(dstParts[2], 6);
    pseudoHeader.writeUInt8(dstParts[3], 7);

    pseudoHeader.writeUInt8(0, 8);           // Reserved
    pseudoHeader.writeUInt8(6, 9);           // Protocol (TCP = 6)
    pseudoHeader.writeUInt16BE(tcpLength, 10); // TCP length

    return pseudoHeader;
  }

  private calculateChecksum(data: Buffer): number {
    let sum = 0;
    
    for (let i = 0; i < data.length; i += 2) {
      if (i + 1 < data.length) {
        sum += (data[i] << 8) + data[i + 1];
      } else {
        sum += data[i] << 8;
      }
    }

    while (sum > 0xFFFF) {
      sum = (sum & 0xFFFF) + (sum >> 16);
    }

    return ~sum & 0xFFFF;
  }
}