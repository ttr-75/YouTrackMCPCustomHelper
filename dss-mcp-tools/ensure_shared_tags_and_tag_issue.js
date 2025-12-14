const entities = require('@jetbrains/youtrack-scripting-api/entities');

const DEFAULT_SHARE_GROUP = 'All Users';

function asArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function normalize(name) { return (typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''); }
function distinct(names) {
    const seen = Object.create(null), out = [];
    names.forEach(n => { const k = n.toLowerCase(); if (!k || seen[k]) return; seen[k] = true; out.push(n); });
    return out;
}

function setHasGroup(set, group) {
    let found = false;
    if (!set || !group) return false;
    set.forEach(g => { if (g && (g.id === group.id || g.name === group.name)) found = true; });
    return found;
}
function setAddGroupIfMissing(set, group) { if (!set || !group) return false; if (setHasGroup(set, group)) return false; set.add(group); return true; }

function pickBestTag(candidates, shareGroup) {
    if (!candidates) return null;
    let best = null;
    candidates.forEach(tag => {
        if (best) return;
        if (tag && tag.shareGroup && shareGroup &&
            (tag.shareGroup.id === shareGroup.id || tag.shareGroup.name === shareGroup.name)) best = tag;
    });
    if (best) return best;
    candidates.forEach(tag => { if (!best && tag) best = tag; });
    return best;
}

function ensureShare(tag, shareGroupId) {
    const errors = [];
    let changed = false;
    const folder = tag.folder || tag;

    // Use deprecated but working fields visibleFor and updateableBy with group ID
    try {
        folder.visibleFor = { id: shareGroupId };
        changed = true;
    } catch (e) { errors.push('visibleFor: ' + e); }

    try {
        folder.updateableBy = { id: shareGroupId };
        changed = true;
    } catch (e) { errors.push('updateableBy: ' + e); }

    return { changed, errors };
}

function ensureSharedTag(name, shareGroup, shareGroupId) {
    const candidates = entities.Tag.findByName(name, true);
    let tag = pickBestTag(candidates, shareGroup);

    const res = { tagName: name, existed: !!tag, created: false, shareUpdated: false, shareUpdateErrors: [] };

    if (!tag) { tag = new entities.Tag(name); res.created = true; }
    const shareRes = ensureShare(tag, shareGroupId);
    res.shareUpdated = shareRes.changed;
    res.shareUpdateErrors = shareRes.errors;

    return res;
}

exports.aiTool = {
    name: 'ensure_shared_tags_and_tag_issue',
    description: 'Ensures tags exist + are shared, then attaches them to an issue. Idempotent.',
    inputSchema: {
        type: 'object',
        properties: {
            mode: { type: 'string', enum: ['propose', 'apply'], default: 'apply' },
            applyUpdates: { type: 'boolean', default: true },

            issueId: { type: 'string', description: 'Issue ID, e.g. DSS-123' },
            tagNames: { type: 'array', items: { type: 'string' } },
            shareGroupName: { type: 'string', default: DEFAULT_SHARE_GROUP },
            shareGroupId: { type: 'string', description: 'Optional: Direct Group ID. If set, shareGroupName is ignored.' }
        },
        required: ['issueId', 'tagNames']
    },
    annotations: {
        title: 'Ensure shared tags and tag issue',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        returnDirect: false
    },
    execute: (ctx) => {
        const mode = (ctx.arguments.mode || 'apply').toLowerCase();
        const applyUpdates = (typeof ctx.arguments.applyUpdates === 'boolean') ? ctx.arguments.applyUpdates : true;
        const doApply = (mode === 'apply') && applyUpdates;

        const issueId = (ctx.arguments.issueId || '').trim();
        if (!issueId) throw new Error('issueId is required.');

        // Use shareGroupId directly if provided, otherwise load group by name
        let shareGroupId = (ctx.arguments.shareGroupId || '').trim();
        let shareGroup = null;
        let shareGroupName = '';

        if (shareGroupId) {
            // Direct ID provided - use it without loading the group
            shareGroupName = shareGroupId; // Use ID as name for logging
        } else {
            // Load group by name
            shareGroupName = (ctx.arguments.shareGroupName || DEFAULT_SHARE_GROUP).trim();
            shareGroup = entities.UserGroup.findByName(shareGroupName);
            if (!shareGroup) throw new Error(`UserGroup not found: "${shareGroupName}"`);
            shareGroupId = shareGroup.id;
        }

        const tagNames = distinct(asArray(ctx.arguments.tagNames).map(normalize).filter(Boolean));

        // aiTool best practice: resolve IDs in code (Issue.findById)
        const issue = entities.Issue.findById(issueId);
        if (!issue) throw new Error(`Issue not found: "${issueId}"`);

        if (!doApply) {
            return { mode, applied: false, issueId, shareGroupName, plan: tagNames.map(t => ({ tagName: t, wouldAttach: true })) };
        }

        const ensured = [];
        const attached = [];
        const alreadyPresent = [];

        tagNames.forEach(name => {
            ensured.push(ensureSharedTag(name, shareGroup, shareGroupId));
            if (issue.hasTag(name, true)) alreadyPresent.push(name);
            else { issue.addTag(name); attached.push(name); }
        });

        return { mode, applied: true, issueId, shareGroupName, ensured, attached, alreadyPresent };
    }
};
