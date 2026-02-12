# Security Comparison: Traditional E-Voting vs Blockchain + ZKP Design

## Scope
This document compares a traditional centralized e-voting model with this repository's implementation:
- Blockchain smart contracts for election state and tally publication.
- ElGamal homomorphic encryption on BabyJubJub for vote confidentiality.
- Groth16 ZKP for vote validity and tally correctness.
- Commitment-based Merkle audit bundle for voter-side inclusion checks.

## Comparison Matrix

| Dimension | Traditional Centralized E-Voting | This Project's Design | Evidence in Repo |
|---|---|---|---|
| Integrity of election state | Controlled by backend/database admins | Contract-enforced state machine (`Created -> Active -> Ended -> Tallied`) | `contracts/Voting.sol` |
| Ballot confidentiality | Usually DB encryption; operator trust required | Homomorphic ElGamal ciphertexts; plaintext not stored on-chain | `crypto/elgamal.py`, `frontend/lib/elgamal.js` |
| Vote validity | Server-side checks, hard to independently verify | ZKP1+ZKP2 checked on-chain before accepting vote | `circuits/vote_proof.circom`, `contracts/VoteVerifier.sol`, `contracts/Voting.sol` |
| Tally correctness | Admin/service computes tally off-chain | ZKP3 proves decryption/tally correctness before finalization | `circuits/tally_proof.circom`, `contracts/TallyVerifier.sol`, `contracts/Voting.sol` |
| Tamper resistance | DB mutation risk or privileged rollback | Immutable on-chain logs + contract constraints | `contracts/*.sol` |
| Auditability | Platform reports/log exports | Deterministic Merkle audit bundle over vote commitments | `frontend/lib/audit.js`, `frontend/admin.html` |
| Voter-side verification | Often account-based or unavailable | Receipt-based anonymous inclusion check (`candidateId + salt + commitment`) | `frontend/voting-app.html` |
| Single-point-of-failure risk | High (central backend infra) | Reduced for state/tally integrity; admin key still trust-sensitive | `contracts/Voting.sol`, `frontend/admin.html` |

## Practical Security Notes
- The implementation improves integrity and transparency versus centralized tallying.
- Privacy is stronger than address-based disclosure, but still depends on receipt secrecy.
- Admin key custody remains a critical trust component for tally workflow.
- Audit bundle ordering is deterministic (`blockNumber`, `txIndex`, `logIndex`), preventing proof ambiguity.

## Residual Risks and Limits
1. Admin key compromise can impact tally operations.
2. Client-side environments (browser extensions/malware) remain outside protocol guarantees.
3. Availability still depends on chain/network accessibility.
4. Current deployment is single-election-instance oriented; governance hardening is future work.

## Reproducibility Checklist
1. Run contract and crypto tests:
   - `cmd /c npx hardhat test`
   - `python -m pytest tests/ -q`
2. Run local flow and submit votes.
3. Execute tally in admin page and export `audit_bundle.json`.
4. Verify inclusion in voter page using receipt + audit bundle.
