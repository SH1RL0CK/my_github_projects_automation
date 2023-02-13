# My GitHub Projects Automation

![GitHub release (latest by date)](https://img.shields.io/github/v/release/SH1RL0CK/my_github_projects_automation?label=version&style=for-the-badge)

**A GitHub action to automate my GitHub projects**

## Tasks of the action

- adds all new issue to the project for the repository
- if desired, values of singe select fields can be set for the issue
- when an issue is assigned, its project status is set to `In progress`
- when a pull request from a feature branch (branch name format: `feature/<issueNumber>-<issueTopic>` ) to the main branch is opened,
  - the project status of the associated issue is set to `In review`
  - a closing reference for the associated issue is added to the pull request

## Inputs

- `project-owner` is the owner of the GitHub project to that the issuses should be added to. **(Default is the repository owner)**.
- `project-number` **(required)** is the project number. Get this from the URL.
- `github-token` **(required)** is a [personal access
  token](https://github.com/settings/tokens/new) with `repo` and `project` scopes.
  _See [Creating a PAT and adding it to your repository](https://github.com/actions/add-to-project/blob/main/README.md#creating-a-pat-and-adding-it-to-your-repository) for more details_.
- `field-names` are GitHub project single select field names separated with `,`.
- `field-values`</a> are the GitHub project field values associated to the `field-names` separated with `,`.

## Example usage

```yaml
name: My GitHub Projects Automation

on:
    issues:
        types:
            - opened
            - assigned
    pull_request:
        types:
            - opened
        branches:
            - main 

jobs:
    project_automation:
        runs-on: ubuntu-latest
        name: Automate my GitHub project
        steps:
            - name: Automate my GitHub project
              uses: SH1RL0CK/my_github_projects_automation@v1.0.0
              with:
                  project-owner: SH1RL0CK
                  project-number: 1
                  github-token: ${{ secrets.PROJECT_AUTOMATION_PAT }}
                  field-names: Repo,Type
                  field-values: Server,Bug
```

## Special mentions

I want to say thanks to the authors and contributors of [update-project-fields](https://github.com/titoportas/update-project-fields), [add-to-project](https://github.com/actions/add-to-project) and [project-update](https://github.com/austenstone/project-update). These projects were were a huge insperation for this action.
