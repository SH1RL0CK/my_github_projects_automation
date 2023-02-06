import * as core from "@actions/core";

const name = core.getInput("name", { required: true });
core.debug(`Hello ${name}!`);
core.setOutput("name", name);
