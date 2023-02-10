import * as core from "@actions/core";
import * as github from "@actions/github";
import { Context } from "@actions/github/lib/context";
import { Octokit } from "@octokit/core";

interface ProjectFieldInput {
    fieldName: string;
    value: string;
}

interface Input {
    projectOwner: string;
    projectNumber: number;
    githubToken: string;
    projectFields: ProjectFieldInput[];
}

interface ProjectIDResponse {
    user: {
        projectV2: {
            id: string;
        };
    };
}

interface ProjectAddIssueResponse {
    addProjectV2ItemById: {
        item: {
            id: string;
        };
    };
}

interface ProjectItem {
    id: string;
    content?: {
        number: number;
        repository: {
            name: string;
        };
    };
}

interface ProjectItemsResponse {
    node: {
        items: {
            nodes: ProjectItem[];
        };
    };
}

interface ProjectField {
    fieldID: string;
    optionID: string;
}

interface ProjectFields {
    statusField: {
        statusFieldID: string;
        inProgressOptionID: string;
        inReviewOptionID: string;
    };
    otherFields: ProjectField[];
}

interface SingleSelectFieldOption {
    id: string;
    name: string;
}

interface SingleSelectField {
    id: string;
    name: string;
    options: [SingleSelectFieldOption];
}

interface ProjectFieldsResponse {
    node: {
        fields: {
            nodes: SingleSelectField[];
        };
    };
}

function getInput(repoOwner: string): Input {
    let githubToken = core.getInput("github-token", { required: true });
    let projectOwner = core.getInput("project-owner") || repoOwner;
    let porjectNumber = Number(
        core.getInput("project-number", { required: true })
    );
    let fieldNames = core.getInput("field-names").split(",");
    let fieldValues = core.getInput("field-values").split(",");
    if (fieldNames.length != fieldValues.length) {
        throw Error(
            "Invalid input: length of field names is unequal to length of field values."
        );
    }
    let projectFields = fieldNames.map(
        (val, i) =>
            ({
                fieldName: val,
                value: fieldValues[i],
            } as ProjectFieldInput)
    );
    return {
        githubToken: githubToken,
        projectOwner: projectOwner,
        projectNumber: porjectNumber,
        projectFields: projectFields,
    };
}

async function getProjectID(
    octokit: Octokit,
    projectOwner: string,
    projectNumber: number
): Promise<string> {
    const projectIDResponse = await octokit.graphql<ProjectIDResponse>(
        `query getProject($projectOwnerName: String!, $projectNumber: Int!) {
                user(login: $projectOwnerName) {
                    projectV2(number: $projectNumber) {
                        id
                    }
                }
            }`,
        {
            projectOwnerName: projectOwner,
            projectNumber: projectNumber,
        }
    );
    if (projectIDResponse.user.projectV2 === null) {
        throw Error(
            `❌ Project with owner "${projectOwner}" and number "${projectNumber}" doesn't exist!`
        );
    }
    return projectIDResponse.user.projectV2.id;
}

async function addIssueToProejct(
    octokit: Octokit,
    projectID: string,
    issueNodeID: string
): Promise<string> {
    const addIssueResponse = await octokit.graphql<ProjectAddIssueResponse>(
        `mutation addIssueToProject($input: AddProjectV2ItemByIdInput!) {
                addProjectV2ItemById(input: $input) {
                    item {
                        id
                    }
                }
            }`,
        {
            input: {
                projectId: projectID,
                contentId: issueNodeID,
            },
        }
    );
    return addIssueResponse.addProjectV2ItemById.item.id;
}

async function getIssueProjectItemID(
    octokit: Octokit,
    issueNumber: number,
    projectID: string,
    repoName: string
): Promise<string | null> {
    const projectItemsResponse = await octokit.graphql<ProjectItemsResponse>(
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
            projectId: projectID,
        }
    );
    for (const item of projectItemsResponse.node.items.nodes) {
        if (
            item.content !== null &&
            item.content?.number === issueNumber &&
            item.content?.repository.name === repoName
        ) {
            return item.id;
        }
    }
    return null;
}

