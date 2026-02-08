"""
BabyJubJub ElGamal 加密模块
ElGamal encryption on BabyJubJub curve for ZK-friendly homomorphic voting.

BabyJubJub curve: ax² + y² = 1 + dx²y²
  a = 168700, d = 168696
  Defined over the BN254 scalar field (Fr)
  Order ≈ 2^251

This module implements:
  - BabyJubJub curve arithmetic (point addition, scalar multiplication)
  - Exponential ElGamal encryption/decryption
  - Additive homomorphism for vote tallying
  - Baby-step Giant-step discrete log solver
  - One-hot vote encoding
"""

import secrets
import math


# BN254 scalar field prime (also the base field of BabyJubJub)
FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617

# BabyJubJub curve parameters (Montgomery form: ax² + y² = 1 + dx²y²)
BABYJUBJUB_A = 168700
BABYJUBJUB_D = 168696

# Subgroup order (order of the generator point)
SUBGROUP_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041

# Generator point (same as circomlib's Base8)
GENERATOR = (
    5299619240641551281634865583518297030282874472190772894086521144482721001553,
    16950150798460657717958625567821834550301663161624707787222815936182638968203
)

# Identity point (point at infinity for twisted Edwards curves)
IDENTITY = (0, 1)


def _mod_inv(a, p):
    """Modular inverse using extended Euclidean algorithm."""
    if a == 0:
        raise ValueError("Cannot invert zero")
    a = a % p
    g, x, _ = _extended_gcd(a, p)
    if g != 1:
        raise ValueError("Modular inverse does not exist")
    return x % p


