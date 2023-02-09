import * as core from '@actions/core';

const name = core.getInput("name", { required: true });
console.log(`hello ${name}`);
core.setOutput("name", name);
