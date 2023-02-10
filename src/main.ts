import * as core from "@actions/core";
import { run } from "./my_github_projects_automation";

run()
    .catch((error) => {
        core.setFailed(`❌ ${error.message}!`);
        process.exit(1);
    })
    .then((result) => {
        core.info(`✅ ${result}!`);
        process.exit(0);
    });
