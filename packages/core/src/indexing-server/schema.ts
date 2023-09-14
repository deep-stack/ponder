import { buildSchema } from "graphql";

export const indexingSchema = buildSchema(`
  scalar BigInt

  input Filter {
    name: String!
    chainId: Int!
    address: [String!]
    topics: [[String!]]
    fromBlock: Int
    toBlock: Int
    includeEventSelectors: [String]
  }

  input CursorInput {
    timestamp: Int!
    chainId: Int!
    blockNumber: Int!
    logIndex: Int!
  }

  # src/types/log.ts
  type Log {
    id: String!
    address: String!
    blockHash: String!
    blockNumber: BigInt!
    data: String!
    logIndex: Int!
    removed: Boolean!
    topics: [String!]
    transactionHash: String!
    transactionIndex: Int!
  }

  # src/types/log.ts
  type Block {
    baseFeePerGas: BigInt
    difficulty: BigInt!
    extraData: String!
    gasLimit: BigInt!
    gasUsed: BigInt!
    hash: String!
    logsBloom: String!
    miner: String!
    mixHash: String!
    nonce: String!
    number: BigInt!
    parentHash: String!
    receiptsRoot: String!
    sha3Uncles: String!
    size: BigInt!
    stateRoot: String!
    timestamp: BigInt!
    totalDifficulty: BigInt!
    transactionsRoot: String!
  }

  type AccessListItem {
    address: String!
    storageKeys: [String!]
  }

  # src/types/transaction.ts
  type Transaction {
    blockHash: String!
    blockNumber: BigInt!
    from: String!
    gas: BigInt!
    hash: String!
    input: String!
    nonce: Int!
    r: String!
    s: String!
    to: String
    transactionIndex: Int!
    v: BigInt!
    value: BigInt!
    type: String!
    gasPrice: BigInt
    accessList: [AccessListItem]
    maxFeePerGas: BigInt
    maxPriorityFeePerGas: BigInt
  }

  type Event {
    logFilterName: String!
    log: Log!
    block: Block!
    transaction: Transaction!
  }

  type Count {
    logFilterName: String!
    selector: String!
    count: Int!
  }

  type Cursor {
    timestamp: Int!
    chainId: Int!
    blockNumber: Int!
    logIndex: Int!
  }

  type Metadata {
    pageEndsAtTimestamp: Int
    counts: [Count!]!
    cursor: Cursor
    isLastPage: Boolean!
  }

  type LogEventsResult {
    events: [Event!] 
    metadata: Metadata
  }

  type Query {
    getLogEvents(
      fromTimestamp: Int!,
      toTimestamp: Int!,
      filters: [Filter!],
      cursor: CursorInput
    ): LogEventsResult!
  }
`);
