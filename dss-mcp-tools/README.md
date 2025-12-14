# DSS MCP Tools (YouTrack App Package)

Custom MCP tools for YouTrack to support the DSS workflow — especially **shared/global tags**.

## What’s inside

This app package provides two custom tools (with prefix `dss_`):

- **`dss_ensure_shared_tags`**
  - Ensures tags exist and are shared with a target group (default: `All Users`).
  - Idempotent (safe to run multiple times).

- **`dss_ensure_shared_tags_and_tag_issue`**
  - Ensures tags exist + are shared, then attaches them to an issue.
  - Idempotent.

Both tools support the DSS safety pattern:
- `mode: propose|apply`
- `applyUpdates: true|false`

## Project structure

```
dss-mcp-tools/
  manifest.json
  ensure_shared_tags.js
  ensure_shared_tags_and_tag_issue.js
  README.md
```

## Build / Package

Create a zip that contains the **folder `dss-mcp-tools/`**:

### PowerShell
```powershell
Compress-Archive -Path dss-mcp-tools -DestinationPath dss-mcp-tools.zip -Force
```

### bash/zsh
```bash
zip -r dss-mcp-tools.zip dss-mcp-tools
```

## Install in YouTrack

1) Upload the app package (`dss-mcp-tools.zip`) in YouTrack (requires Low-level Admin).
2) Enable the custom tool package in the MCP URL:

```
/mcp?customToolPackages=dss-mcp-tools
```

(Optional) to see output schemas:
```
/mcp?customToolPackages=dss-mcp-tools&enableToolOutputSchema=true
```

3) Reconnect/refresh your AI client so the new tools appear.

## Notes / Troubleshooting

- Tools run with the permissions of the current user (no privilege escalation).
- If tag sharing doesn’t work, check the target **group name** (default: `All Users`)
  and permissions/visibility configuration in YouTrack.