async function getProjectFields(
    octokit: Octokit,
    projectID: string,
    fieldsInput: ProjectFieldInput[]
): Promise<ProjectFields> {
    const projectFieldsResponse = await octokit.graphql<ProjectFieldsResponse>(
        `query getProjectFields($projectId: ID!) {
                node(id: $projectId) {
                        ... on ProjectV2 {
                            fields(first: 100) {
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
            projectId: projectID,
        }
    );

    let statusFieldID = "",
        inProgressOptionID = "",
        inReviewOptionID = "";
    const projectFields: ProjectField[] = [];
    for (const field of projectFieldsResponse.node.fields.nodes) {
        if (field.name === "Status") {
            statusFieldID = field.id;
            for (const option of field.options) {
                if (option.name.toLowerCase().includes("in progress")) {
                    inProgressOptionID = option.id;
                } else if (option.name.toLowerCase().includes("in review")) {
                    inReviewOptionID = option.id;
                }
            }
        }
        const fieldIndex = fieldsInput.findIndex(
            (element) => element.fieldName === field.name
        );
        if (fieldIndex !== -1) {
            const option = field.options.find(
                (element) => element.name === fieldsInput[fieldIndex].value
            );
            if (option !== undefined) {
                projectFields.push({ fieldID: field.id, optionID: option.id });
            }
            fieldsInput.splice(fieldIndex, 1);
        }
    }
    if (
        statusFieldID === "" ||
        inProgressOptionID === "" ||
        inReviewOptionID === ""
    ) {
        throw Error(
            '❌ The field "Status" with the options "In progress" and "In review" doesn\'t exist!'
        );
    }
    if (fieldsInput.length > 0) {
        throw Error(
            `❌ The field "${fieldsInput[0].fieldName}" with the option "${fieldsInput[0].value}" doesn't exist!`
        );
    }

    return {
        statusField: {
            statusFieldID: statusFieldID,
            inProgressOptionID: inProgressOptionID,
            inReviewOptionID: inReviewOptionID,
        },
        otherFields: projectFields,
    };
}

async function setProjectFieldOption(
    octokit: Octokit,
    projectID: string,
    itemID: string,
    fieldID: string,
    optionID: string
): Promise<void> {
    await octokit.graphql(
        `mutation changeIssueProjectStatus($input: UpdateProjectV2ItemFieldValueInput!) {
                updateProjectV2ItemFieldValue(input: $input) {
                    projectV2Item {
                        id
                    }
                }
            }`,
        {
            input: {
                projectId: projectID,
                itemId: itemID,
                fieldId: fieldID,
                value: {
                    singleSelectOptionId: optionID,
                },
            },
        }
    );
}

async function handleActionEvent(
    octokit: Octokit,
    context: Context,
    projectID: string,
    projectFields: ProjectFields
): Promise<void> {
    const payload = context.payload;
    switch (context.eventName) {
        case "issues":
            const issueInfo = payload.issue;
            switch (payload.action) {
                case "opened":
                    issueInfo!.node_id;
                    const issueProjectItemID = await addIssueToProejct(
                        octokit,
                        projectID,
                        issueInfo?.node_id as string
                    );
                    for (const field of projectFields.otherFields) {
                        await setProjectFieldOption(
                            octokit,
                            projectID,
                            issueProjectItemID,
                            field.fieldID,
                            field.optionID
                        );
                    }
                    core.info("✅ Successfully added issue to the project!");
            }
            break;
        case "assigned":
            break;
    }
}

export async function run(): Promise<void> {
    const context = github.context;
    const input = getInput(context.repo.owner);
    const octokit = github.getOctokit(input.githubToken);
    const projectID = await getProjectID(
        octokit,
        input.projectOwner,
        input.projectNumber
    );
    const projectFields = await getProjectFields(
        octokit,
        projectID,
        input.projectFields
    );
    await handleActionEvent(octokit, context, projectID, projectFields);
}
