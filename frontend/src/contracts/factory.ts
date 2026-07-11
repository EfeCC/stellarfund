import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"InvalidGoal"},
  2: {message:"InvalidDuration"},
  /**
   * `record_activity` was called by an address this factory never deployed.
   */
  3: {message:"UnknownCampaign"},
  /**
   * A page of the registry was requested with a zero or oversized limit.
   */
  4: {message:"InvalidPage"}
}

/**
 * Keys used to address the factory's on-chain storage.
 * 
 * The registry deliberately does *not* live in a single `Vec<Address>` instance
 * entry: that entry would grow without bound and eventually blow the instance
 * size limit, bricking the factory. Instead each campaign gets its own
 * persistent entry, and clients read the registry a page at a time.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "WasmHash", values: void} | {tag: "Count", values: void} | {tag: "CampaignAt", values: readonly [u32]} | {tag: "IsCampaign", values: readonly [string]};




export interface Client {
  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the factory itself.
   */
  upgrade: ({wasm_hash}: {wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a is_campaign transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_campaign: ({campaign}: {campaign: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_campaigns transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A page of the campaign registry, oldest first.
   */
  get_campaigns: ({start, limit}: {start: u32, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<string>>>>

  /**
   * Construct and simulate a get_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_wasm_hash: (options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a create_campaign transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deploy a campaign contract and add it to the registry.
   * 
   * `duration` is relative — seconds from now — rather than an absolute
   * deadline, so a client cannot submit a deadline that has already expired by
   * the time the transaction lands.
   * 
   * Returns the address of the new campaign.
   */
  create_campaign: ({creator, token, title, description, goal, duration}: {creator: string, token: string, title: string, description: string, goal: i128, duration: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a record_activity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Called *by a campaign* whenever its state changes; re-emitted here as an
   * [`events::Activity`] event so the whole platform has one feed.
   * 
   * The `require_auth` below is what makes that feed trustworthy. Soroban
   * grants a contract authorisation over its own address for the calls it
   * makes, so a genuine campaign passes. An external account trying to inject
   * a fake contribution cannot produce that authorisation, and the registry
   * check rejects any contract this factory did not deploy.
   */
  record_activity: ({campaign, kind, actor, amount, raised}: {campaign: string, kind: string, actor: string, amount: i128, raised: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_campaign_wasm transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Point the factory at a new campaign implementation. Campaigns already
   * deployed keep running the code they were deployed with; this only affects
   * campaigns created from here on.
   */
  set_campaign_wasm: ({wasm_hash}: {wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_campaign_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_campaign_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, campaign_wasm_hash}: {admin: string, campaign_wasm_hash: Buffer},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, campaign_wasm_hash}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAABtVcGdyYWRlIHRoZSBmYWN0b3J5IGl0c2VsZi4AAAAAB3VwZ3JhZGUAAAAAAQAAAAAAAAAJd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAALaXNfY2FtcGFpZ24AAAAAAQAAAAAAAAAIY2FtcGFpZ24AAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAASY2FtcGFpZ25fd2FzbV9oYXNoAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAC5BIHBhZ2Ugb2YgdGhlIGNhbXBhaWduIHJlZ2lzdHJ5LCBvbGRlc3QgZmlyc3QuAAAAAAANZ2V0X2NhbXBhaWducwAAAAAAAAIAAAAAAAAABXN0YXJ0AAAAAAAABAAAAAAAAAAFbGltaXQAAAAAAAAEAAAAAQAAA+kAAAPqAAAAEwAAAAM=",
        "AAAAAAAAAAAAAAANZ2V0X3dhc21faGFzaAAAAAAAAAAAAAABAAAD7gAAACA=",
        "AAAAAAAAARREZXBsb3kgYSBjYW1wYWlnbiBjb250cmFjdCBhbmQgYWRkIGl0IHRvIHRoZSByZWdpc3RyeS4KCmBkdXJhdGlvbmAgaXMgcmVsYXRpdmUg4oCUIHNlY29uZHMgZnJvbSBub3cg4oCUIHJhdGhlciB0aGFuIGFuIGFic29sdXRlCmRlYWRsaW5lLCBzbyBhIGNsaWVudCBjYW5ub3Qgc3VibWl0IGEgZGVhZGxpbmUgdGhhdCBoYXMgYWxyZWFkeSBleHBpcmVkIGJ5CnRoZSB0aW1lIHRoZSB0cmFuc2FjdGlvbiBsYW5kcy4KClJldHVybnMgdGhlIGFkZHJlc3Mgb2YgdGhlIG5ldyBjYW1wYWlnbi4AAAAPY3JlYXRlX2NhbXBhaWduAAAAAAYAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAABGdvYWwAAAALAAAAAAAAAAhkdXJhdGlvbgAAAAYAAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAd5DYWxsZWQgKmJ5IGEgY2FtcGFpZ24qIHdoZW5ldmVyIGl0cyBzdGF0ZSBjaGFuZ2VzOyByZS1lbWl0dGVkIGhlcmUgYXMgYW4KW2BldmVudHM6OkFjdGl2aXR5YF0gZXZlbnQgc28gdGhlIHdob2xlIHBsYXRmb3JtIGhhcyBvbmUgZmVlZC4KClRoZSBgcmVxdWlyZV9hdXRoYCBiZWxvdyBpcyB3aGF0IG1ha2VzIHRoYXQgZmVlZCB0cnVzdHdvcnRoeS4gU29yb2JhbgpncmFudHMgYSBjb250cmFjdCBhdXRob3Jpc2F0aW9uIG92ZXIgaXRzIG93biBhZGRyZXNzIGZvciB0aGUgY2FsbHMgaXQKbWFrZXMsIHNvIGEgZ2VudWluZSBjYW1wYWlnbiBwYXNzZXMuIEFuIGV4dGVybmFsIGFjY291bnQgdHJ5aW5nIHRvIGluamVjdAphIGZha2UgY29udHJpYnV0aW9uIGNhbm5vdCBwcm9kdWNlIHRoYXQgYXV0aG9yaXNhdGlvbiwgYW5kIHRoZSByZWdpc3RyeQpjaGVjayByZWplY3RzIGFueSBjb250cmFjdCB0aGlzIGZhY3RvcnkgZGlkIG5vdCBkZXBsb3kuAAAAAAAPcmVjb3JkX2FjdGl2aXR5AAAAAAUAAAAAAAAACGNhbXBhaWduAAAAEwAAAAAAAAAEa2luZAAAABEAAAAAAAAABWFjdG9yAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAZyYWlzZWQAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAK9Qb2ludCB0aGUgZmFjdG9yeSBhdCBhIG5ldyBjYW1wYWlnbiBpbXBsZW1lbnRhdGlvbi4gQ2FtcGFpZ25zIGFscmVhZHkKZGVwbG95ZWQga2VlcCBydW5uaW5nIHRoZSBjb2RlIHRoZXkgd2VyZSBkZXBsb3llZCB3aXRoOyB0aGlzIG9ubHkgYWZmZWN0cwpjYW1wYWlnbnMgY3JlYXRlZCBmcm9tIGhlcmUgb24uAAAAABFzZXRfY2FtcGFpZ25fd2FzbQAAAAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==",
        "AAAAAAAAAAAAAAASZ2V0X2NhbXBhaWduX2NvdW50AAAAAAAAAAAAAQAAAAQ=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABAAAAAAAAAALSW52YWxpZEdvYWwAAAAAAQAAAAAAAAAPSW52YWxpZER1cmF0aW9uAAAAAAIAAABHYHJlY29yZF9hY3Rpdml0eWAgd2FzIGNhbGxlZCBieSBhbiBhZGRyZXNzIHRoaXMgZmFjdG9yeSBuZXZlciBkZXBsb3llZC4AAAAAD1Vua25vd25DYW1wYWlnbgAAAAADAAAAREEgcGFnZSBvZiB0aGUgcmVnaXN0cnkgd2FzIHJlcXVlc3RlZCB3aXRoIGEgemVybyBvciBvdmVyc2l6ZWQgbGltaXQuAAAAC0ludmFsaWRQYWdlAAAAAAQ=",
        "AAAAAgAAAVZLZXlzIHVzZWQgdG8gYWRkcmVzcyB0aGUgZmFjdG9yeSdzIG9uLWNoYWluIHN0b3JhZ2UuCgpUaGUgcmVnaXN0cnkgZGVsaWJlcmF0ZWx5IGRvZXMgKm5vdCogbGl2ZSBpbiBhIHNpbmdsZSBgVmVjPEFkZHJlc3M+YCBpbnN0YW5jZQplbnRyeTogdGhhdCBlbnRyeSB3b3VsZCBncm93IHdpdGhvdXQgYm91bmQgYW5kIGV2ZW50dWFsbHkgYmxvdyB0aGUgaW5zdGFuY2UKc2l6ZSBsaW1pdCwgYnJpY2tpbmcgdGhlIGZhY3RvcnkuIEluc3RlYWQgZWFjaCBjYW1wYWlnbiBnZXRzIGl0cyBvd24KcGVyc2lzdGVudCBlbnRyeSwgYW5kIGNsaWVudHMgcmVhZCB0aGUgcmVnaXN0cnkgYSBwYWdlIGF0IGEgdGltZS4AAAAAAAAAAAAHRGF0YUtleQAAAAAFAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAR0hhc2ggb2YgdGhlIHVwbG9hZGVkIGNhbXBhaWduIHdhc20gdGhhdCBgY3JlYXRlX2NhbXBhaWduYCBpbnN0YW50aWF0ZXMuAAAAAAhXYXNtSGFzaAAAAAAAAAA/TnVtYmVyIG9mIGNhbXBhaWducyBkZXBsb3llZCBzbyBmYXI7IGRvdWJsZXMgYXMgdGhlIG5leHQgaW5kZXguAAAAAAVDb3VudAAAAAAAAAEAAAAaaW5kZXgg4oaSIGNhbXBhaWduIGFkZHJlc3MAAAAAAApDYW1wYWlnbkF0AAAAAAABAAAABAAAAAEAAAAuY2FtcGFpZ24gYWRkcmVzcyDihpIgZGVwbG95ZWQgYnkgdGhpcyBmYWN0b3J5PwAAAAAACklzQ2FtcGFpZ24AAAAAAAEAAAAT",
        "AAAABQAAAJZPbmUgZW50cnkgaW4gdGhlIHBsYXRmb3JtLXdpZGUgbGl2ZSBmZWVkLgoKYGtpbmRgIGlzIG9uZSBvZiB0aGUgYEtJTkRfKmAgc3ltYm9scyB0aGUgY2FtcGFpZ24gcmVwb3J0czoKYGNvbnRyaWJgIHwgYGdvYWxfbWV0YCB8IGB3aXRoZHJhd2AgfCBgcmVmdW5kYC4AAAAAAAAAAAAIQWN0aXZpdHkAAAABAAAACGFjdGl2aXR5AAAABgAAAAAAAAAEa2luZAAAABEAAAABAAAAAAAAAAhjYW1wYWlnbgAAABMAAAABAAAAAAAAAAVhY3RvcgAAAAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAZyYWlzZWQAAAAAAAsAAAAAAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC1dhc21VcGRhdGVkAAAAAAEAAAAMd2FzbV91cGRhdGVkAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAAAAAAAAJd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD0NhbXBhaWduQ3JlYXRlZAAAAAABAAAAEGNhbXBhaWduX2NyZWF0ZWQAAAAGAAAAAAAAAAhjYW1wYWlnbgAAABMAAAABAAAAAAAAAAdjcmVhdG9yAAAAABMAAAABAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAAAAAAAARnb2FsAAAACwAAAAAAAAAAAAAACGRlYWRsaW5lAAAABgAAAAAAAAAAAAAABWluZGV4AAAAAAAABAAAAAAAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    upgrade: this.txFromJSON<null>,
        get_admin: this.txFromJSON<string>,
        is_campaign: this.txFromJSON<boolean>,
        get_campaigns: this.txFromJSON<Result<Array<string>>>,
        get_wasm_hash: this.txFromJSON<Buffer>,
        create_campaign: this.txFromJSON<Result<string>>,
        record_activity: this.txFromJSON<Result<void>>,
        set_campaign_wasm: this.txFromJSON<null>,
        get_campaign_count: this.txFromJSON<u32>
  }
}