const entities = require('@jetbrains/youtrack-scripting-api/entities');

const DEFAULT_SHARE_GROUP = 'All Users';

function asArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function normalize(name) { return (typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''); }

function distinct(names) {
    const seen = Object.create(null);
    const out = [];
    names.forEach(n => {
        const key = n.toLowerCase();
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(n);
    });
    return out;
}

function setHasGroup(set, group) {
    let found = false;
    if (!set || !group) return false;
    set.forEach(g => { if (g && (g.id === group.id || g.name === group.name)) found = true; });
    return found;
}

function setAddGroupIfMissing(set, group) {
    if (!set || !group) return false;
    if (setHasGroup(set, group)) return false;
    set.add(group);
    return true;
}

function pickBestTag(candidates, shareGroup) {
    if (!candidates) return null;

    // Prefer tag already shared to target group
    let best = null;
    candidates.forEach(tag => {
        if (best) return;
        if (tag && tag.shareGroup && shareGroup &&
            (tag.shareGroup.id === shareGroup.id || tag.shareGroup.name === shareGroup.name)) {
            best = tag;
        }
    });
    if (best) return best;

    // Otherwise first one (findByName returns current user's tags first)
    candidates.forEach(tag => { if (!best && tag) best = tag; });
    return best;
}

function ensureShare(tag, shareGroup) {
    const errors = [];
    let changed = false;

    // Tag exposes permitted* sets (recommended in docs)
    const folder = tag.folder || tag;

    try { changed = setAddGroupIfMissing(folder.permittedReadUserGroups, shareGroup) || changed; }
    catch (e) { errors.push('permittedReadUserGroups: ' + e); }

    try { changed = setAddGroupIfMissing(folder.permittedTagUserGroups, shareGroup) || changed; }
    catch (e) { errors.push('permittedTagUserGroups: ' + e); }

    return { changed, errors };
}

exports.aiTool = {
    name: 'ensure_shared_tags',
    description: 'Creates missing tags (if needed) and ensures they are shared/usable for a target user group (default: All Users). Idempotent.',
    inputSchema: {
        type: 'object',
        properties: {
            mode: { type: 'string', enum: ['propose', 'apply'], default: 'apply' },
            applyUpdates: { type: 'boolean', default: true },

            tagNames: { type: 'array', items: { type: 'string' } },
            shareGroupName: { type: 'string', default: DEFAULT_SHARE_GROUP }
        },
        required: ['tagNames']
    },
    annotations: {
        title: 'Ensure shared tags',
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

        const shareGroupName = (ctx.arguments.shareGroupName || DEFAULT_SHARE_GROUP).trim();
        const shareGroup = entities.UserGroup.findByName(shareGroupName); //
        if (!shareGroup) throw new Error(`UserGroup not found: "${shareGroupName}"`);

        const tagNames = distinct(asArray(ctx.arguments.tagNames).map(normalize).filter(Boolean));

        const results = tagNames.map(name => {
            const candidates = entities.Tag.findByName(name, true);
            let tag = pickBestTag(candidates, shareGroup);

            const res = {
                tagName: name,
                existed: !!tag,
                created: false,
                shareGroupName,
                shareUpdated: false,
                shareUpdateErrors: []
            };

            if (!doApply) return res;

            if (!tag) {
                tag = new entities.Tag(name);
                res.created = true;
            }

            const shareRes = ensureShare(tag, shareGroup);
            res.shareUpdated = shareRes.changed;
            res.shareUpdateErrors = shareRes.errors;

            return res;
        });

        return { mode, applied: doApply, shareGroupName, results };
    }
};
