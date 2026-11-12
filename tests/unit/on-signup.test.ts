import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  existingMemberships: [] as Array<{ id: string }>,
  inserted: [] as Array<{ table: unknown; values: unknown }>,
  transactionCalls: 0,
  executeCalls: 0,
  dbCalls: 0,
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  eq: (column: unknown, value: unknown) => ({ type: "eq", column, value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  }),
}));

vi.mock("@/lib/db", () => {
  const schema = {
    organization: { id: "organization" },
    member: { id: "member", userId: "member.userId", organizationId: "member.organizationId" },
    pipelineStage: { id: "pipelineStage" },
    agentProfile: { id: "agentProfile" },
  };
  const tx = {
    execute: async () => { state.executeCalls += 1; },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => state.existingMemberships,
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: unknown) => { state.inserted.push({ table, values }); },
    }),
  };
  return {
    schema,
    getDb: () => {
      state.dbCalls += 1;
      return {
        transaction: async (callback: (transaction: typeof tx) => Promise<void>) => {
          state.transactionCalls += 1;
          await callback(tx);
        },
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => state.existingMemberships,
            }),
          }),
        }),
      };
    },
  };
});

import { onUserCreated } from "@/server/auth/on-signup";

beforeEach(() => {
  state.existingMemberships = [];
  state.inserted = [];
  state.transactionCalls = 0;
  state.executeCalls = 0;
  state.dbCalls = 0;
});

describe("onUserCreated tenant provisioning", () => {
  it("does not provision a new tenant for an internal team signup", async () => {
    await onUserCreated("user_team", "Team member", false);

    expect(state.dbCalls).toBe(0);
    expect(state.inserted).toHaveLength(0);
  });

  it("creates an organization, owner membership, default stages, and agent profile", async () => {
    await onUserCreated("user_external", "External customer");

    expect(state.transactionCalls).toBe(1);
    expect(state.inserted).toHaveLength(4);
    expect(state.inserted.map((item) => item.table)).toEqual([
      "organization",
      "member",
      "pipelineStage",
      "agentProfile",
    ]);
  });

  it("does not create a duplicate tenant when the user already has a membership", async () => {
    state.existingMemberships = [{ id: "existing_member" }];

    await onUserCreated("user_retry", "Retry customer");

    expect(state.transactionCalls).toBe(1);
    expect(state.inserted).toHaveLength(0);
  });

  it("serializes provisioning attempts for the same user identity", async () => {
    await onUserCreated("user_lock", "Lock customer");

    expect(state.executeCalls).toBe(1);
  });
});
