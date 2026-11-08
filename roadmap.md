# Dashboard sidebar integration
- [x] Replace Dashboard automatic Buffer loading with a durable owner-only snapshot and explicit locked refresh; verify snapshot/cooldown/request rules with tests.
- [ ] Verify Dashboard snapshot/refresh visually on signed-in desktop/mobile; blocked because preview cannot mint a session for the requesting account.
- [x] Adapt the uploaded sidebar using existing Synora navigation and account actions.
- [x] Add a Drafts destination to the sidebar that opens Buffer drafts with edit/delete.
- [x] Verify navigation/sign-out callbacks and routing tests; signed-out desktop/mobile redirects have no overflow.
- [ ] Verify signed-in desktop collapse and mobile drawer visually; blocked because preview session minting cannot match the requesting account. User must sign in through the preview.
# Media attachments
# Landing-page channel folder
- [x] Integrate the reusable folder with existing platform marks and verify interaction, reduced motion and mobile fit without service calls.
# Magic Photo / Photo to Post
- [x] Add Photo to Post (vision caption + 3-5 hashtags) and Magic Photo (Clean/Warm/Bright/Calm edits) to New post.
- [x] Separate daily limits (10 captions, 5 edits) with usage display and friendly limit messages.
- [x] Verify both gateway calls live; UI not preview-tested (Buffer connection expired in preview).
# Sign-in rate-limit wait
- [x] Verify documented seconds conversion, wait thresholds and countdown lockout without changing Buffer routes.

- [x] Record saved media references and protect in-flight saves from cleanup.
- [x] Add authenticated hourly cleanup for unlinked uploads older than 24 hours.
- [x] Test cleanup age/reference rules, authenticated callback and scheduling configuration.
- [x] Add browser uploads, previews, crop/resize and validation.
- [x] Connect verified Buffer post/idea media inputs and cleanup; retain saved files per user decision.
- [x] Verify rules, signed-in validation UI and live private-bucket size/ownership protections.
- [x] Verify public upload, crop/resize, public URL access and removal; Buffer saving was not exercised during the upload-only check.
- [x] Enable public media bucket, retaining owner-scoped policies and the 10 MB limit.
- [x] Add per-channel media limits (strictest wins, no image/video mixing), live limit display and server enforcement.
- [x] Add browser image compression (1440 px, ~80% quality) and 100 MB per-user storage quota with server enforcement.
- [x] Extend hourly cleanup: delete files of sent posts after 7 days and files of deleted drafts; bucket limit raised to 20 MB.