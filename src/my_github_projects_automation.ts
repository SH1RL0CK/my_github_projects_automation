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
    let projectIDResponse: ProjectIDResponse =
        await octokit.graphql<ProjectIDResponse>(
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
    return projectIDResponse.user.projectV2.id;
}

async function addIssueToProejct(
    octokit: Octokit,
    projectID: string,
    issueNodeID: string
) {
    await octokit.graphql(
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
}

async function handleActionEvent(
    octokit: Octokit,
    context: Context,
    projectID: string,
    input: Input
): Promise<void> {
    const payload = context.payload;
    console.log("Event Name:", context.eventName);
    switch (context.eventName) {
        case "issues":
            const issueInfo = payload.issue;
            switch (payload.action) {
                case "opened":
                    issueInfo!.node_id;
                    await addIssueToProejct(
                        octokit,
                        projectID,
                        issueInfo?.node_id as string
                    );
            }
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
    console.log("projectID:", projectID);
    await handleActionEvent(octokit, context, projectID, input);
}
