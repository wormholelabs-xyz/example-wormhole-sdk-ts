Example Scripts 
---------------

Simple demos for the [Wormhole SDK](https://github.com/wormhole-foundation/wormhole-sdk-ts)

# Setup

```sh

# Clone repo and install deps 
git clone git@github.com:wormholelabs-xyz/example-wormhole-sdk-ts.git
cd example-wormhole-sdk-ts
npm install

# Navigate to node directory and run a demo, see package.json#scripts for others
cd node

# Setup keys if necessary, see below for details
# Modify the demo at will
npm run msg
```

# Signing Transactions

Add keys in a `.env` file like:

```sh
SOL_PRIVATE_KEY="BASE_58_PRIVATE_KEY"
ETH_PRIVATE_KEY="BASE_16_PRIVATE_KEY"

# ...

SOL_LEDGER_PATH="..."
EVM_LEDGER_PATH="..."
```
