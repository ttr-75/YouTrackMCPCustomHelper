const entities = require('@jetbrains/youtrack-scripting-api/entities');

exports.aiTool = {
    name: 'get_issue_links',
    description: 'Liest alle IssueLinks eines Issues aus und gibt sie strukturiert zurück. Read-only, idempotent.',
    inputSchema: {
        type: 'object',
        properties: {
            issueId: {
                type: 'string',
                description: 'Issue ID/Key, z.B. DSS-123'
            }
        },
        required: ['issueId']
    },
    annotations: {
        title: 'Get issue links',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        returnDirect: false
    },
    execute: (ctx) => {
        const issueId = (ctx.arguments.issueId || '').trim();
        if (!issueId) {
            throw new Error('issueId ist erforderlich.');
        }

        const issue = entities.Issue.findById(issueId);
        if (!issue) {
            throw new Error('Issue nicht gefunden: "' + issueId + '"');
        }

        const links = [];

        issue.links.forEach(link => {
            if (!link) return;

            const linkedIssue = link.issue;
            links.push({
                id: link.id,
                direction: String(link.direction || ''),
                linkType: link.linkType && link.linkType.name,
                linkedIssueId: linkedIssue && linkedIssue.id,
                linkedIssueReadableId: linkedIssue && linkedIssue.idReadable,
                linkedIssueSummary: linkedIssue && linkedIssue.summary
            });
        });

        return {
            issueId,
            linkCount: links.length,
            links
        };
    }
};

