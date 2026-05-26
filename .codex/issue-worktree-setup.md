# Issue Worktree Setup

This repository uses `pa_template` as its real local integration baseline. When creating a new `fps-game-editor` issue worktree, clone a matching ignored companion repository at:

```text
<new-fps-game-editor-worktree>/.local/pa_template
```

Use the existing source repository at:

```text
<original-fps-game-editor-root>/.local/pa_template
```

This source path must be a Git repository or Git worktree. Inspect its status first, but do not copy, stash, reset, restore, or overwrite its local changes. Use its `origin` remote URL for the new clone.

Always clone and use this existing remote integration branch directly:

```text
integration/fps-game-editor-lab
```

Verify the remote branch exists before cloning:

```bash
git -C <original-fps-game-editor-root>/.local/pa_template ls-remote --heads origin integration/fps-game-editor-lab
```

Do not create an issue-specific `pa_template` branch. The local clone should be on `integration/fps-game-editor-lab`, tracking `origin/integration/fps-game-editor-lab`.

Example:

```bash
mkdir -p <new-fps-game-editor-worktree>/.local
git clone \
  --branch integration/fps-game-editor-lab \
  --single-branch \
  "$(git -C <original-fps-game-editor-root>/.local/pa_template remote get-url origin)" \
  <new-fps-game-editor-worktree>/.local/pa_template
```

If the companion directory already exists, do not overwrite it. Inspect it and ask the user how to proceed.

Do not copy `.local/pa_template` and do not symlink to an existing template worktree. Save tests frequently modify:

```text
src/config/editor-scene.json
src/config/scene.json
```

After cloning the companion repository, install its dependencies with:

```bash
pnpm --dir <new-fps-game-editor-worktree>/.local/pa_template --ignore-workspace install --frozen-lockfile
```

Do not start `pa_template`, build it, run tests, run watchers, or push during the issue worktree setup workflow.
