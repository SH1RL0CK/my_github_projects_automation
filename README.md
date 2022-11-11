
# My GitHub Projects Automation

![GitHub release (latest by date)](https://img.shields.io/github/v/release/SH1RL0CK/my_github_projects_automation?label=version&style=for-the-badge)

**A GitHub action to automate my GitHub projects**

## Tasks of the action

- adds all new issue to the project for the repository
- when an issue is assigned, its project status is set to `In Progress`
- when a pull request from a feature branch (branch name format: `feature/<issueNumber>-<issueTopic>` ) to the main branch is opened,
  - the project status of the associated issue is set to `In Review`
  - a closing reference for the associated issue is added to the pull request

## Inputs

- <a name="project-url">`project-url`</a> **(required)** is the URL of the GitHub project to add issues to.
  _eg: `https://github.com/users/<ownerName>/projects/<projectNumber>`_
- <a name="github-token">`github-token`</a> **(required)** is a [personal access
  token](https://github.com/settings/tokens/new) with `repo` and `project` scopes.
  _See [Creating a PAT and adding it to your repository](https://github.com/actions/add-to-project/blob/main/README.md#creating-a-pat-and-adding-it-to-your-repository) for more details_

## Example usage

```yaml
name: My GitHub Projects Automation

on:
  issues:
    types:
      - "opened"
      - "assigned"
  pull_request:
    types:
      - "opened"
    branches:
      - main 

jobs:
  project_automation:
    runs-on: ubuntu-latest
    name: Automate my GitHub project
    steps:
      - name: Automate my GitHub project
        uses: SH1RL0CK/my_github_projects_automation@v1.0.2
        with:
          project-url: https://github.com/users/<ownerName>/projects/<projectNumber> 
          github-token: ${{ secrets.PROJECT_AUTOMATION_PAT }}
```
