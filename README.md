# Solana Token Manager

A modern web application for creating and managing Solana tokens. Built with React, Vite, and Solana Web3.js.

## Features

- Connect to Phantom or Solflare wallet
- Create new tokens on Solana
- Mint tokens to your wallet
- Transfer tokens to other addresses
- Real-time balance updates
- Modern UI with Tailwind CSS

## Prerequisites

- Node.js 16+ and npm
- Solana wallet (Phantom or Solflare)
- Some SOL in your wallet for transactions

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd solana-token-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Usage

1. Connect your wallet using the "Select Wallet" button
2. Create a new token by entering a token name
3. Mint tokens to your wallet by specifying the amount
4. Transfer tokens to other addresses by providing the recipient's address and amount

## Technical Stack

- React + Vite
- Solana Web3.js
- @solana/spl-token
- @solana/wallet-adapter
- Tailwind CSS
- React Toastify

## Development

The application is built with modern React practices and uses the following Solana libraries:
- @solana/web3.js for blockchain interactions
- @solana/spl-token for token operations
- @solana/wallet-adapter for wallet integration

## License

MIT
