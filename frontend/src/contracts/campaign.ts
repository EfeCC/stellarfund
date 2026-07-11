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
  2: {message:"InvalidDeadline"},
  3: {message:"InvalidTitle"},
  4: {message:"InvalidDescription"},
  5: {message:"InvalidAmount"},
  /**
   * Contributions are only accepted while the campaign is `Active`.
   */
  6: {message:"CampaignNotActive"},
  /**
   * `withdraw` was called before the goal was reached.
   */
  7: {message:"GoalNotReached"},
  8: {message:"AlreadyWithdrawn"},
  /**
   * `refund` was called on a campaign that is not `Failed`.
   */
  9: {message:"CampaignNotFailed"},
  /**
   * The caller has no refundable balance (never contributed, or already refunded).
   */
  10: {message:"NothingToRefund"}
}

/**
 * Keys used to address the campaign's on-chain storage.
 * 
 * `Config`, `Raised`, `Withdrawn` and `Contributors` live in instance storage so
 * that they share the contract's TTL. Individual contributions live in
 * persistent storage: they are unbounded in number and must survive
 * independently of the instance entry.
 */
export type DataKey = {tag: "Config", values: void} | {tag: "Raised", values: void} | {tag: "Withdrawn", values: void} | {tag: "Contributors", values: void} | {tag: "Contribution", values: readonly [string]};


/**
 * Full campaign snapshot returned to clients in a single call, so the frontend
 * does not have to fan out into several RPC round-trips per campaign card.
 */
export interface CampaignState {
  contributors: u32;
  creator: string;
  deadline: u64;
  description: string;
  factory: string;
  goal: i128;
  raised: i128;
  status: CampaignStatus;
  title: string;
  token: string;
}


/**
 * Immutable campaign parameters, written once by the constructor.
 */
export interface CampaignConfig {
  creator: string;
  deadline: u64;
  description: string;
  /**
 * The factory that deployed this campaign; it doubles as the activity hub.
 */
factory: string;
  goal: i128;
  title: string;
  /**
 * Address of the token (SAC) this campaign raises funds in.
 */
token: string;
}

/**
 * Lifecycle of a campaign. Derived from storage rather than stored, so it can
 * never drift out of sync with the ledger clock.
 * 
 * ```text
 * raised >= goal
 * ┌──────────────────────────────────▶ Successful ──withdraw()──▶ Withdrawn
 * │
 * Active
 * │
 * └──────────────────────────────────▶ Failed ──refund()──▶ Failed
 * now >= deadline && raised < goal
 * ```
 */
export enum CampaignStatus {
  Active = 0,
  Successful = 1,
  Failed = 2,
  Withdrawn = 3,
}






