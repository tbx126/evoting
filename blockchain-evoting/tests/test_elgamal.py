"""
Tests for BabyJubJub ElGamal encryption module.
Tests cover: curve arithmetic, key generation, encryption/decryption,
homomorphic addition, one-hot encoding, and discrete log solver.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from crypto.elgamal import (
    FIELD_PRIME, SUBGROUP_ORDER, GENERATOR, IDENTITY,
    BABYJUBJUB_A, BABYJUBJUB_D,
    point_add, point_neg, point_sub, scalar_mul,
    is_on_curve, point_eq,
    ElGamalKeyPair, ElGamalCiphertext,
    encrypt, decrypt, decrypt_to_point,
    homomorphic_add, encrypt_vote_onehot, homomorphic_tally,
    solve_dlog,
)


# ─── Curve Arithmetic Tests ─────────────────────────────────

class TestBabyJubJubCurve:

    def test_generator_on_curve(self):
        """Generator point must lie on BabyJubJub."""
        assert is_on_curve(GENERATOR)

    def test_identity_on_curve(self):
        """Identity point (0, 1) must lie on BabyJubJub."""
        assert is_on_curve(IDENTITY)

    def test_add_identity(self):
        """P + O = P for any point P."""
        result = point_add(GENERATOR, IDENTITY)
        assert point_eq(result, GENERATOR)

    def test_add_commutative(self):
        """P + Q = Q + P."""
        p = scalar_mul(7, GENERATOR)
        q = scalar_mul(13, GENERATOR)
        assert point_eq(point_add(p, q), point_add(q, p))

    def test_add_associative(self):
        """(P + Q) + R = P + (Q + R)."""
        p = scalar_mul(3, GENERATOR)
        q = scalar_mul(5, GENERATOR)
        r = scalar_mul(11, GENERATOR)
        lhs = point_add(point_add(p, q), r)
        rhs = point_add(p, point_add(q, r))
        assert point_eq(lhs, rhs)

    def test_double(self):
        """P + P = 2P."""
        double = point_add(GENERATOR, GENERATOR)
        two_g = scalar_mul(2, GENERATOR)
        assert point_eq(double, two_g)

    def test_negate(self):
        """P + (-P) = O."""
        neg_g = point_neg(GENERATOR)
        result = point_add(GENERATOR, neg_g)
        assert point_eq(result, IDENTITY)

    def test_subtract(self):
        """P - P = O."""
        result = point_sub(GENERATOR, GENERATOR)
        assert point_eq(result, IDENTITY)

    def test_scalar_mul_zero(self):
        """0 * G = O."""
        result = scalar_mul(0, GENERATOR)
        assert point_eq(result, IDENTITY)

    def test_scalar_mul_one(self):
        """1 * G = G."""
        result = scalar_mul(1, GENERATOR)
        assert point_eq(result, GENERATOR)

    def test_scalar_mul_order(self):
        """order * G = O (generator has the expected subgroup order)."""
        result = scalar_mul(SUBGROUP_ORDER, GENERATOR)
        assert point_eq(result, IDENTITY)

    def test_scalar_mul_distributive(self):
        """(a + b) * G = a*G + b*G."""
        a, b = 42, 58
        lhs = scalar_mul(a + b, GENERATOR)
        rhs = point_add(scalar_mul(a, GENERATOR), scalar_mul(b, GENERATOR))
        assert point_eq(lhs, rhs)

    def test_point_on_curve_after_operations(self):
        """Points remain on curve after arithmetic operations."""
        p = scalar_mul(12345, GENERATOR)
        assert is_on_curve(p)
        q = point_add(p, GENERATOR)
        assert is_on_curve(q)
        r = point_neg(p)
        assert is_on_curve(r)


# ─── Key Generation Tests ───────────────────────────────────

class TestKeyGeneration:

    def test_generate_keypair(self):
        """Generated key pair should have valid pk on curve."""
        kp = ElGamalKeyPair.generate()
        assert 1 <= kp.sk < SUBGROUP_ORDER
        assert is_on_curve(kp.pk)
        assert point_eq(kp.pk, scalar_mul(kp.sk, GENERATOR))

    def test_from_sk(self):
        """Derive key pair from known secret key."""
        sk = 42
        kp = ElGamalKeyPair.from_sk(sk)
        assert kp.sk == 42
        assert point_eq(kp.pk, scalar_mul(42, GENERATOR))

    def test_serialization(self):
        """Key pair round-trips through dict serialization."""
        kp = ElGamalKeyPair.generate()
        d = kp.to_dict()
        kp2 = ElGamalKeyPair.from_dict(d)
        assert kp.sk == kp2.sk
        assert point_eq(kp.pk, kp2.pk)


# ─── Encryption / Decryption Tests ──────────────────────────

class TestEncryptDecrypt:

    def setup_method(self):
        self.kp = ElGamalKeyPair.from_sk(12345)

    def test_encrypt_decrypt_zero(self):
        """Encrypt and decrypt 0."""
        ct = encrypt(0, self.kp.pk)
        assert decrypt(ct, self.kp.sk) == 0

    def test_encrypt_decrypt_one(self):
        """Encrypt and decrypt 1."""
        ct = encrypt(1, self.kp.pk)
        assert decrypt(ct, self.kp.sk) == 1

    def test_encrypt_decrypt_small(self):
        """Encrypt and decrypt small values."""
        for m in [0, 1, 2, 5, 10, 42, 100]:
            ct = encrypt(m, self.kp.pk)
            assert decrypt(ct, self.kp.sk) == m

    def test_deterministic_with_randomness(self):
        """Same randomness produces same ciphertext."""
        r = 99999
        ct1 = encrypt(1, self.kp.pk, randomness=r)
        ct2 = encrypt(1, self.kp.pk, randomness=r)
        assert point_eq(ct1.c1, ct2.c1)
        assert point_eq(ct1.c2, ct2.c2)

    def test_different_randomness_different_ciphertext(self):
        """Different randomness produces different ciphertext for same message."""
        ct1 = encrypt(1, self.kp.pk, randomness=111)
        ct2 = encrypt(1, self.kp.pk, randomness=222)
        assert not point_eq(ct1.c1, ct2.c1)

    def test_ciphertext_points_on_curve(self):
        """Ciphertext points must lie on BabyJubJub."""
        ct = encrypt(5, self.kp.pk)
        assert is_on_curve(ct.c1)
        assert is_on_curve(ct.c2)

    def test_decrypt_to_point(self):
        """decrypt_to_point returns m*G."""
        ct = encrypt(3, self.kp.pk)
        m_g = decrypt_to_point(ct, self.kp.sk)
        expected = scalar_mul(3, GENERATOR)
        assert point_eq(m_g, expected)


# ─── Homomorphic Addition Tests ──────────────────────────────

class TestHomomorphicAdd:

    def setup_method(self):
        self.kp = ElGamalKeyPair.from_sk(54321)

    def test_add_two_ciphertexts(self):
        """E(a) + E(b) decrypts to a + b."""
        ct1 = encrypt(3, self.kp.pk)
        ct2 = encrypt(7, self.kp.pk)
        ct_sum = homomorphic_add([ct1, ct2])
        assert decrypt(ct_sum, self.kp.sk) == 10

    def test_add_multiple(self):
        """Sum of several encryptions."""
        values = [1, 2, 3, 4, 5]
        cts = [encrypt(v, self.kp.pk) for v in values]
        ct_sum = homomorphic_add(cts)
        assert decrypt(ct_sum, self.kp.sk) == 15

    def test_add_zeros(self):
        """Sum of zeros is zero."""
        cts = [encrypt(0, self.kp.pk) for _ in range(5)]
        ct_sum = homomorphic_add(cts)
        assert decrypt(ct_sum, self.kp.sk) == 0

    def test_add_single(self):
        """Adding a single ciphertext returns the same value."""
        ct = encrypt(42, self.kp.pk)
        ct_sum = homomorphic_add([ct])
        assert decrypt(ct_sum, self.kp.sk) == 42

    def test_add_empty_raises(self):
        """Adding empty list should raise."""
        with pytest.raises(ValueError):
            homomorphic_add([])


# ─── One-Hot Vote Encoding Tests ─────────────────────────────

class TestOneHotVoting:

    def setup_method(self):
        self.kp = ElGamalKeyPair.from_sk(99999)

    def test_onehot_encoding_3_candidates(self):
        """One-hot for 3 candidates: vote for candidate 1 → [0, 1, 0]."""
        cts = encrypt_vote_onehot(1, 3, self.kp.pk)
        assert len(cts) == 3
        assert decrypt(cts[0], self.kp.sk) == 0
        assert decrypt(cts[1], self.kp.sk) == 1
        assert decrypt(cts[2], self.kp.sk) == 0

    def test_onehot_first_candidate(self):
        """Vote for candidate 0."""
        cts = encrypt_vote_onehot(0, 3, self.kp.pk)
        assert decrypt(cts[0], self.kp.sk) == 1
        assert decrypt(cts[1], self.kp.sk) == 0
        assert decrypt(cts[2], self.kp.sk) == 0

    def test_onehot_last_candidate(self):
        """Vote for last candidate."""
        cts = encrypt_vote_onehot(2, 3, self.kp.pk)
        assert decrypt(cts[0], self.kp.sk) == 0
        assert decrypt(cts[1], self.kp.sk) == 0
        assert decrypt(cts[2], self.kp.sk) == 1

    def test_onehot_invalid_candidate(self):
        """Out-of-range candidate ID should raise."""
        with pytest.raises(ValueError):
            encrypt_vote_onehot(3, 3, self.kp.pk)
        with pytest.raises(ValueError):
            encrypt_vote_onehot(-1, 3, self.kp.pk)

    def test_onehot_with_randomness(self):
        """Providing explicit randomness works."""
        r_list = [111, 222, 333]
        cts = encrypt_vote_onehot(0, 3, self.kp.pk, randomness_list=r_list)
        assert decrypt(cts[0], self.kp.sk) == 1

    def test_onehot_wrong_randomness_length(self):
        """Mismatched randomness list length should raise."""
        with pytest.raises(ValueError):
            encrypt_vote_onehot(0, 3, self.kp.pk, randomness_list=[1, 2])


# ─── Full Tally Tests ────────────────────────────────────────

class TestHomomorphicTally:

    def setup_method(self):
        self.kp = ElGamalKeyPair.from_sk(77777)

    def test_tally_single_vote(self):
        """Tally a single vote."""
        vote = encrypt_vote_onehot(1, 3, self.kp.pk)
        results = homomorphic_tally([vote], 3, self.kp.sk)
        assert results == [0, 1, 0]

    def test_tally_multiple_votes(self):
        """Tally 5 votes across 3 candidates."""
        # 2 votes for candidate 0, 2 for candidate 1, 1 for candidate 2
        votes = [
            encrypt_vote_onehot(0, 3, self.kp.pk),
            encrypt_vote_onehot(1, 3, self.kp.pk),
            encrypt_vote_onehot(0, 3, self.kp.pk),
            encrypt_vote_onehot(2, 3, self.kp.pk),
            encrypt_vote_onehot(1, 3, self.kp.pk),
        ]
        results = homomorphic_tally(votes, 3, self.kp.sk)
        assert results == [2, 2, 1]

    def test_tally_all_same_candidate(self):
        """All votes for the same candidate."""
        votes = [encrypt_vote_onehot(0, 3, self.kp.pk) for _ in range(10)]
        results = homomorphic_tally(votes, 3, self.kp.sk)
        assert results == [10, 0, 0]

    def test_tally_empty(self):
        """Empty vote list returns zeros."""
        results = homomorphic_tally([], 3, self.kp.sk)
        assert results == [0, 0, 0]


# ─── Discrete Log Solver Tests ───────────────────────────────

class TestDLogSolver:

    def test_solve_zero(self):
        """solve_dlog(O) = 0."""
        assert solve_dlog(IDENTITY) == 0

    def test_solve_small_values(self):
        """solve_dlog(m*G) = m for small m."""
        for m in [1, 2, 5, 10, 50, 100]:
            point = scalar_mul(m, GENERATOR)
            assert solve_dlog(point, max_value=200) == m

    def test_solve_boundary(self):
        """solve_dlog at the boundary of max_value."""
        m = 100
        point = scalar_mul(m, GENERATOR)
        assert solve_dlog(point, max_value=100) == m

    def test_solve_not_found(self):
        """Value beyond max_value should raise."""
        point = scalar_mul(200, GENERATOR)
        with pytest.raises(ValueError):
            solve_dlog(point, max_value=50)


# ─── Ciphertext Serialization Tests ──────────────────────────

class TestCiphertextFlat:

    def test_to_flat(self):
        """to_flat returns [c1x, c1y, c2x, c2y]."""
        kp = ElGamalKeyPair.from_sk(42)
        ct = encrypt(1, kp.pk, randomness=123)
        flat = ct.to_flat()
        assert len(flat) == 4
        assert flat[0] == ct.c1[0]
        assert flat[1] == ct.c1[1]
        assert flat[2] == ct.c2[0]
        assert flat[3] == ct.c2[1]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
