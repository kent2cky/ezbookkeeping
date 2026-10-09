# Test and deploy checklist

Production deploys when `main` is pushed (`.github/workflows/deploy.yml`): it builds the image, then asks Render to deploy it.
The new features live on the branch `feature/ext-staff-inventory`; merge it into `main` to ship them. Do these in order.

## 1. Before merging
- [ ] `legal/details.json` is filled in (`python3 scripts/build-legal.py --check --strict` passes). The deploy fails without it.
- [ ] Read `public/legal/terms.html` and `privacy.html` in a browser; send them to a lawyer if you can.
- [ ] Render dashboard: `EBK_SECURITY_TRUSTED_PROXY_IPS` is the long value from `scripts/trusted-proxies.sh` (already confirmed working).
- [ ] Render dashboard: SES SMTP user and password are the rotated pair; host `email-smtp.eu-north-1.amazonaws.com:2587`.
- [ ] The S3 bucket has versioning on and a lifecycle rule that deletes non-current versions after 30 days.
- [ ] Run `scripts/restore-drill.sh` and keep its output: it shows the state of the backup before you change anything.

## 2. Test locally (about 15 minutes)
Start the app on your own machine with `scripts/run-local.sh bg` (rebuild first with `scripts/run-local.sh rebuild` after changing code), open
http://localhost:8080, and stop it with `scripts/run-local.sh stop`. Run the script with no argument to see all commands.

1. `python3 scripts/ext-smoke.py` against your local server must end with `0 failure(s)`, and `scripts/browser-smoke.sh` with `BROWSER CHECK PASSED`
   (the first tests the server, the second that the pages really start in a browser; after `rebuild`, run `python3 scripts/check-bundle.py` too).
2. In a browser, with a fresh account: sign up, see the notice with the two links, open both pages, log in, accept the terms in the box.
3. Settings > Business Features: switch on, fill in Receipt details, download the business data and open a few files in a spreadsheet.
4. Add an item and stock, make a cash sale and a credit sale, print a receipt (and try Save as PDF), record a repayment.
5. Invite a second account as staff, accept in a private window, and check the staff cannot void a sale or see reports.
6. On a phone: login screen shows the notice, the sale screen and a receipt look right.

## 3. Deploy
- [ ] Merge to `main` and push. Watch the GitHub Actions run (the legal check is the first step) and then the Render deploy.
- [ ] Open the live site in a private window: the login screen must appear. Then run `scripts/browser-smoke.sh https://book.vmerlabs.com`; it opens the
  desktop and mobile screens in a real browser and must say BROWSER CHECK PASSED. (Browsers that already visited may keep the old files; a hard
  refresh, Ctrl+Shift+R, or Application > Storage > Clear site data fixes that.)
- [ ] Accept the terms with your own account and check that the legal links work.
- [ ] Add one transaction, wait about ten seconds, run `scripts/restore-drill.sh`: "last change copied to S3" should be the current time.
  After a day, `snapshots` should show a new snapshot each 24 hours, and the first week of history builds up from now.
- [ ] Use "Forget password" on the live site with a verified address (SES is still in sandbox, so every pilot customer's address must be verified in SES first).
- [ ] Check the Render log: login lines show visitors' own addresses.

## 4. If something goes wrong
- The app starts from the last database copy in S3, so a bad deploy can be rolled back in Render without losing data written before it.
- To go back to an earlier moment: `DRILL_AS_OF=<UTC time> scripts/restore-drill.sh` shows what the data looked like then.
- Tables are only ever added or extended by the upgrade step, never dropped, so an older version of the app still starts on a newer database.

## Known gaps you accept by deploying now
No self-service account deletion; "Clear All Transactions" leaves business records (sales, balances) in place; legal wording is generic and its company name is to be confirmed; free hosting (cold starts, one instance).
See `docs/LEGAL.md`, `docs/BACKUP.md`, `docs/OPERATIONS.md` and `docs/EXTENSIONS.md`.