def _extended_gcd(a, b):
    """Extended Euclidean algorithm. Returns (gcd, x, y) where ax + by = gcd."""
    if a == 0:
        return b, 0, 1
    g, x, y = _extended_gcd(b % a, a)
    return g, y - (b // a) * x, x


def point_add(p1, p2):
    """
    Add two points on the BabyJubJub curve.
    Uses the twisted Edwards addition formula:
      x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2)
      y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2)
    """
    x1, y1 = p1
    x2, y2 = p2
    p = FIELD_PRIME
    a = BABYJUBJUB_A
    d = BABYJUBJUB_D

    x1x2 = (x1 * x2) % p
    y1y2 = (y1 * y2) % p
    dx1x2y1y2 = (d * x1x2 % p * y1y2) % p

    x3_num = (x1 * y2 + y1 * x2) % p
    x3_den = (1 + dx1x2y1y2) % p
    x3 = (x3_num * _mod_inv(x3_den, p)) % p

    y3_num = (y1y2 - a * x1x2) % p
    y3_den = (1 - dx1x2y1y2) % p
    y3 = (y3_num * _mod_inv(y3_den, p)) % p

    return (x3, y3)


def point_neg(point):
    """Negate a point on BabyJubJub: -(x, y) = (-x, y)."""
    x, y = point
    return (FIELD_PRIME - x if x != 0 else 0, y)


def point_sub(p1, p2):
    """Subtract p2 from p1: p1 - p2 = p1 + (-p2)."""
    return point_add(p1, point_neg(p2))


def scalar_mul(scalar, point):
    """
    Scalar multiplication using double-and-add.
    Returns scalar * point on BabyJubJub.
    """
    scalar = scalar % SUBGROUP_ORDER
    if scalar == 0:
        return IDENTITY

    result = IDENTITY
    current = point

    while scalar > 0:
        if scalar & 1:
            result = point_add(result, current)
        current = point_add(current, current)
        scalar >>= 1

    return result


def is_on_curve(point):
    """Check if a point lies on the BabyJubJub curve."""
    x, y = point
    p = FIELD_PRIME
    a = BABYJUBJUB_A
    d = BABYJUBJUB_D

    x2 = (x * x) % p
    y2 = (y * y) % p
    lhs = (a * x2 + y2) % p
    rhs = (1 + d * x2 % p * y2) % p
    return lhs == rhs


def point_eq(p1, p2):
    """Check if two points are equal."""
    return p1[0] == p2[0] and p1[1] == p2[1]


class ElGamalKeyPair:
    """ElGamal key pair on BabyJubJub."""

    def __init__(self, sk, pk):
        self.sk = sk  # Secret key (scalar)
        self.pk = pk  # Public key (point)

    @staticmethod
    def generate():
        """Generate a random ElGamal key pair."""
        sk = secrets.randbelow(SUBGROUP_ORDER - 1) + 1  # sk in [1, order-1]
        pk = scalar_mul(sk, GENERATOR)
        return ElGamalKeyPair(sk, pk)

    @staticmethod
    def from_sk(sk):
        """Derive key pair from a known secret key."""
        pk = scalar_mul(sk, GENERATOR)
        return ElGamalKeyPair(sk, pk)

    def to_dict(self):
        """Serialize key pair to dictionary."""
        return {
            "sk": str(self.sk),
            "pk": [str(self.pk[0]), str(self.pk[1])]
        }

    @staticmethod
    def from_dict(data):
        """Deserialize key pair from dictionary."""
        sk = int(data["sk"])
        pk = (int(data["pk"][0]), int(data["pk"][1]))
        return ElGamalKeyPair(sk, pk)


class ElGamalCiphertext:
    """An ElGamal ciphertext (C1, C2) where C1 and C2 are BabyJubJub points."""

    def __init__(self, c1, c2):
        self.c1 = c1  # r * G
        self.c2 = c2  # m * G + r * PK

    def __repr__(self):
        return f"ElGamalCiphertext(c1={self.c1}, c2={self.c2})"

    def to_flat(self):
        """Flatten to [c1x, c1y, c2x, c2y] for hashing/serialization."""
        return [self.c1[0], self.c1[1], self.c2[0], self.c2[1]]


def encrypt(message, pk, randomness=None):
    """
    Exponential ElGamal encryption.
    Encrypts integer m as m*G (maps message to curve point).

    E(m, r) = (r*G, m*G + r*PK)

    Args:
        message: Integer to encrypt (typically 0 or 1 for voting)
        pk: Public key point (on BabyJubJub)
        randomness: Optional fixed randomness for deterministic encryption

    Returns:
        ElGamalCiphertext
    """
    if randomness is None:
        randomness = secrets.randbelow(SUBGROUP_ORDER - 1) + 1

    c1 = scalar_mul(randomness, GENERATOR)  # r * G
    r_pk = scalar_mul(randomness, pk)        # r * PK
    m_g = scalar_mul(message, GENERATOR)     # m * G
    c2 = point_add(m_g, r_pk)               # m*G + r*PK

    return ElGamalCiphertext(c1, c2)


def decrypt_to_point(ciphertext, sk):
    """
    Decrypt an ElGamal ciphertext to the message point m*G.

    m*G = C2 - sk*C1

    Args:
        ciphertext: ElGamalCiphertext
        sk: Secret key scalar

    Returns:
        Point m*G on BabyJubJub
    """
    sk_c1 = scalar_mul(sk, ciphertext.c1)  # sk * C1
    m_g = point_sub(ciphertext.c2, sk_c1)  # C2 - sk*C1
    return m_g


def decrypt(ciphertext, sk, max_value=10000):
    """
    Decrypt an ElGamal ciphertext to recover the integer message.
    Uses baby-step giant-step to solve the discrete log m*G → m.

    Args:
        ciphertext: ElGamalCiphertext
        sk: Secret key scalar
        max_value: Maximum expected message value

    Returns:
        Integer message m
    """
    m_g = decrypt_to_point(ciphertext, sk)
    return solve_dlog(m_g, max_value)


def solve_dlog(point, max_value=10000):
    """
    Baby-step Giant-step algorithm to solve m*G = point for m.

    Works for m in range [0, max_value].
    Time complexity: O(sqrt(max_value))
    Space complexity: O(sqrt(max_value))

    Args:
        point: Target point m*G
        max_value: Maximum value to search

    Returns:
        Integer m such that m*G = point

    Raises:
        ValueError: If no solution found in range
    """
    # Check identity (m = 0)
    if point_eq(point, IDENTITY):
        return 0

    step_size = int(math.isqrt(max_value)) + 1

    # Baby steps: compute j*G for j = 0, 1, ..., step_size-1
    baby_steps = {}
    current = IDENTITY
    for j in range(step_size):
        baby_steps[current] = j
        current = point_add(current, GENERATOR)

    # Giant step: -step_size * G
    giant_step = point_neg(scalar_mul(step_size, GENERATOR))

    # Giant steps: check point - i*step_size*G for i = 0, 1, ...
    current = point
    for i in range(step_size + 1):
        if current in baby_steps:
            m = i * step_size + baby_steps[current]
            if m <= max_value:
                return m
        current = point_add(current, giant_step)

    raise ValueError(f"Discrete log not found in range [0, {max_value}]")


def homomorphic_add(ciphertexts):
    """
    Homomorphically add a list of ElGamal ciphertexts.
    E(a) ⊕ E(b) = (C1_a + C1_b, C2_a + C2_b) = E(a + b)

    Args:
        ciphertexts: List of ElGamalCiphertext

    Returns:
        ElGamalCiphertext representing the sum
    """
    if not ciphertexts:
        raise ValueError("Cannot add empty list of ciphertexts")

    result_c1 = ciphertexts[0].c1
    result_c2 = ciphertexts[0].c2

    for ct in ciphertexts[1:]:
        result_c1 = point_add(result_c1, ct.c1)
        result_c2 = point_add(result_c2, ct.c2)

    return ElGamalCiphertext(result_c1, result_c2)


def encrypt_vote_onehot(candidate_id, num_candidates, pk, randomness_list=None):
    """
    Encrypt a vote as a one-hot vector using ElGamal.

    For candidate_id=1 with 3 candidates:
      plaintext: [0, 1, 0]
      encrypted: [E(0, r0), E(1, r1), E(0, r2)]

    Args:
        candidate_id: Index of chosen candidate (0-based)
        num_candidates: Total number of candidates
        pk: ElGamal public key point
        randomness_list: Optional list of randomness values

    Returns:
        List of ElGamalCiphertext, one per candidate position
    """
    if candidate_id < 0 or candidate_id >= num_candidates:
        raise ValueError(f"candidate_id {candidate_id} out of range [0, {num_candidates})")

    if randomness_list is None:
        randomness_list = [secrets.randbelow(SUBGROUP_ORDER - 1) + 1
                           for _ in range(num_candidates)]

    if len(randomness_list) != num_candidates:
        raise ValueError("randomness_list length must match num_candidates")

    ciphertexts = []
    for i in range(num_candidates):
        m = 1 if i == candidate_id else 0
        ct = encrypt(m, pk, randomness_list[i])
        ciphertexts.append(ct)

    return ciphertexts


def homomorphic_tally(all_votes, num_candidates, sk, max_votes=10000):
    """
    Tally votes using homomorphic addition and decryption.

    Args:
        all_votes: List of vote vectors (each is a list of ElGamalCiphertext)
        num_candidates: Number of candidates
        sk: Admin secret key for decryption
        max_votes: Maximum expected votes per candidate

    Returns:
        List of vote counts per candidate
    """
    if not all_votes:
        return [0] * num_candidates

    # Aggregate column-wise
    aggregated = []
    for j in range(num_candidates):
        column = [vote[j] for vote in all_votes]
        aggregated.append(homomorphic_add(column))

    # Decrypt each aggregated ciphertext
    results = []
    for ct in aggregated:
        count = decrypt(ct, sk, max_votes)
        results.append(count)

    return results
