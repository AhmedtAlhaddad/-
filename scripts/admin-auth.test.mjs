import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const auth = read("src/lib/admin/auth.ts");
const login = read("src/app/api/admin/login/route.ts");
const loginPage = read("src/components/admin/admin-login.tsx");
const shell = read("src/components/admin/admin-shell.tsx");
const proxy = read("src/proxy.ts");

const apiRoutes = [
  "src/app/api/admin/products/route.ts",
  "src/app/api/admin/products/[id]/route.ts",
  "src/app/api/admin/inventory/adjust/route.ts",
  "src/app/api/admin/catalog-taxonomy/[kind]/route.ts",
  "src/app/api/admin/catalog/revalidate/route.ts",
  "src/app/api/admin/athletes/route.ts",
  "src/app/api/admin/discounts/route.ts",
  "src/app/api/admin/commissions/payout/route.ts",
  "src/app/api/admin/orders/status/route.ts",
].map(read);

test("admin gate is signed, HttpOnly, and exactly twelve hours", () => {
  assert.match(auth, /createHmac\("sha256"/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /ADMIN_GATE_MAX_AGE_SECONDS = 12 \* 60 \* 60/);
  assert.match(auth, /httpOnly: true/);
  assert.match(auth, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(auth, /sameSite: "lax"/);
  assert.match(auth, /path: "\/"/);
  assert.match(auth, /expiresAt - issuedAt === ADMIN_GATE_MAX_AGE_SECONDS/);
  assert.match(auth, /Math\.floor\(now \/ 1000\) < expiresAt/);
  assert.doesNotMatch(auth, /maxAge:.*now/);
});

test("gate verification binds the session to the Supabase user and rejects tampering", () => {
  assert.match(auth, /gate\.sub === userId/);
  assert.match(auth, /providedBuffer/);
  assert.match(auth, /JSON\.parse\(decode\(payload\)\)/);
  assert.match(auth, /catch \{\s*return false;/s);
});

test("login authenticates email directly and creates the gate only after active admin checks", () => {
  assert.match(login, /const email = text\(payload\.email\)/);
  assert.match(login, /signInWithPassword\(/);
  assert.match(login, /email,\s*password/s);
  assert.match(login, /profile\.role !== "admin"/);
  assert.match(login, /profile\.active !== true/);
  assert.match(login, /createAdminGateToken\(userId\)/);
  assert.doesNotMatch(loginPage, /signInWithPassword/);
  assert.match(loginPage, /type="email"/);
  assert.match(loginPage, /autoComplete="email"/);
  assert.doesNotMatch(login, /ADMIN_LOGIN_EMAIL|ADMIN_LOGIN_USERNAME/);
  assert.doesNotMatch(loginPage, /اسم المستخدم/);
});

test("all Admin APIs use the centralized gate authorization", () => {
  for (const route of apiRoutes) {
    assert.match(route, /authorizeAdminApi/);
  }
  assert.match(auth, /response\.cookies\.delete\(ADMIN_GATE_COOKIE\)/);
});

test("logout clears both server sessions", () => {
  assert.match(shell, /fetch\("\/api\/admin\/logout"/);
  const logout = read("src/app/api/admin/logout/route.ts");
  assert.match(logout, /clearAdminSession/);
  assert.match(auth, /supabase\.auth\.signOut\(\)/);
  assert.match(auth, /maxAge: 0/);
});

test("return paths are restricted to internal Admin URLs", () => {
  assert.match(auth, /value === "\/admin" \|\| value\.startsWith\("\/admin\/"\)/);
  assert.match(auth, /value\.startsWith\("\/\/"\)/);
  assert.match(auth, /value\.includes\("\\\\"\)/);
});

test("pages use the centralized Admin requirement", () => {
  const pageSources = [
    "src/app/admin/page.tsx",
    "src/app/admin/products/page.tsx",
    "src/app/admin/inventory/page.tsx",
    "src/app/admin/orders/page.tsx",
    "src/app/admin/commissions/page.tsx",
  ].map(read);

  for (const page of pageSources) {
    assert.match(page, /requireAdmin/);
  }
});

test("the request proxy clears an invalid page gate before rendering Admin", () => {
  assert.match(proxy, /verifyAdminGateToken/);
  assert.match(proxy, /pathname === "\/admin"/);
  assert.match(proxy, /NextResponse\.redirect\(loginUrl\)/);
  assert.match(proxy, /response\.cookies\.delete\(ADMIN_GATE_COOKIE\)/);
});
