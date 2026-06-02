# Security Specification for Personal Wallet Tracker Firestore Rules

This document outlines the data invariants and access controls implemented in `firestore.rules` to ensure secure, isolated tenant storage for each user.

## Data Invariants & Authorization Requirements
1. **User Isolation**: A user (`request.auth.uid`) can only read, create, update, or delete their own documents. Accessing any data belonging to another user's subcollections under `/users/{differentUserId}` must be strictly rejected.
2. **Strict Document ID Rules**: All resource IDs must conform to alphanumeric constraints.
3. **No Blind/Blanket Reads**: Collection queries must enforce `resource.data.userId == request.auth.uid`.
4. **Temporal Integrity**: Fields like `updatedAt` should match `request.time`.

## The Dirty Dozen Payloads (Intrusions to Block)
1. **Malicious Read Spill**: Reading transactions of another user (`/users/otherUser123/transactions/tx-1`) as `auth.uid = 'alice'`.
2. **Identity Spoofing**: Inserting a transaction where `incoming().userId` is `bob` but `auth.uid` is `alice`.
3. **Ghost Field Injection**: Adding an unmapped high-privilege property `isAdmin: true` onto a profile.
4. **State Shortcutting**: Transitioning a settlement status or debt amount backwards or bypass.
5. **ID Poisoning Attack**: Trying to inject `../junk/otherid` or a 1.2KB string into a document path.
6. **Denial of Wallet Excursions**: Creating extremely large amounts with infinite strings.
7. **Negative Balance or Transaction Amounts**: Creating transactions with negative amount values.
8. **Immutability Bypass**: Changing the `id`, `userId` or `createdAt` of a historical transaction.
9. **Account Balance Poisoning**: Directly setting high balance values without updates.
10. **Orphaned Write Attack**: Creating transactions with dummy non-existent accounts.
11. **Spoofed Email Access**: Accessing private documents with an unverified email token.
12. **System Config Tampering**: Overwriting system properties inside the profile record.

All are strictly checked and rejected by the helper methods in our `firestore.rules`.
