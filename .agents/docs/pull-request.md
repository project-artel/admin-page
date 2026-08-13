# Pull Request Workflow

## Why

PR should let reviewer understand intent, verify evidence, and identify risk without reconstructing development history.

## Before Opening

- Confirm acceptance criteria from the Jira issue or the user request.
- Update plan to reflect final implementation.
- Review full diff against default branch.
- Remove debug code and unrelated churn.
- Run required validation.
- Confirm migrations, configuration, and rollback needs.

## Language

Write the pull request title and body in Korean. Reviewers read Korean; the
commit history stays in English.

Keep verbatim in English regardless: the Conventional Commit type prefix, code
identifiers, file paths, commands, log output, error strings, and section
headings from the body template below.

## Title

Use Conventional Commit format, with the summary in Korean:

```text
<type>(<optional-scope>): <요약>
```

## Assignee and Labels

Every PR carries an assignee and exactly one type label. Set both when opening
the PR rather than leaving them for review time.

- Assignee: the PR author, unless another person owns the merge.
- Label: derived from the Conventional Commit type in the title.

| Title type | Label |
| --- | --- |
| `feat` | `enhancement` |
| `fix` | `bug` |
| `docs` | `documentation` |
| `chore` | `chore` |
| `refactor` | `refactor` |
| `infra` | `infra` |

```bash
gh pr create --draft --assignee @me --label enhancement ...
```

Create the label in the repository when it does not exist yet. Do not
substitute a label that carries a different meaning.

## Body Template

```markdown
## Why

## What Changed

## Validation
- [ ] Command or manual check

## Risks

## Rollback

Jira: ARTEL-123 (omit when no Jira work item exists)
```

## Safe Creation

Write generated PR content to a Markdown file before invoking GitHub CLI. Pass
the file with `--body-file`; do not interpolate multiline content into `--body`.
This prevents shell quoting, command substitution, and newline damage.

Use a temporary file unless the repository requires the PR draft to be tracked:

```bash
gh pr create --draft --title "<title>" --body-file /tmp/pr-body.md
```

After creation, read the remote PR back with `gh pr view` and confirm the title
and body match the source file. Fix the remote PR before reporting completion if
content is missing, truncated, or malformed. Remove temporary files after
successful verification.

## Review Rules

- Keep PR focused on one coherent outcome.
- Always create the PR as a draft, even when implementation and validation are
  complete. With GitHub CLI, pass `--draft` to `gh pr create`.
- Agents must never mark a PR ready for review. A human must review the draft
  and manually mark it ready.
- After creating the draft PR, tell the user that human review and manual
  ready-for-review transition are required.
- Respond to each actionable review comment.
- Resolve threads only after change or explicit agreement.
- Add new commits during review when history clarity matters.
- Squash only when repository policy prefers a single final commit.

## Merge Criteria

- acceptance criteria satisfied
- required checks pass
- review approvals complete
- unresolved risks explicitly accepted
- deployment or migration order documented
