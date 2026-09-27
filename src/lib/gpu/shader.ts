// WGSL compute shader: each invocation builds one candidate input, hashes it
// with SHA-256 (up to 4 blocks), and reports it when it beats the current best.
export const PREFIX_OFF = 0;
export const PREFIX_MAX = 96;
export const SUFFIX_OFF = 96;
export const SUFFIX_MAX = 64;
export const CHARSET_OFF = 160;
export const CHARSET_MAX = 128;
export const DIGITS_OFF = 288;
export const DATA_LEN = 312;
export const SLOT_WORDS = 65;
export const MAX_INPUT = 247;

export const SHA256_WGSL = /* wgsl */ `
struct Params {
  mode: u32, prefixLen: u32, suffixLen: u32, charsetLen: u32,
  minLen: u32, maxLen: u32, minWords: u32, maxWords: u32,
  sepLen: u32, sepByte: u32, seed: u32, digitCount: u32,
  resultCap: u32, wordCount: u32, pad0: u32, pad1: u32,
}
struct Results { count: atomic<u32>, data: array<u32> }

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> D: array<u32>;
@group(0) @binding(2) var<storage, read> WD: array<u32>;
@group(0) @binding(3) var<storage, read> BEST: array<u32, 8>;
@group(0) @binding(4) var<storage, read_write> R: Results;

const K = array<u32, 64>(
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
);

var<private> msg: array<u32, 64>;
var<private> mlen: u32;
var<private> rng: u32;

fn put(b: u32) {
  if (mlen < ${MAX_INPUT}u) {
    msg[mlen >> 2u] = msg[mlen >> 2u] | ((b & 0xffu) << (24u - 8u * (mlen & 3u)));
    mlen = mlen + 1u;
  }
}

fn rnd() -> u32 {
  rng = rng * 747796405u + 2891336453u;
  let w = ((rng >> ((rng >> 28u) + 4u)) ^ rng) * 277803737u;
  return (w >> 22u) ^ w;
}

fn rotr(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let id = gid.x;
  for (var i = 0u; i < 64u; i = i + 1u) { msg[i] = 0u; }
  mlen = 0u;
  rng = P.seed ^ (id * 2654435761u);
  _ = rnd();
  rng = rng ^ (id * 0x85ebca6bu);
  _ = rnd();

  for (var i = 0u; i < P.prefixLen; i = i + 1u) { put(D[${PREFIX_OFF}u + i]); }

  if (P.mode == 0u) {
    var dg: array<u32, 24>;
    let n = P.digitCount;
    for (var j = 0u; j < n; j = j + 1u) { dg[j] = D[${DIGITS_OFF}u + n - 1u - j]; }
    var carry = id;
    var j = 0u;
    loop {
      if (j >= 24u || (carry == 0u && j >= n)) { break; }
      let v = dg[j] + carry;
      dg[j] = v % 10u;
      carry = v / 10u;
      j = j + 1u;
    }
    let total = max(n, j);
    for (var k = 0u; k < total; k = k + 1u) { put(48u + dg[total - 1u - k]); }
  } else if (P.mode == 1u) {
    let L = P.minLen + rnd() % (P.maxLen - P.minLen + 1u);
    for (var k = 0u; k < L; k = k + 1u) { put(D[${CHARSET_OFF}u + rnd() % P.charsetLen]); }
  } else {
    let count = P.minWords + rnd() % (P.maxWords - P.minWords + 1u);
    let base = P.wordCount + 1u;
    for (var w = 0u; w < count; w = w + 1u) {
      if (w > 0u && P.sepLen > 0u) { put(P.sepByte); }
      let idx = rnd() % P.wordCount;
      let s = WD[idx];
      let e = WD[idx + 1u];
      for (var k = s; k < e; k = k + 1u) { put(WD[base + k]); }
    }
  }

  if (P.mode != 0u) {
    for (var i = 0u; i < P.suffixLen; i = i + 1u) { put(D[${SUFFIX_OFF}u + i]); }
  }

  let L = mlen;
  msg[L >> 2u] = msg[L >> 2u] | (0x80u << (24u - 8u * (L & 3u)));
  let blocks = (L + 9u + 63u) / 64u;
  msg[blocks * 16u - 1u] = L * 8u;

  var h = array<u32, 8>(0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
                        0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u);
  var w: array<u32, 64>;
  for (var b = 0u; b < blocks; b = b + 1u) {
    for (var t = 0u; t < 16u; t = t + 1u) { w[t] = msg[b * 16u + t]; }
    for (var t = 16u; t < 64u; t = t + 1u) {
      let x = w[t - 15u];
      let y = w[t - 2u];
      let s0 = rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u);
      let s1 = rotr(y, 17u) ^ rotr(y, 19u) ^ (y >> 10u);
      w[t] = w[t - 16u] + s0 + w[t - 7u] + s1;
    }
    var a = h[0]; var bb = h[1]; var c = h[2]; var d = h[3];
    var e = h[4]; var f = h[5]; var g = h[6]; var hh = h[7];
    for (var t = 0u; t < 64u; t = t + 1u) {
      let S1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
      let ch = (e & f) ^ (~e & g);
      let t1 = hh + S1 + ch + K[t] + w[t];
      let S0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
      let mj = (a & bb) ^ (a & c) ^ (bb & c);
      let t2 = S0 + mj;
      hh = g; g = f; f = e; e = d + t1;
      d = c; c = bb; bb = a; a = t1 + t2;
    }
    h[0] = h[0] + a; h[1] = h[1] + bb; h[2] = h[2] + c; h[3] = h[3] + d;
    h[4] = h[4] + e; h[5] = h[5] + f; h[6] = h[6] + g; h[7] = h[7] + hh;
  }

  var lower = false;
  for (var i = 0u; i < 8u; i = i + 1u) {
    if (h[i] < BEST[i]) { lower = true; break; }
    if (h[i] > BEST[i]) { break; }
  }
  if (!lower) { return; }

  let slot = atomicAdd(&R.count, 1u);
  if (slot >= P.resultCap) { return; }
  let base = slot * ${SLOT_WORDS}u;
  R.data[base] = L;
  let nw = (L + 3u) / 4u;
  for (var i = 0u; i < nw; i = i + 1u) { R.data[base + 1u + i] = msg[i]; }
}
`;
