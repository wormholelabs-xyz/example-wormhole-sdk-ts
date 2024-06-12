Example Scripts 
---------------

Simple demos for the [Wormhole SDK](https://github.com/wormhole-foundation/wormhole-sdk-ts)

# Setup

```sh
# Clone repo and install deps 
git clone git@github.com:wormholelabs-xyz/example-wormhole-sdk-ts.git
cd example-wormhole-sdk-ts
npm install

# Setup keys if necessary, see below for details

# Navigate to desktop directory and run a demo
npm run msg
```

This installs `@wormhole-foundation/sdk` and several platform packages.

# Signing Transactions

Add keys in a `.env` file like:

```
SOL_PRIVATE_KEY="BASE_58_PRIVATE_KEY"
ETH_PRIVATE_KEY="BASE_16_PRIVATE_KEY"

# ...

SOL_LEDGER_PATH="..."
EVM_LEDGER_PATH="..."
```
