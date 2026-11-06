# Media attachments
- [x] Record saved media references and protect in-flight saves from cleanup.
- [x] Add authenticated hourly cleanup for unlinked uploads older than 24 hours.
- [x] Test cleanup age/reference rules, authenticated callback and scheduling configuration.
- [x] Add browser uploads, previews, crop/resize and validation.
- [x] Connect verified Buffer post/idea media inputs and cleanup; retain saved files per user decision.
- [x] Verify rules, signed-in validation UI and live private-bucket size/ownership protections.
- [ ] Verify public upload → crop/resize → Buffer save end-to-end (blocked by public-bucket restriction).
- [ ] Enable public media bucket (blocked by workspace public-bucket policy; owner action required).