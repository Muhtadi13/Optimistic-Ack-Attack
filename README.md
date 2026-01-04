# Optimistic Ack Attack Simulation 🛡️

This project demonstrates a **TCP Optimistic Ack Attack** on a streaming website. It serves as a security research tool to analyze vulnerabilities in TCP congestion control and showcase defense mechanisms.

## 🔍 Overview

The Optimistic Ack Attack exploits TCP's congestion control algorithm by sending acknowledgments (ACKs) for data segments that haven't been received yet. This tricks the server into increasing its transmission rate, potentially leading to a Denial of Service (DoS) or significant bandwidth degradation for other users.

## 🚀 Features

- **Attack Simulation**: Simulates an optimistic ack attack against a target streaming service.
- **Real-Time Monitoring**: Visualizes network traffic and server load during the attack.
- **Defense Mechanisms**: Implements and demonstrates mitigation strategies to detect and block the attack.

## 🛠️ Tech Stack

- **Language**: TypeScript, Node.js
- **Containerization**: Docker
- **Scripting**: Shell Scripting
- **Networking**: TCP/IP Stack Analysis

## 📦 Usage

1. **Clone the repository**
   ```bash
   git clone https://github.com/Muhtadi13/Optimistic-Ack-Attack.git
   ```

2. **Run with Docker**
   ```bash
   docker-compose up --build
   ```

3. **Execute Attack Script**
   ```bash
   ./scripts/launch_attack.sh <target_ip>
   ```

## ⚠️ Disclaimer

This project is for **educational and research purposes only**. Do not use this tool against systems you do not own or have explicit permission to test.

## 📄 License

MIT License
