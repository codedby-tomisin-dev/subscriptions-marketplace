import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-bonbon",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "customers/maya"), { name: "Maya" });
    await setDoc(doc(db, "customers/sam"), { name: "Sam" });
    await setDoc(doc(db, "subscriptions/s1"), { customerId: "maya" });
    await setDoc(doc(db, "subscriptions/s2"), { customerId: "sam" });
    await setDoc(doc(db, "orders/BB-1"), { customerId: "maya" });
    await setDoc(doc(db, "orders/BB-2"), { customerId: "sam" });
    for (const name of ["events/e1", "payments/p1", "inventory/i1", "reorders/r1", "metrics_snapshots/2026-10-01", "counters/orders", "stripe_events/evt_1", "admins/ops", "admin_invites/sam@bonbon.test"]) {
      await setDoc(doc(db, name), { customerId: "maya" });
    }
  });
});

const maya = () => env.authenticatedContext("maya").firestore();
const admin = () => env.authenticatedContext("ops", { role: "admin" }).firestore();
const guest = () => env.unauthenticatedContext().firestore();

describe("customers", () => {
  test("read their own customer doc, subscriptions and orders", async () => {
    await assertSucceeds(getDoc(doc(maya(), "customers/maya")));
    await assertSucceeds(getDoc(doc(maya(), "subscriptions/s1")));
    await assertSucceeds(getDoc(doc(maya(), "orders/BB-1")));
    await assertSucceeds(getDocs(query(collection(maya(), "subscriptions"), where("customerId", "==", "maya"))));
  });

  test("can't read another customer's data", async () => {
    await assertFails(getDoc(doc(maya(), "customers/sam")));
    await assertFails(getDoc(doc(maya(), "subscriptions/s2")));
    await assertFails(getDoc(doc(maya(), "orders/BB-2")));
    await assertFails(getDocs(collection(maya(), "subscriptions")));
  });

  test("can't read admin-only collections, even rows tagged with their id", async () => {
    for (const name of ["events/e1", "payments/p1", "inventory/i1", "reorders/r1", "metrics_snapshots/2026-10-01", "counters/orders", "stripe_events/evt_1", "admins/ops", "admin_invites/sam@bonbon.test"]) {
      await assertFails(getDoc(doc(maya(), name)));
    }
  });
});

describe("guests", () => {
  test("can read the catalog but not write it", async () => {
    await assertSucceeds(getDoc(doc(guest(), "boxes/snacks")));
    await assertFails(setDoc(doc(guest(), "boxes/snacks"), { name: "Free snacks" }));
    await assertFails(setDoc(doc(admin(), "boxes/snacks"), { name: "Edited from the browser" }));
  });

  test("can't read anything else", async () => {
    await assertFails(getDoc(doc(guest(), "customers/maya")));
    await assertFails(getDoc(doc(guest(), "orders/BB-1")));
  });
});

describe("admins", () => {
  test("read every admin collection", async () => {
    for (const name of ["customers/sam", "subscriptions/s2", "orders/BB-2", "events/e1", "payments/p1", "inventory/i1", "reorders/r1", "metrics_snapshots/2026-10-01", "admins/ops", "admin_invites/sam@bonbon.test"]) {
      await assertSucceeds(getDoc(doc(admin(), name)));
    }
  });

  test("still can't read functions-only collections", async () => {
    await assertFails(getDoc(doc(admin(), "counters/orders")));
    await assertFails(getDoc(doc(admin(), "stripe_events/evt_1")));
  });
});

describe("writes", () => {
  test("no client can write, including admins and owners", async () => {
    await assertFails(setDoc(doc(maya(), "customers/maya"), { name: "Mallory" }));
    await assertFails(setDoc(doc(maya(), "subscriptions/s1"), { customerId: "maya", status: "active" }));
    await assertFails(setDoc(doc(maya(), "orders/BB-9"), { customerId: "maya" }));
    await assertFails(setDoc(doc(admin(), "inventory/i1"), { stock: 999 }));
    await assertFails(setDoc(doc(admin(), "orders/BB-1"), { status: "shipped" }));
    // Nobody can add themselves to the team or invite themselves from the browser.
    await assertFails(setDoc(doc(maya(), "admins/maya"), { email: "maya@example.com" }));
    await assertFails(setDoc(doc(maya(), "admin_invites/maya@example.com"), { invitedBy: "maya" }));
    await assertFails(setDoc(doc(admin(), "admins/someone"), { email: "x@example.com" }));
  });
});
