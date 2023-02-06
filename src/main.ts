import * as core from '@actions/core';

import { run } from './greet';

run()
    .catch((error) => {
        core.setFailed(error.message);
        process.exit(1);
    })
    .then(() => {
        process.exit(0);
    });