export interface Client {
  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Claim back a pledge from a campaign that missed its goal.
   * 
   * Returns the amount refunded.
   */
  refund: ({contributor}: {contributor: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pay the escrowed funds out to the creator. Only once the goal is met —
   * the deadline does not have to have passed.
   * 
   * Returns the amount withdrawn.
   */
  withdraw: (options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Everything the UI needs to render a campaign card, in one call.
   */
  get_state: (options?: MethodOptions) => Promise<AssembledTransaction<CampaignState>>

  /**
   * Construct and simulate a contribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pledge `amount` of the campaign's token. Funds are escrowed in this
   * contract until the campaign resolves.
   * 
   * Returns the campaign's new total raised.
   */
  contribute: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_status: (options?: MethodOptions) => Promise<AssembledTransaction<CampaignStatus>>

  /**
   * Construct and simulate a get_contribution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The refundable balance of `contributor` — zero once refunded.
   */
  get_contribution: ({contributor}: {contributor: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {creator, token, factory, title, description, goal, deadline}: {creator: string, token: string, factory: string, title: string, description: string, goal: i128, deadline: u64},
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
    return ContractClient.deploy({creator, token, factory, title, description, goal, deadline}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAFdDbGFpbSBiYWNrIGEgcGxlZGdlIGZyb20gYSBjYW1wYWlnbiB0aGF0IG1pc3NlZCBpdHMgZ29hbC4KClJldHVybnMgdGhlIGFtb3VudCByZWZ1bmRlZC4AAAAABnJlZnVuZAAAAAAAAQAAAAAAAAALY29udHJpYnV0b3IAAAAAEwAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAAJJQYXkgdGhlIGVzY3Jvd2VkIGZ1bmRzIG91dCB0byB0aGUgY3JlYXRvci4gT25seSBvbmNlIHRoZSBnb2FsIGlzIG1ldCDigJQKdGhlIGRlYWRsaW5lIGRvZXMgbm90IGhhdmUgdG8gaGF2ZSBwYXNzZWQuCgpSZXR1cm5zIHRoZSBhbW91bnQgd2l0aGRyYXduLgAAAAAACHdpdGhkcmF3AAAAAAAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAAD9FdmVyeXRoaW5nIHRoZSBVSSBuZWVkcyB0byByZW5kZXIgYSBjYW1wYWlnbiBjYXJkLCBpbiBvbmUgY2FsbC4AAAAACWdldF9zdGF0ZQAAAAAAAAAAAAABAAAH0AAAAA1DYW1wYWlnblN0YXRlAAAA",
        "AAAAAAAAAJNQbGVkZ2UgYGFtb3VudGAgb2YgdGhlIGNhbXBhaWduJ3MgdG9rZW4uIEZ1bmRzIGFyZSBlc2Nyb3dlZCBpbiB0aGlzCmNvbnRyYWN0IHVudGlsIHRoZSBjYW1wYWlnbiByZXNvbHZlcy4KClJldHVybnMgdGhlIGNhbXBhaWduJ3MgbmV3IHRvdGFsIHJhaXNlZC4AAAAACmNvbnRyaWJ1dGUAAAAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAAAAAAAKZ2V0X3N0YXR1cwAAAAAAAAAAAAEAAAfQAAAADkNhbXBhaWduU3RhdHVzAAA=",
        "AAAAAAAAAItDYWxsZWQgYnkgdGhlIGZhY3RvcnkgYXMgcGFydCBvZiBgZGVwbG95X3YyYCwgaW4gdGhlIHNhbWUgdHJhbnNhY3Rpb24gYXMKdGhlIGRlcGxveW1lbnQg4oCUIGEgY2FtcGFpZ24gY2FuIG5ldmVyIGJlIG9ic2VydmVkIHVuaW5pdGlhbGlzZWQuAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAABwAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAB2ZhY3RvcnkAAAAAEwAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAARnb2FsAAAACwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAA==",
        "AAAAAAAAAD9UaGUgcmVmdW5kYWJsZSBiYWxhbmNlIG9mIGBjb250cmlidXRvcmAg4oCUIHplcm8gb25jZSByZWZ1bmRlZC4AAAAAEGdldF9jb250cmlidXRpb24AAAABAAAAAAAAAAtjb250cmlidXRvcgAAAAATAAAAAQAAAAs=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACgAAAAAAAAALSW52YWxpZEdvYWwAAAAAAQAAAAAAAAAPSW52YWxpZERlYWRsaW5lAAAAAAIAAAAAAAAADEludmFsaWRUaXRsZQAAAAMAAAAAAAAAEkludmFsaWREZXNjcmlwdGlvbgAAAAAABAAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAUAAAA/Q29udHJpYnV0aW9ucyBhcmUgb25seSBhY2NlcHRlZCB3aGlsZSB0aGUgY2FtcGFpZ24gaXMgYEFjdGl2ZWAuAAAAABFDYW1wYWlnbk5vdEFjdGl2ZQAAAAAAAAYAAAAyYHdpdGhkcmF3YCB3YXMgY2FsbGVkIGJlZm9yZSB0aGUgZ29hbCB3YXMgcmVhY2hlZC4AAAAAAA5Hb2FsTm90UmVhY2hlZAAAAAAABwAAAAAAAAAQQWxyZWFkeVdpdGhkcmF3bgAAAAgAAAA3YHJlZnVuZGAgd2FzIGNhbGxlZCBvbiBhIGNhbXBhaWduIHRoYXQgaXMgbm90IGBGYWlsZWRgLgAAAAARQ2FtcGFpZ25Ob3RGYWlsZWQAAAAAAAAJAAAATlRoZSBjYWxsZXIgaGFzIG5vIHJlZnVuZGFibGUgYmFsYW5jZSAobmV2ZXIgY29udHJpYnV0ZWQsIG9yIGFscmVhZHkgcmVmdW5kZWQpLgAAAAAAD05vdGhpbmdUb1JlZnVuZAAAAAAK",
        "AAAAAgAAATFLZXlzIHVzZWQgdG8gYWRkcmVzcyB0aGUgY2FtcGFpZ24ncyBvbi1jaGFpbiBzdG9yYWdlLgoKYENvbmZpZ2AsIGBSYWlzZWRgLCBgV2l0aGRyYXduYCBhbmQgYENvbnRyaWJ1dG9yc2AgbGl2ZSBpbiBpbnN0YW5jZSBzdG9yYWdlIHNvCnRoYXQgdGhleSBzaGFyZSB0aGUgY29udHJhY3QncyBUVEwuIEluZGl2aWR1YWwgY29udHJpYnV0aW9ucyBsaXZlIGluCnBlcnNpc3RlbnQgc3RvcmFnZTogdGhleSBhcmUgdW5ib3VuZGVkIGluIG51bWJlciBhbmQgbXVzdCBzdXJ2aXZlCmluZGVwZW5kZW50bHkgb2YgdGhlIGluc3RhbmNlIGVudHJ5LgAAAAAAAAAAAAAHRGF0YUtleQAAAAAFAAAAAAAAAAAAAAAGQ29uZmlnAAAAAAAAAAAAAAAAAAZSYWlzZWQAAAAAAAAAAAAAAAAACVdpdGhkcmF3bgAAAAAAAAAAAAAAAAAADENvbnRyaWJ1dG9ycwAAAAEAAAAAAAAADENvbnRyaWJ1dGlvbgAAAAEAAAAT",
        "AAAAAQAAAJVGdWxsIGNhbXBhaWduIHNuYXBzaG90IHJldHVybmVkIHRvIGNsaWVudHMgaW4gYSBzaW5nbGUgY2FsbCwgc28gdGhlIGZyb250ZW5kCmRvZXMgbm90IGhhdmUgdG8gZmFuIG91dCBpbnRvIHNldmVyYWwgUlBDIHJvdW5kLXRyaXBzIHBlciBjYW1wYWlnbiBjYXJkLgAAAAAAAAAAAAANQ2FtcGFpZ25TdGF0ZQAAAAAAAAoAAAAAAAAADGNvbnRyaWJ1dG9ycwAAAAQAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAAdmYWN0b3J5AAAAABMAAAAAAAAABGdvYWwAAAALAAAAAAAAAAZyYWlzZWQAAAAAAAsAAAAAAAAABnN0YXR1cwAAAAAH0AAAAA5DYW1wYWlnblN0YXR1cwAAAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAQAAAD9JbW11dGFibGUgY2FtcGFpZ24gcGFyYW1ldGVycywgd3JpdHRlbiBvbmNlIGJ5IHRoZSBjb25zdHJ1Y3Rvci4AAAAAAAAAAA5DYW1wYWlnbkNvbmZpZwAAAAAABwAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAABIVGhlIGZhY3RvcnkgdGhhdCBkZXBsb3llZCB0aGlzIGNhbXBhaWduOyBpdCBkb3VibGVzIGFzIHRoZSBhY3Rpdml0eSBodWIuAAAAB2ZhY3RvcnkAAAAAEwAAAAAAAAAEZ29hbAAAAAsAAAAAAAAABXRpdGxlAAAAAAAAEAAAADlBZGRyZXNzIG9mIHRoZSB0b2tlbiAoU0FDKSB0aGlzIGNhbXBhaWduIHJhaXNlcyBmdW5kcyBpbi4AAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAwAAAfVMaWZlY3ljbGUgb2YgYSBjYW1wYWlnbi4gRGVyaXZlZCBmcm9tIHN0b3JhZ2UgcmF0aGVyIHRoYW4gc3RvcmVkLCBzbyBpdCBjYW4KbmV2ZXIgZHJpZnQgb3V0IG9mIHN5bmMgd2l0aCB0aGUgbGVkZ2VyIGNsb2NrLgoKYGBgdGV4dApyYWlzZWQgPj0gZ29hbArilIzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilrYgU3VjY2Vzc2Z1bCDilIDilIB3aXRoZHJhdygp4pSA4pSA4pa2IFdpdGhkcmF3bgrilIIKQWN0aXZlCuKUggrilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilrYgRmFpbGVkIOKUgOKUgHJlZnVuZCgp4pSA4pSA4pa2IEZhaWxlZApub3cgPj0gZGVhZGxpbmUgJiYgcmFpc2VkIDwgZ29hbApgYGAAAAAAAAAAAAAADkNhbXBhaWduU3RhdHVzAAAAAAAEAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAAClN1Y2Nlc3NmdWwAAAAAAAEAAAAAAAAABkZhaWxlZAAAAAAAAgAAAAAAAAAJV2l0aGRyYXduAAAAAAAAAw==",
        "AAAABQAAAAAAAAAAAAAAB0NyZWF0ZWQAAAAAAQAAAAdjcmVhdGVkAAAAAAMAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAEAAAAAAAAABGdvYWwAAAALAAAAAAAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAACFJlZnVuZGVkAAAAAQAAAAhyZWZ1bmRlZAAAAAIAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAACVdpdGhkcmF3bgAAAAAAAAEAAAAJd2l0aGRyYXduAAAAAAAAAgAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC0NvbnRyaWJ1dGVkAAAAAAEAAAALY29udHJpYnV0ZWQAAAAAAwAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAZyYWlzZWQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAC0dvYWxSZWFjaGVkAAAAAAEAAAAMZ29hbF9yZWFjaGVkAAAAAgAAAAAAAAAEZ29hbAAAAAsAAAAAAAAAAAAAAAZyYWlzZWQAAAAAAAsAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    refund: this.txFromJSON<Result<i128>>,
        withdraw: this.txFromJSON<Result<i128>>,
        get_state: this.txFromJSON<CampaignState>,
        contribute: this.txFromJSON<Result<i128>>,
        get_status: this.txFromJSON<CampaignStatus>,
        get_contribution: this.txFromJSON<i128>
  }
}