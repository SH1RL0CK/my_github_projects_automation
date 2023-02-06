import * as core from '@actions/core';

export async function run(): Promise<void> {
    const name = core.getInput("name", { required: true });
    core.debug(`Hello ${name}!`);
}
