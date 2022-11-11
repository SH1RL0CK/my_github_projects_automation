import core from "@actions/core";
import github from "@actions/github";

class ProjectAutomationAction {
    constructor(githubToken, proejctUrl) {
        this.octokit = github.getOctokit(githubToken);
        const urlMatch = this.parseProjectUrl(proejctUrl);
        this.projectOwner = urlMatch.ownerName;
        this.projectNumber = parseInt(urlMatch.projectNumber);
        this.context = github.context;
        this.payload = this.context.payload;
    }

    parseProjectUrl(projectUrl) {
        const urlParse =
            /^(?:https:\/\/)?github\.com\/users\/(?<ownerName>[^/]+)\/projects\/(?<projectNumber>\d+)/;

        const urlMatch = projectUrl.match(urlParse);

        if (!urlMatch) {
            throw new Error(
                `Invalid project URL: ${projectUrl}. Project URL should match the format https://github.com/users/<ownerName>/projects/<projectNumber>!`
            );
        }
        return urlMatch.groups;
    }

    async getProjectId() {
        const queryProjectIdAnwer = await this.octokit.graphql(
            `query getProject($projectOwnerName: String!, $projectNumber: Int!) {
                user(login: $projectOwnerName) {
                    projectV2(number: $projectNumber) {
                        id
                    }
                }
            }`,
            {
                projectOwnerName: this.projectOwner,
                projectNumber: this.projectNumber,
            }
        );
        this.projectId = queryProjectIdAnwer.user.projectV2.id;
    }

    async getProjectStatusIds() {
        const queryProjectStatusAnswer = await this.octokit.graphql(
            `query getProjectFields($projectId: ID!) {
                node(id: $projectId) {
                        ... on ProjectV2 {
                            fields(first: 20) {
                                nodes {
                                ... on ProjectV2SingleSelectField {
                                    id
                                    name
                                    options {
                                        id
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }`,
            {
                projectId: this.projectId,
            }
        );
        for (const field of queryProjectStatusAnswer.node.fields.nodes) {
            if (field.name === "Status") {
                this.statusFieldId = field.id;
                for (const option of field.options) {
                    if (option.name.includes("In Progress")) {
                        this.inProgressOptionId = option.id;
                    } else if (option.name.includes("In Review")) {
                        this.inReviewOptionId = option.id;
                    }
                }
                break;
            }
        }
    }

    async handleActionEvent() {
        let issueId;
        switch (this.context.eventName) {
            case "issues":
                const issueInfo = this.payload.issue;
                switch (this.payload.action) {
                    case "opened":
                        await this.addIssueToProject(issueInfo);
                        break;
                    case "assigned":
                        issueId = await this.getIssueProjectItemId(
                            issueInfo.number
                        );
                        await this.changeIssueProjectSatus(
                            issueId,
                            this.inProgressOptionId
                        );
                        break;
                    default:
                        throw Error(
                            `Unexpected issue action: ${this.payload.action}. Please only use opened or assigned!`
                        );
                }
                break;

            case "pull_request":
                const issueNumber = this.getIusseNumberFromBranchName(
                    this.payload.pull_request.head.ref
                );
                issueId = await this.getIssueProjectItemId(issueNumber);
                await this.changeIssueProjectSatus(
                    issueId,
                    this.inReviewOptionId
                );
                await this.addClosingReferenceToPullRequest(issueNumber);
                break;
            default:
                throw Error(
                    `Unexpected event: ${this.context.eventName}. Please only use issue or pull_request!`
                );
        }
    }

    async addIssueToProject(issueInfo) {
        await this.octokit.graphql(
            `mutation addIssueToProject($input: AddProjectV2ItemByIdInput!) {
                addProjectV2ItemById(input: $input) {
                    item {
                        id
                    }
                }
            }`,
            {
                input: {
                    projectId: this.projectId,
                    contentId: issueInfo.node_id,
                },
            }
        );
    }

    async getIssueProjectItemId(issueNumber) {
        const queryIssueProjectItems = await this.octokit.graphql(
            `query getIssuesFromProject( $projectId: ID! ) {
                node(id: $projectId) {
                    ... on ProjectV2 {
                        items(first: 100) {
                            nodes {
                                id
                                content {
                                    ... on Issue {
                                        number
                                        repository {
                                            name
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }`,
            {
                projectId: this.projectId,
            }
        );
        for (const item of queryIssueProjectItems.node.items.nodes) {
            if (
                item.content !== null &&
                item.content.number === issueNumber &&
                item.content.repository.name === this.context.repo.repo
            ) {
                return item.id;
            }
        }
    }

    async changeIssueProjectSatus(issueId, optionId) {
        await this.octokit.graphql(
            `mutation changeIssueProjectStatus($input: UpdateProjectV2ItemFieldValueInput!) {
                updateProjectV2ItemFieldValue(input: $input) {
                    projectV2Item {
                        id
                    }
                }
            }`,
            {
                input: {
                    projectId: this.projectId,
                    itemId: issueId,
                    fieldId: this.statusFieldId,
                    value: {
                        singleSelectOptionId: optionId,
                    },
                },
            }
        );
    }

    getIusseNumberFromBranchName(branchName) {
        const branchParse = /^feature\/(?<issueNumber>\d+)-[a-zA-Z0-9\-]*$/;
        const branchMatch = branchName.match(branchParse);
        if (!branchMatch) {
            throw new Error(
                `Invalid branch name: ${branchName}. Feature branches names should match the format feature/<issueNumber>-<issueTopic>!`
            );
        }
        return parseInt(branchMatch.groups.issueNumber);
    }

    async addClosingReferenceToPullRequest(issueNumber) {
        let requestParameters = {
            ...this.context.repo,
            issue_number: this.payload.pull_request.number,
        };
        const {
            data: { body },
        } = await this.octokit.rest.issues.get(requestParameters);
        requestParameters.body = `${body || ""}\nCloses #${issueNumber}`;
        await this.octokit.rest.issues.update(requestParameters);
    }
}

async function run() {
    const action = new ProjectAutomationAction(
        core.getInput("github-token", { required: true }),
        core.getInput("project-url", { required: true })
    );
    await action.getProjectId();
    await action.getProjectStatusIds();
    await action.handleActionEvent();
}

run()
    .catch((err) => {
        core.setFailed(err.message);
        process.exit(1);
    })
    .then(() => {
        process.exit(0);
    });
