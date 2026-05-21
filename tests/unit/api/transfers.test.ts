import {
  TRANSFER_EVENT_TYPES,
  TransferQueryError,
  parseTransferQuery,
} from "@/api/transfers-query";

describe("TRANSFER_EVENT_TYPES", () => {
  it("includes every ownership-changing event type", () => {
    expect(TRANSFER_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "nft_minted",
        "batch_minted",
        "nft_purchased",
        "auction_settled",
        "offer_accepted",
        "collection_offer_filled",
        "trait_offer_filled",
      ]),
    );
  });

  it("has no duplicates", () => {
    expect(new Set(TRANSFER_EVENT_TYPES).size).toBe(TRANSFER_EVENT_TYPES.length);
  });
});

describe("parseTransferQuery", () => {
  it("applies sane defaults when no params are provided", () => {
    const parsed = parseTransferQuery({});
    expect(parsed).toEqual({ limit: 20, offset: 0 });
  });

  it("clamps limit to the max of 100", () => {
    const parsed = parseTransferQuery({ limit: "9999" });
    expect(parsed.limit).toBe(100);
  });

  it("derives offset from page when offset is missing", () => {
    const parsed = parseTransferQuery({ page: "3", limit: "25" });
    expect(parsed).toMatchObject({ limit: 25, offset: 50 });
  });

  it("prefers an explicit offset over a page param", () => {
    const parsed = parseTransferQuery({ page: "3", offset: "7" });
    expect(parsed.offset).toBe(7);
  });

  it("rejects a negative limit", () => {
    expect(() => parseTransferQuery({ limit: "-1" })).toThrow(TransferQueryError);
  });

  it("rejects a non-integer limit", () => {
    expect(() => parseTransferQuery({ limit: "abc" })).toThrow(TransferQueryError);
  });

  it("rejects page < 1", () => {
    expect(() => parseTransferQuery({ page: "0" })).toThrow(TransferQueryError);
  });

  it("lower-cases collection addresses", () => {
    const parsed = parseTransferQuery({
      collection: "0xABCDEF0123456789ABCDEF0123456789ABCDEF01",
    });
    expect(parsed.collection).toBe(
      "0xabcdef0123456789abcdef0123456789abcdef01",
    );
  });

  it("lower-cases actor addresses", () => {
    const parsed = parseTransferQuery({
      actor: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(parsed.actor).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("rejects malformed addresses", () => {
    expect(() =>
      parseTransferQuery({ collection: "0xnothex" }),
    ).toThrow(TransferQueryError);
    expect(() =>
      parseTransferQuery({ actor: "0x1234" }),
    ).toThrow(TransferQueryError);
  });

  it("parses sinceTimestamp as a non-negative integer", () => {
    const parsed = parseTransferQuery({ sinceTimestamp: "1700000000" });
    expect(parsed.sinceTimestamp).toBe(1700000000);
  });

  it("rejects negative sinceTimestamp", () => {
    expect(() =>
      parseTransferQuery({ sinceTimestamp: "-1" }),
    ).toThrow(TransferQueryError);
  });

  it("accepts a single supported eventType", () => {
    const parsed = parseTransferQuery({ eventType: "nft_purchased" });
    expect(parsed.eventType).toBe("nft_purchased");
  });

  it("rejects an eventType outside the canonical set", () => {
    expect(() =>
      parseTransferQuery({ eventType: "listing_created" }),
    ).toThrow(TransferQueryError);
  });

  it("works with a URLSearchParams instance", () => {
    const params = new URLSearchParams({ limit: "5", page: "2" });
    const parsed = parseTransferQuery(params);
    expect(parsed).toEqual({ limit: 5, offset: 5 });
  });

  it("propagates the field name on validation errors", () => {
    try {
      parseTransferQuery({ collection: "bad" });
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TransferQueryError);
      expect((err as TransferQueryError).field).toBe("collection");
    }
  });
});
