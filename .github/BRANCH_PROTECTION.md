# Branch Protection Rules

Configure these rules in **GitHub Settings > Branches > Branch protection rules**.

## `main` branch

| Setting | Value |
|---------|-------|
| Require a pull request before merging | Yes |
| Required approvals | 1 |
| Dismiss stale PR approvals when new commits are pushed | Yes |
| Require status checks to pass before merging | Yes |
| Required status checks | `Build`, `TypeScript Check`, `Tests` |
| Require branches to be up to date before merging | Yes |
| Restrict who can push to matching branches | Only admins / release bot |
| Allow force pushes | No |
| Allow deletions | No |

## `develop` branch

| Setting | Value |
|---------|-------|
| Require a pull request before merging | Yes |
| Required approvals | 1 |
| Require status checks to pass before merging | Yes |
| Required status checks | `Build`, `TypeScript Check`, `Tests` |
| Require branches to be up to date before merging | Yes |
| Allow force pushes | No |
| Allow deletions | No |

## Branch Workflow

```
feature/* ──> develop ──> main ──> tag v*.*.* ──> npm publish
hotfix/*  ──> main (direct, for urgent fixes)
hotfix/*  ──> develop (backport after merge to main)
```

### Feature Development
1. Create `feature/my-feature` from `develop`
2. Open PR to `develop`
3. CI runs: build + typecheck + tests
4. Merge after review + CI passes

### Release
1. Open PR from `develop` to `main`
2. CI runs on the PR
3. Merge to `main`
4. Create a tag `v0.X.Y` on `main`
5. Publish workflow triggers automatically -> all packages published to npm

### Hotfix
1. Create `hotfix/fix-description` from `main`
2. Open PR to `main`
3. Merge after review + CI
4. Tag + release as needed
5. Backport: cherry-pick or merge `main` back into `develop`
