# PeopleFlow contribution rules

## Product and code

- Keep all interface text in French; use English for code, identifiers, and
  database names.
- Work on one small feature at a time. Keep pull requests and commits easy to
  review.
- Follow red-green-refactor: write a focused failing test, implement the
  smallest change that passes, then tidy the code.
- Use the seed data for repeatable demos. All sample people and contact details
  must be fictional.
- Keep secrets in local environment files. Never commit credentials or put a
  server key in the Vite app.
- Keep product behavior behind the API. The browser must not connect with a
  Supabase service-role key.

## Agent workflow

For each feature:

1. Read the feature brief and identify its acceptance criteria.
2. Post a short progress note before changing files.
3. Add or update a focused test that captures the expected behavior.
4. Implement only what the criteria require; inspect the diff for unrelated
   changes and private data.
5. Run the relevant checks and report their actual results.
6. Commit the finished feature with a descriptive, conventional commit message.

If a requirement is unclear, keep independent work moving and state the
assumption. Stop before destructive data changes or external side effects.
